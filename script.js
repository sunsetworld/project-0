// ============================================================
// Project 0 template
//
// It does four things:
//   1. Loads two JSON files: the parts of your object, and your facts
//   2. Builds the object out of its parts, each with its own sprite sheet
//   3. Lets a visitor click a part to play its animation and read its fact
//   4. Asks a language model to reflect on the fact
// ============================================================


// ---------- Settings you can change ----------

// Which language model answers: "ollama", "claude" or "openai".
//   "ollama" runs on your own computer and needs no key.
//   "claude" and "openai" need an API key and the helper in server.js (see README).
const PROVIDER = "ollama";

// Where a local Ollama model listens, and which model to use
const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_MODEL = "gemma3:1b";

// What you ask the model. The fact is added to the end.
const PROMPT =
  "You are a thoughtful commentator. In two short sentences, reflect on the human " +
  "and environmental meaning of this fact. Do not lecture. Fact: ";


// ---------- 1. Page elements ----------

const objectEl = document.getElementById("object");
const cardTitle = document.getElementById("card-title");
const cardFact = document.getElementById("card-fact");
const cardSource = document.getElementById("card-source");
const askButton = document.getElementById("ask-button");
const modelOutput = document.getElementById("model-output");

let facts = [];          // filled in once facts.json has loaded
let currentFact = null;  // the fact being shown right now


// ---------- 2. Load the two JSON files, then build the object ----------

async function start() {
  let layout;
  try {
    const partsResponse = await fetch("assets/parts.json");
    layout = await partsResponse.json();
    const factsResponse = await fetch("data/facts.json");
    facts = await factsResponse.json();
  } catch (error) {
    cardFact.textContent =
      "Could not load the JSON files. Serve this folder with a local web server (see README).";
    return;
  }
  buildObject(layout);
}

function buildObject(layout) {
  // The area is the size of the whole render
  objectEl.style.width = layout.width + "px";
  objectEl.style.height = layout.height + "px";

  layout.parts.forEach((part) => {
    // Each part is an empty box. Its sprite sheet is the box's background,
    // and the box is exactly one frame in size, so only one frame shows.
    const el = document.createElement("div");
    el.classList.add("part");
    el.id = "part-" + part.id;
    el.style.left = part.x + "px";
    el.style.top = part.y + "px";
    el.style.setProperty("--w", part.w + "px");
    el.style.setProperty("--h", part.h + "px");
    el.style.setProperty("--steps", part.frames - 1);   // 12 frames means 11 jumps
    el.style.backgroundImage = 'url("assets/' + part.id + '-sheet.png")';

    // A part with more than one frame gets a clickable area. It sits where
    // the part is drawn on the first frame, not over the whole box.
    if (part.frames > 1) {
      const hit = document.createElement("div");
      hit.classList.add("hit");
      placeHit(hit, part.start);
      hit.addEventListener("click", () => handlePartClick(part, el, hit));
      el.appendChild(hit);
    }
    objectEl.appendChild(el);
  });
}

// Puts a clickable area at a position inside its part's box
function placeHit(hit, box) {
  hit.style.left = box.x + "px";
  hit.style.top = box.y + "px";
  hit.style.width = box.w + "px";
  hit.style.height = box.h + "px";
}


// ---------- 3. What happens when a part is clicked ----------

function handlePartClick(part, el, hit) {
  // Toggle the "apart" class. The CSS moves the sprite sheet along one
  // frame at a time, and moves it back when the class is removed.
  el.classList.toggle("apart");
  const isApart = el.classList.contains("apart");

  // The clickable area follows the part to where it ends up
  placeHit(hit, isApart ? part.end : part.start);

  // Only show the fact when the part has just moved apart
  if (!isApart) {
    return;
  }

  // Find the fact whose "parts" list includes this part.
  // A part with no fact still animates, but leaves the card as it is.
  const fact = facts.find((item) => item.parts.includes(part.id));
  if (!fact) {
    return;
  }

  currentFact = fact;
  cardTitle.textContent = fact.title;
  cardFact.textContent = fact.fact;
  cardSource.innerHTML = 'Source: <a href="' + fact.url + '" target="_blank">' + fact.source + "</a>";
  modelOutput.textContent = "";
  askButton.hidden = false;
}


// ---------- 4. Ask a language model ----------

// Ollama runs on your own computer, so the page can talk to it directly.
async function askOllama(prompt) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt: prompt, stream: false })
  });
  const data = await response.json();

  // Ollama sends back an "error" field if something is wrong, for example
  // if the model has not been downloaded yet
  if (data.error) {
    throw new Error(data.error);
  }
  return data.response;
}

// Claude and OpenAI need a secret API key. A key must never be written in
// this file, because anyone can read the JavaScript of a web page. Instead the
// page asks server.js, which keeps the key and passes the question on.
async function askCloud(provider, prompt) {
  const response = await fetch("/api/" + provider, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: prompt })
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.text;
}

function askModel(fact) {
  const prompt = PROMPT + fact.fact;
  if (PROVIDER === "ollama") {
    return askOllama(prompt);
  }
  return askCloud(PROVIDER, prompt);
}

askButton.addEventListener("click", async () => {
  if (!currentFact) {
    return;
  }

  modelOutput.textContent = "Thinking...";
  try {
    modelOutput.textContent = await askModel(currentFact);
  } catch (error) {
    modelOutput.textContent = "The model could not answer (" + error.message + "). See the README for what to check.";
  }
});

// Stretch idea: call askModel() twice with two different prompts (one from the
// point of view of extraction, one from care and repair) and show both.

start();
