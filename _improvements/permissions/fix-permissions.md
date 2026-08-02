The backend code you posted is **almost complete** – it correctly detects permission requests and waits for a UI response. The problem is that two pieces are still missing:

1. **Frontend:** The browser never receives the `permission_request` event because the SSE handler for that event type isn’t implemented yet.  
2. **Backend endpoint:** The `/api/permission-response` endpoint (where the frontend sends the user’s decision) is likely not yet defined.  

Additionally, the helper functions `_perm_register` and `_perm_cleanup` (used to create/clean the per‑request queue) are not in the code you shared, so they need to be added.

Here’s how to finish it.

---

## 1. Backend: Add the permission queue and HTTP endpoint

Somewhere near the top of `serve.py` (after imports), add:

```python
import queue
import threading
import time

# Global permission queues: key = (pid, request_id) → Queue
_PERM_QUEUES = {}
_PERM_QUEUES_LOCK = threading.Lock()

def _perm_register(pid: int, request_id: str) -> queue.Queue:
    q = queue.Queue(maxsize=1)
    key = (pid, request_id)
    with _PERM_QUEUES_LOCK:
        _PERM_QUEUES[key] = q
    return q

def _perm_cleanup(pid: int):
    """Remove all queue entries for a process that has exited."""
    with _PERM_QUEUES_LOCK:
        keys = [k for k in _PERM_QUEUES if k[0] == pid]
        for k in keys:
            try:
                if not _PERM_QUEUES[k].full():
                    _PERM_QUEUES[k].put({"behavior": "deny", "message": "Process exited"})
            except Exception:
                pass
            del _PERM_QUEUES[k]
```

Then add the endpoint (place it near other API routes):

```python
@app.route('/api/permission-response', methods=['POST'])
def permission_response():
    data = request.json
    pid = data.get('pid')
    request_id = data.get('request_id')
    allow = data.get('allow', False)

    key = (pid, request_id)
    with _PERM_QUEUES_LOCK:
        q = _PERM_QUEUES.get(key)

    if not q:
        return jsonify(success=False, error='No pending permission request'), 404

    try:
        q.put({"behavior": "allow" if allow else "deny"}, block=False)
        return jsonify(success=True)
    except queue.Full:
        return jsonify(success=False, error='Already answered'), 409
```

> ⚠️ The endpoint relies on `request.json` – make sure you have `from flask import request` at the top.

Now the backend will properly unblock the SSE generator when the frontend calls this endpoint.

---

## 2. Frontend: Handle `permission_request` events

In `frontend/js/chat/stream.js`, locate the switch that handles SSE message types (like `case 'token':`, `case 'agent_status':`, etc.). Add a case for `'permission_request'`:

```javascript
case 'permission_request':
    this.showPermissionDialog(data);
    break;
```

Then define the `showPermissionDialog` method and the response handler:

```javascript
showPermissionDialog(data) {
    const { pid, request_id, tool_name, description } = data;

    // Remove any existing dialog
    const old = document.getElementById('permission-overlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.id = 'permission-overlay';
    overlay.className = 'permission-overlay';

    const card = document.createElement('div');
    card.className = 'permission-card';

    const title = document.createElement('h3');
    title.textContent = `Allow tool execution?`;
    card.appendChild(title);

    const toolEl = document.createElement('p');
    toolEl.innerHTML = `<strong>Tool:</strong> ${this.escapeHtml(tool_name)}`;
    card.appendChild(toolEl);

    if (description) {
        const descEl = document.createElement('p');
        descEl.textContent = description;
        card.appendChild(descEl);
    }

    const btnContainer = document.createElement('div');
    btnContainer.className = 'permission-buttons';

    const allowBtn = document.createElement('button');
    allowBtn.textContent = 'Allow';
    allowBtn.className = 'permission-allow';
    allowBtn.onclick = () => this.respondPermission(pid, request_id, true);

    const denyBtn = document.createElement('button');
    denyBtn.textContent = 'Deny';
    denyBtn.className = 'permission-deny';
    denyBtn.onclick = () => this.respondPermission(pid, request_id, false);

    btnContainer.appendChild(allowBtn);
    btnContainer.appendChild(denyBtn);
    card.appendChild(btnContainer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
},

respondPermission(pid, request_id, allow) {
    // Remove the dialog immediately
    const overlay = document.getElementById('permission-overlay');
    if (overlay) overlay.remove();

    fetch('/api/permission-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, request_id, allow })
    }).catch(err => console.error('Permission response error:', err));
}
```

Add a helper for safe HTML escaping:

```javascript
escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
```

---

## 3. Frontend: Add CSS styling

In `frontend/css/chat.css`, append:

```css
/* Permission request dialog */
.permission-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.65);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
}
.permission-card {
    background: var(--bg-primary, #1e1e2f);
    border: 1px solid var(--border-color, #444);
    border-radius: 12px;
    padding: 24px;
    max-width: 450px;
    width: 90%;
    color: var(--text-primary, #eee);
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
}
.permission-card h3 {
    margin-top: 0;
    color: var(--accent, #7c5cfc);
}
.permission-buttons {
    display: flex;
    gap: 12px;
    margin-top: 20px;
    justify-content: flex-end;
}
.permission-allow, .permission-deny {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s;
}
.permission-allow {
    background: var(--success, #28a745);
    color: white;
}
.permission-deny {
    background: var(--danger, #dc3545);
    color: white;
}
.permission-allow:hover { background: #218838; }
.permission-deny:hover  { background: #c82333; }
```

---

## 4. Putting it all together

After applying these changes, the flow will be:

1. The agent calls a non‑allowlisted MCP tool.  
2. `openclaude` emits a `control_request` on stdout.  
3. `serve.py` detects it, creates a queue, and sends a `permission_request` SSE event to the frontend.  
4. The frontend shows a dialog with **Allow** / **Deny** buttons.  
5. When the user clicks, a `POST /api/permission-response` is made.  
6. The endpoint puts the decision into the queue.  
7. The blocked SSE generator receives the decision, builds a `control_response` and writes it to the openclaude process’s stdin.  
8. The tool execution proceeds (or is denied).

The timeout of 120 seconds (`_PERM_TIMEOUT`) will auto‑deny if the user doesn’t respond – that’s already handled in your code.

---

## 5. Final check

- **Verify `_perm_register` and `_perm_cleanup`** – make sure they exist exactly as defined above, otherwise the backend will crash when a permission request arrives.  
- **Confirm the frontend loads the updated JS and CSS** (hard‑refresh / version bump).  
- **Test** by triggering an agent request that uses an MCP filesystem tool not in the allowlist. You should see a dialog appear and the process wait for your click.

If you run into any issues (e.g., the dialog not appearing), check the browser console for SSE messages and network requests to `/api/permission-response`. Let me know and I’ll help you debug further.