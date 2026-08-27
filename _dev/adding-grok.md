xai-3xJ475QSK5V7CAVadIpPVoIRv0dmQwkbMJVN7FVjkpxNHeoBHequIs2dSVBnHAPH29kBMmYbOzvrNrMi

python
import os
from xai_sdk import Client
from xai_sdk.chat import user

client = Client(api_key="xai-3xJ475QSK5V7CAVadIpPVoIRv0dmQwkbMJVN7FVjkpxNHeoBHequIs2dSVBnHAPH29kBMmYbOzvrNrMi", api_host="api.x.ai")

chat = client.chat.create(model="grok-4.6")
chat.append(user("Fix this function and explain the bug: function median(a){a.sort();return a[a.length/2]}"))

response = chat.sample()

print(response.content)


Code
javascript
import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";

const xai = createXai({ baseURL: "https://api.x.ai/v1" });

const { text } = await generateText({
  model: xai.responses("grok-4.6"),
  prompt: "Fix this function and explain the bug: function median(a){a.sort();return a[a.length/2]}",
});

console.log(text);














chat
javascript
import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";

const xai = createXai({ baseURL: "https://api.x.ai/v1" });

const { text } = await generateText({
  model: xai.responses("grok-4.6"),
  instructions: "You are Grok, a highly intelligent, helpful AI assistant.",
  prompt: "What is the meaning of life, the universe, and everything?",
});

console.log(text);


Image
javascript
import { createXai } from "@ai-sdk/xai";
import { generateImage } from "ai";
import fs from "fs";

const xai = createXai({ baseURL: "https://api.x.ai/v1" });

const { images } = await generateImage({
  model: xai.image("grok-imagine-image-quality"),
  prompt: "A serene mountain lake at sunset",
  providerOptions: {
    xai: { quality: "high" },
  },
});

fs.writeFileSync("output.jpg", Buffer.from(images[0].base64, "base64"));
console.log(`Saved ${images[0].mediaType} to output.jpg`);


Voice
javascript
import fs from "fs";

const response = await fetch("https://api.x.ai/v1/tts", {
  method: "POST",
  headers: {
    Authorization: `Bearer xai-3xJ475QSK5V7CAVadIpPVoIRv0dmQwkbMJVN7FVjkpxNHeoBHequIs2dSVBnHAPH29kBMmYbOzvrNrMi`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: "Hello! Welcome to the xAI Text to Speech API.",
    voice_id: "eve",
    language: "en",
  }),
});

if (!response.ok) throw new Error(`TTS error ${response.status}`);

const buffer = Buffer.from(await response.arrayBuffer());
fs.writeFileSync("hello.mp3", buffer);
console.log(`Saved ${buffer.length.toLocaleString()} bytes to hello.mp3`);













Video
javascript
// 1. Start generation
const start = await fetch("https://api.x.ai/v1/videos/generations", {
  method: "POST",
  headers: {
    Authorization: `Bearer xai-3xJ475QSK5V7CAVadIpPVoIRv0dmQwkbMJVN7FVjkpxNHeoBHequIs2dSVBnHAPH29kBMmYbOzvrNrMi`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "grok-imagine-video",
    prompt: "A glowing crystal-powered rocket launching from Mars",
  }),
});

if (!start.ok) throw new Error(`Video start error ${start.status}`);
const { request_id } = await start.json();

// 2. Poll until done (or failed / expired)
let result;
while (true) {
  await new Promise(r => setTimeout(r, 5000));
  const poll = await fetch(`https://api.x.ai/v1/videos/${request_id}`, {
    headers: { Authorization: `Bearer xai-3xJ475QSK5V7CAVadIpPVoIRv0dmQwkbMJVN7FVjkpxNHeoBHequIs2dSVBnHAPH29kBMmYbOzvrNrMi` },
  });
  if (!poll.ok) throw new Error(`Video poll error ${poll.status}`);
  result = await poll.json();
  if (result.status === "done") break;
  if (result.status === "failed" || result.status === "expired") {
    throw new Error(`Video generation ${result.status}`);
  }
}

console.log(result.video.url);

<>

#### Getting Started

# Grok Build

Grok Build is a powerful and extensible coding agent. Use it via an interactive TUI, headlessly in scripts or bots, or through the Agent Client Protocol (ACP) in other apps.

The TUI provides a rich, mouse-interactive, fullscreen experience for coding with agents.

## Install

```bash customLanguage="bashMacLinux"
curl -fsSL https://x.ai/cli/install.sh | bash
```

```bash customLanguage="powershell"
irm https://x.ai/cli/install.ps1 | iex
```

## Start an interactive session

```bash customLanguage="bash"
cd your-project
grok
```

On first launch, Grok opens a browser for authentication. In non-browser environments, use an API key:

```bash customLanguage="bash"
export XAI_API_KEY="xai-..."
grok
```

Useful first prompts:

```text
Explain this repo.
@src/main.rs Walk me through this file.
```

## Run headlessly

```bash customLanguage="bash"
grok -p "Explain this codebase"
grok -p "Explain the architecture" --output-format streaming-json
```

Headless usage is ideal for scripts, automations, or integration into other apps.

## Custom models

Grok supports any custom model. Add it to your user-level config file, `~/.grok/config.toml` (on Windows, `%USERPROFILE%\.grok\config.toml`):

```text
[model.my-model]
model = "model-id"
base_url = "https://api.example.com/v1"
name = "Display Name"
env_key = "API_KEY"

[models]
default = "my-model"
```

After updating `~/.grok/config.toml`, use `grok inspect` to see what Grok discovered in the current directory, including config sources, instructions, skills, plugins, hooks, and MCP servers, then pick the model in headless mode or in the TUI:

```bash customLanguage="bash"
grok inspect
grok -p "Hello" -m my-model
```

You can also switch inside the TUI with `/model <name>`.

## Use Grok 4.6 on the API

The same model that powers Grok Build, [`grok-4.6`](/developers/models/grok-4.6), is also available directly on the xAI API. Drop it into your own agent loop, IDE integration, or coding tool.

```bash customLanguage="bash"
curl https://api.x.ai/v1/responses \
  -H "Authorization: Bearer $XAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-4.6",
    "input": "Fix this function and explain the bug: function median(a){a.sort();return a[a.length/2]}"
  }'
```

```python customLanguage="pythonXAI"
import os
from xai_sdk import Client
from xai_sdk.chat import user

client = Client(api_key=os.getenv("XAI_API_KEY"))

chat = client.chat.create(model="grok-4.6")
chat.append(user("Fix this function and explain the bug: function median(a){a.sort();return a[a.length/2]}"))

print(chat.sample().content)
```

```python customLanguage="pythonOpenAISDK"
from openai import OpenAI

client = OpenAI(
    api_key="<YOUR_XAI_API_KEY_HERE>",
    base_url="https://api.x.ai/v1",
)

response = client.responses.create(
    model="grok-4.6",
    input="Fix this function and explain the bug: function median(a){a.sort();return a[a.length/2]}",
)

print(response.output_text)
```

```javascript customLanguage="javascriptAISDK"
import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';

const { text } = await generateText({
  model: xai.responses('grok-4.6'),
  prompt: 'Fix this function and explain the bug: function median(a){a.sort();return a[a.length/2]}',
});

console.log(text);
```

## Next

* [Skills, Plugins & Marketplaces](/build/features/skills-plugins-marketplaces)
* [Modes and Commands](/build/modes-and-commands)
* [Headless & Scripting](/build/cli/headless-scripting)
* [Enterprise Deployments](/build/enterprise)
* [Grok Bot](/grok-bot/overview) — AI teammates on a cloud computer
