# Event Contracts

> Every custom event, postMessage protocol, and non-DOM-standard event listener in the Olivia frontend.
> Phase 2 deliverable: generated from frontend code inspection.
> **Confidence:** [verified] = dispatch + listener both found; [partial] = one side only.

---

## Custom DOM Events

Events dispatched via `window.dispatchEvent(new Event(...))` or `window.dispatchEvent(new CustomEvent(...))`.

### olivia: namespace

| Event | Dispatched by | Listeners | Detail | Confidence |
|-------|--------------|-----------|--------|------------|
| `olivia:lang-changed` | i18n system | stream.js:4555, trunk.js:143, agents.js:1613, agent-orchestration.js:706 | none | [verified] |
| `olivia:panel-context-updated` | stream.js:1082 | shaders.js:462, studio.js:1417 | `{ detail: data }` (panel context data) | [verified] |
| `olivia:browser-shared` | output.js:561 | unknown | `{ detail: { url, title } }` | [partial] — dispatched, no consumer found |
| `olivia:browser-bridge-ready` | output.js:724 | unknown | `{}` | [partial] — dispatched, no consumer found |

### LA8159: namespace

| Event | Dispatched by | Listeners | Detail | Confidence |
|-------|--------------|-----------|--------|------------|
| `LA8159:panel-context-updated` | stream.js:1083 | endpoint-widget.js:96, memory.js:81, api-explorer.js:96 | `{ detail: data }` (panel context data) | [verified] |
| `LA8159:pinned-paths-updated` | stream.js:253,264,270 | docs.js:950 | `{ detail: string[] }` (pinned paths) | [verified] |
| `LA8159:orchestration-probe` | stream.js:755 | unknown | `{ detail: probe }` (orchestration data) | [partial] — dispatched, no consumer found |

### sh3d: namespace

| Event | Dispatched by | Listeners | Detail | Confidence |
|-------|--------------|-----------|--------|------------|
| `sh3d:extras-changed` | scene3d.js:250,1766 | shaders.js:4303, remote-bus-desktop.js:196 | none (Event, not CustomEvent) | [verified] |
| `sh3d:selection-changed` | scene3d.js:1868 | shaders.js:4306, remote-bus-desktop.js:195 | none (Event, not CustomEvent) | [verified] |
| `sh3d:transform-mode-changed` | scene3d.js:1925 | unknown | none (Event) | [partial] — dispatched, no consumer found |

### kout: namespace

| Event | Dispatched by | Listeners | Detail | Confidence |
|-------|--------------|-----------|--------|------------|
| `kout:tool-call` | unknown (external/agent system) | meshy-ui.js:144 | unknown | [partial] — only listener found |

---

## postMessage Protocols

### Olivia Browser Bridge (iframe control)

**File:** `output.js`

Embeds an injected script into iframed preview pages that communicates via `postMessage`:

```
Page → Olivia:
  { _oliviaBridge: true, id, action, selector, ...args }

Olivia → Page:
  { _oliviaBridge: true, _oliviaBridgeReply: true, id, result }
```

Olivia listens on `window.addEventListener('message', onMsg)` at output.js:773 and sends commands via `frame.contentWindow.postMessage(msg, '*')` at output.js:781.

### Studio Agent Message

**File:** `studio.js:1786-1799`

Studio listens for messages from preview iframes and can send `olivia-agent-message` back:

```
Studio → Preview:
  { type: 'olivia-agent-message', text: String(replyText) }
```

---

## Non-Standard Event Listeners

These listeners use standard DOM events but for non-standard purposes:

| Event | File:line | Purpose |
|-------|-----------|---------|
| `visibilitychange` | tabs.js:432, section-views.js:54, section-views.js:275, output.js:499 | Panel/UI state refresh on tab visibility change |
| `storage` | shaders.js:3818 | Cross-tab scene state sync via localStorage |
| `selectionchange` | stream.js:841 | Track text selection in chat for copy/paste |

---

## Summary

- **4 event namespaces:** `olivia:`, `LA8159:`, `sh3d:`, `kout:`
- **11 custom events total** (10 with dispatch confirmed, 1 listener-only)
- **4 events with no known consumers** (potentially dead or externally consumed): `olivia:browser-shared`, `olivia:browser-bridge-ready`, `LA8159:orchestration-probe`, `sh3d:transform-mode-changed`
- **2 postMessage protocols:** Olivia Browser Bridge, Studio Agent Message
- **No BroadcastChannel usage** found
- **No WebSocket custom events** found (WebSocket used only by RunPod log receiver)
