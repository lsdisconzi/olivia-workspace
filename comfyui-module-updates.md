This is a brilliant next step. The image clearly shows the challenge: you have the native ComfyUI UI open in the browser panel (`localhost:8188`), and the Olivia ComfyUI Workflow Editor (left) is currently a standalone visualizer without a live connection to the backend.

Since the MCP tools are already built and exposed (`mcp/servers/workflow_server.py`, etc.), we need to bridge two gaps:
1. **Data Sync**: Pull the current/latest workflow from the ComfyUI server into the Olivia Editor, and push edits back to the queue.
2. **Agentic Control**: Expose these operations to the LLM so the agent can orchestrate modifications.

Here is the concrete plan to upgrade the `comfyui-workflow.js` and the backend proxy to achieve bidirectional sync.

### 1. Add "Sync from Server" and "Queue to Server" to the UI
In `comfyui-workflow.js`, update the `<div class="cf-head-actions">` block inside the `build()` function to include two new buttons:

```javascript
/* Inside build() function, update the cf-head-actions innerHTML */
'<div class="cf-head-actions">' +
'<span class="cf-head-stats" id="cfHeadStats"></span>' +
/* NEW SYNC & QUEUE BUTTONS */
'<button class="btn btn-sm" onclick="comfyuiSyncFromServer()" title="Load the last workflow from ComfyUI server">' +
'<i class="fas fa-cloud-download-alt"></i> Sync</button>' +
'<button class="btn btn-sm" onclick="comfyuiQueueToServer()" title="Queue current workflow to ComfyUI server">' +
'<i class="fas fa-cloud-upload-alt"></i> Queue</button>' +
/* Existing buttons */
'<button class="btn btn-sm" onclick="comfyuiImportWorkflow()" title="Import workflow JSON">' +
ICONS.import + ' Import</button>' +
...
```

### 2. Implement the Sync & Queue Logic
Add these two new functions to `comfyui-workflow.js`. They rely on a backend proxy that forwards requests to `COMFYUI_BASE_URL` (to avoid CORS issues).

```javascript
// Sync the latest executed workflow from the ComfyUI server's history
window.comfyuiSyncFromServer = async function () {
    // Fetch history list
    const histResp = await fetch('/api/comfyui/history');
    const history = await histResp.json();
    const promptIds = Object.keys(history);
    if (promptIds.length === 0) {
        alert('No history found on the ComfyUI server.');
        return;
    }
    
    // Get the most recent prompt_id
    const lastId = promptIds[promptIds.length - 1];
    const promptResp = await fetch(`/api/comfyui/history/${lastId}`);
    const promptData = await promptResp.json();
    
    // ComfyUI history returns { prompt: { ... }, outputs: ... }
    // The 'prompt' object IS the workflow structure.
    const serverWorkflow = promptData.prompt;
    
    if (!serverWorkflow || !serverWorkflow.nodes) {
        alert('Invalid workflow structure from server.');
        return;
    }

    // Load it into the editor
    workflow = serverWorkflow;
    selectedNodeId = null;
    searchQuery = '';
    expandedMaskCards = new Set();
    lastMaskTestResult = null;
    scale = 0;      // triggers auto-fit
    offset = null;  // triggers auto-center
    
    var searchInput = document.getElementById('cfSearchInput');
    if (searchInput) searchInput.value = '';
    
    renderGraph();
    if (activePanel === 'masks') renderMaskPipeline();
    addSystemBubble('Workflow synced from ComfyUI server history.');
};

// Queue the current workflow to the ComfyUI server for execution
window.comfyuiQueueToServer = async function () {
    if (!workflow) {
        alert('No workflow loaded to queue.');
        return;
    }
    
    const resp = await fetch('/api/comfyui/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow })
    });
    
    if (resp.ok) {
        addSystemBubble('Workflow successfully queued to ComfyUI server!');
        // The native ComfyUI UI in your browser panel will now show the new job queued/running.
    } else {
        const err = await resp.text();
        addSystemBubble('Failed to queue workflow: ' + err);
    }
};
```

### 3. The Backend Proxy Layer (Bridge)
Since the frontend runs on the Olivia port (e.g., `3000`), it cannot directly call `http://localhost:8188/history` due to CORS. You need a proxy in your Olivia backend (e.g., `server.py` or `api.py`). Since you already have `mcp/servers/common.py` which acts as an HTTP client, you can simply add these endpoints:

```python
# Add to your main backend routing (e.g., FastAPI/Flask)
from mcp.servers.common import ComfyUIHTTPClient
import os

COMFYUI_BASE_URL = os.getenv("COMFYUI_BASE_URL", "http://127.0.0.1:8188")
client = ComfyUIHTTPClient(COMFYUI_BASE_URL)

@app.get("/api/comfyui/history")
async def get_history():
    return client.get("/history")

@app.get("/api/comfyui/history/{prompt_id}")
async def get_history_item(prompt_id: str):
    return client.get(f"/history/{prompt_id}")

@app.post("/api/comfyui/queue")
async def queue_prompt(prompt: dict):
    return client.post("/queue", json_data=prompt)
```

### 4. Empowering the Agent with the MCP Tools
The user wants the agent to "properly manipulate" ComfyUI. To do this, the Agent (using OpenClaude) must be aware of the MCP tools. You already have the tool definitions in `readiness_report.json` (e.g., `comfyui_list_jobs`, `comfyui_get_queue`, `comfyui_clear_queue`).

You need to register these tools with your LLM client when the agent starts a run. For example, if using OpenClaude:

```javascript
// In your backend's agent initialization (when the user sends a message)
const tools = [
  {
    name: "comfyui_queue_workflow",
    description: "Queue a workflow JSON to the ComfyUI server for execution.",
    input_schema: {
      type: "object",
      properties: {
        workflow: { type: "object", description: "The ComfyUI workflow JSON" }
      },
      required: ["workflow"]
    }
  },
  {
    name: "comfyui_list_history",
    description: "List all past executed workflows on the ComfyUI server.",
    input_schema: { type: "object" }
  },
  {
    name: "comfyui_get_history",
    description: "Get a specific workflow by prompt_id from the history.",
    input_schema: {
      type: "object",
      properties: { prompt_id: { type: "string" } },
      required: ["prompt_id"]
    }
  }
  // ... add other tools from your MCP servers
];
```

**The Agent Flow:**
1. The user asks: *"Run the last workflow but change the seed to 42 and queue it."*
2. The agent calls `comfyui_list_history` to get the latest `prompt_id`.
3. The agent calls `comfyui_get_history(prompt_id)` to fetch the workflow JSON.
4. The agent modifies the seed in the `widgets_values` array within the JSON.
5. The agent calls `comfyui_queue_workflow` with the modified JSON.

### Summary of Changes
- **UI**: Added **Sync** and **Queue** buttons to the Olivia Editor.
- **JS**: Added functions to fetch history/queue via a backend proxy.
- **Backend**: Exposed `/api/comfyui/history` and `/api/comfyui/queue` endpoints using the existing `common.py` client.
- **Agent**: Registered the MCP tools to the LLM, enabling natural language control over the ComfyUI server.

This turns the visual editor into a real, bidirectional dashboard that matches the work happening in `localhost:8188`, while giving the LLM full programmatic control through the MCP layer.