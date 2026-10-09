// ============================================================
// server.js - a small helper for calling Claude or OpenAI
//
// You only need this if PROVIDER in script.js is "claude" or "openai".
// It does two jobs:
//   1. Serves this folder as a website at http://localhost:8000
//   2. Keeps your API key secret. The page sends its question here, this file
//      adds the key and passes the question on, then sends the answer back.
//
// Run it with:   node server.js
// It needs Node.js 18 or newer and nothing else (no npm install).
// ============================================================

const http = require("http");
const fs = require("fs");
const path = require("path");

// ---------- Settings you can change ----------

const PORT = 8000;
const CLAUDE_MODEL = "claude-sonnet-5-5";   // "claude-haiku-4-5-20251001" is faster and cheaper
const OPENAI_MODEL = "gpt-6-luna";          // OpenAI's smallest; see platform.openai.com/docs/models
const MAX_TOKENS = 300;                     // the longest answer Claude may give


// ---------- 1. Read the keys from the .env file ----------
// .env is a plain text file with lines like  ANTHROPIC_API_KEY=sk-ant-...
// It is listed in .gitignore, so Git never uploads it.

const keys = {};
if (fs.existsSync(path.join(__dirname, ".env"))) {
  const lines = fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const equals = line.indexOf("=");
    if (equals > 0 && !line.trim().startsWith("#")) {
      keys[line.slice(0, equals).trim()] = line.slice(equals + 1).trim();
    }
  });
}


// ---------- 2. Ask Claude ----------

async function askClaude(prompt) {
  if (!keys.ANTHROPIC_API_KEY) {
    throw new Error("No ANTHROPIC_API_KEY in your .env file");
  }
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": keys.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  // The answer arrives as a list of blocks. Join the text ones together.
  return data.content.filter((block) => block.type === "text").map((block) => block.text).join("");
}


// ---------- 3. Ask OpenAI ----------

async function askOpenAI(prompt) {
  if (!keys.OPENAI_API_KEY) {
    throw new Error("No OPENAI_API_KEY in your .env file");
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + keys.OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.choices[0].message.content;
}


// ---------- 4. The web server ----------

const FILE_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

function sendJSON(res, status, object) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(object));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  // The page's questions arrive here
  if (req.method === "POST" && (url.pathname === "/api/claude" || url.pathname === "/api/openai")) {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const prompt = JSON.parse(body).prompt;
        const text = url.pathname === "/api/claude" ? await askClaude(prompt) : await askOpenAI(prompt);
        sendJSON(res, 200, { text: text });
      } catch (error) {
        sendJSON(res, 500, { error: error.message });
      }
    });
    return;
  }

  // Everything else is a request for a file in this folder
  let filePath = decodeURIComponent(url.pathname);
  if (filePath.endsWith("/")) {
    filePath += "index.html";
  }
  const fullPath = path.join(__dirname, filePath);
  const type = FILE_TYPES[path.extname(fullPath).toLowerCase()];

  // Only serve known file types from inside this folder, and never hidden
  // files such as .env or this server's own code
  const hidden = filePath.split("/").some((piece) => piece.startsWith("."));
  const outside = !fullPath.startsWith(__dirname + path.sep);
  if (!type || hidden || outside || path.basename(fullPath) === "server.js") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  fs.readFile(fullPath, (error, contents) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": type });
    res.end(contents);
  });
});

// "127.0.0.1" means only this computer can reach the server
server.listen(PORT, "127.0.0.1", () => {
  console.log("Open http://localhost:" + PORT + " in your browser. Press Ctrl+C to stop.");
});
