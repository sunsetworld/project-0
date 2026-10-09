# Project 0 template

A starting point for Project 0 in Creative Tech 1: an object made of parts. Click a part and it
animates away from the object, a fact about it appears, and a language model reflects on the fact.

The example object is a pair of smart glasses. Swap in your own object and your own facts.

Plain HTML, CSS and JavaScript. No framework and no build step.

**The full step-by-step tutorial is [`tutorial.html`](tutorial.html)** (also on Blackboard).
Download it and open it in a browser, or read the short version below.

## Run it

The page loads JSON files, so it must be served, not opened by double-clicking.

1. Open a terminal in this folder.
2. Run `python -m http.server 8000` (on a Mac you may need `python3`).
3. Open <http://localhost:8000>.

To try the **Ask the model** button, install [Ollama](https://ollama.com/download), run
`ollama pull gemma3:1b` once, and keep Ollama running.

## What is in the folder

| File | What it does | Do you change it? |
|---|---|---|
| `index.html` | The page: the object area and the fact card | Yes: title and text (look for `CHANGE ME`) |
| `style.css` | The look, and the stepped transition that plays each sprite sheet | Yes: colours and fonts |
| `script.js` | Loads the JSON, builds the object, handles clicks, calls the model | Only the settings at the top |
| `data/facts.json` | Your facts: which parts, title, fact, source, link | **Yes** |
| `assets/*-sheet.png` | One sprite sheet per part | **Replaced** by your own render |
| `assets/parts.json` | Where each part sits and where it can be clicked | Written for you by `make_sprites.py` |
| `blender/glasses.blend` | The example model, with its animation | Replace with your own `.blend` |
| `blender/make_sprites.py` | Blender script that renders the sheets and `parts.json` | Only the settings at the top |
| `server.js` | Optional helper for calling Claude or OpenAI | Only the settings at the top |
| `.env.example` | Shows where API keys go | Copy it to `.env` |
| `RESOURCES.md` | Links to documentation and further reading | |

## Swap in your own object

1. **Model it in Blender.** Make each part a separate object and give it a short name
   (`battery`, `screen`). These names become the part ids.
2. **Animate it.** On frame 1 everything is in place. On the last frame (12 is a good number)
   the parts have moved apart. Set the timeline's End to that frame.
3. **Save the `.blend` in the `blender` folder.**
4. **Render.** In Blender's Scripting tab, open `blender/make_sprites.py` and press Run Script.
   It replaces the sheets in `assets/` and rewrites `assets/parts.json`.
5. **Delete the old glasses sheets** from `assets/` (any `-sheet.png` that is not yours).
6. **Write your facts** in `data/facts.json`. Each fact lists the part ids it belongs to:

   ```json
   {
     "parts": ["battery"],
     "title": "The battery: where the cobalt comes from",
     "fact": "One or two sentences, with a number if you can.",
     "source": "Who published it, and when",
     "url": "https://..."
   }
   ```

   Two parts can share one fact: `"parts": ["speaker1", "speaker2"]`. A part with no fact still
   animates. A part that does not move in Blender is drawn but cannot be clicked.
7. **Change the words** in `index.html` and the colours at the top of `style.css`.

## Choose a language model

Set `PROVIDER` at the top of `script.js`.

| `PROVIDER` | Where it runs | Needs | How to serve the page |
|---|---|---|---|
| `"ollama"` | On your computer | Ollama running, a model pulled | `python -m http.server 8000` |
| `"claude"` | Anthropic's servers | A paid API key in `.env` | `node server.js` |
| `"openai"` | OpenAI's servers | A paid API key in `.env` | `node server.js` |

For Claude or OpenAI:

1. Copy `.env.example`, name the copy `.env`, and paste your key after the `=` sign.
2. Stop the Python server if it is running (Ctrl+C), then run `node server.js`.
3. Open <http://localhost:8000>.

**Never put an API key in `script.js`, and never commit `.env`.** Anyone can read a web page's
JavaScript. `server.js` keeps the key on your computer, and `.gitignore` keeps `.env` out of Git.

## If the model does not answer

| Message | What to check |
|---|---|
| `Failed to fetch` with Ollama | Is Ollama running? Open <http://localhost:11434>. It should say "Ollama is running". |
| `model ... not found` | Run `ollama pull gemma3:1b`, or change `OLLAMA_MODEL` to a model you have (`ollama list`). |
| `No ANTHROPIC_API_KEY in your .env file` | The file must be named exactly `.env`, sit next to `server.js`, and you must restart `node server.js` after editing it. |
| `Unexpected token '<'` with Claude or OpenAI | You are using the Python server. Stop it and run `node server.js`. |
| An error about credit or billing | Cloud models are paid. Add credit in the provider's console. |
| A model name error | Model names change. Update `CLAUDE_MODEL` or `OPENAI_MODEL` in `server.js` from the provider's model list. |

## Credits

Glasses model by Boyd Branch. The facts in `data/facts.json` each link to their source. They are
about camera glasses, voice assistants and rare earths in general; the hardware details come
from published specifications of the Rokid Glasses.

In your own project, the visuals must be made by you.
