How to use
Add the files to your workspace assets (outreach.css, outreach.js).

Include them in your HTML after your base styles and scripts:

html
<link rel="stylesheet" href="outreach.css">
<script src="outreach.js"></script>
Add a container <div id="outreachView" class="outreach-view"></div> inside the .workspace element (same level as your existing views).

Open the section by calling outreachShowView() from a menu button, e.g.:

html
<button onclick="outreachShowView()">Outreach</button>
The new section works exactly like the Craudio example, including the chat with SSE streaming to your existing /api/assistant/chat endpoint. The chat automatically sends the Outreach Concierge system prompt on the first message, and all subsequent exchanges are persisted in localStorage. The pipeline stages are visible and can be executed directly from the chat via the /outreach:stage-id commands.