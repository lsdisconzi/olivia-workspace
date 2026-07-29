Based on your logs and the comprehensive indexing you’ve already built, I’ll outline a development strategy that solves the performance bottlenecks and turns your agent into a fast, scalable assistant. The core idea is a **hybrid approach**: use the **static project index** for instant, cacheable overviews and **MCP-powered Qdrant retrieval** for detailed code snippets. This will cut prompt tokens from tens of thousands to a few hundred, eliminate timeouts, and let you leverage the 256 MCP tools you already have.

---

## 1. Problem Recap (From Your Logs)
- **Massive raw code dumps** (10k–50k tokens per request) → prompt processing at ~3 t/s → 3‑5 minute wait times and 500 errors.
- **Unbounded conversation history** adds thousands of new tokens each turn.
- **MLX backend** has slow prompt eval compared to llama.cpp (GGUF) with Metal.

**Root cause**: you’re feeding the LLM the entire source code instead of structural summaries.

---

## 2. Proposed Architecture: Hybrid (Static Index + Dynamic Retrieval)

| Component | Purpose | Size | Caching |
|-----------|---------|------|---------|
| **Static Project Index** (root `project-index.json` or per‑folder indexes) | High‑level structure, modules, symbols, dependency graphs | ~200‑500 tokens | **Cached** by Ollama (same system prompt across requests) |
| **MCP Tools (Qdrant search, ingestion)** | Retrieve exact code snippets, function definitions, cross‑references on demand | ~1‑3 k tokens per query | Not cached (per‑query) but only used when needed |
| **Conversation History** | Last 2‑3 exchanges | ~1 k tokens | Not cached but stable |

This leverages Ollama’s **KV cache** for the static part and uses semantic search only for deep dives.

---

## 3. Implementation Plan (Phased)

### Phase 1: Static Index Integration (Immediate Fix)

**Goal**: Replace raw code injection with a compact JSON index.

1. **Create a prompt builder** in `serve.py` (or your chat handler) that loads the relevant index file.  
   - Use the root `project-index.json` (or the per‑folder indexes in `config/index-project/`).  
   - Extract only the most useful fields: `tree`, `modules`, `symbols_index`, `js_cross_module_graph`.  
   - Serialize compactly (no extra whitespace) and embed in the system message.

   ```python
   def build_indexed_system_prompt() -> str:
       with open("project-index.json") as f:
           index = json.load(f)
       summary = {
           "tree": index.get("tree", {}),
           "modules": index.get("modules", {}),
           "symbols_index": index.get("symbols_index", {}),
           "js_cross_module_graph": index.get("js_cross_module_graph", {}),
       }
       context_json = json.dumps(summary, separators=(',', ':'))
       return (
           "You are Olivia, a legal‑tech assistant. You have a complete structural index of the Olivia project.\n"
           f"Project index (JSON):\n```json\n{context_json}\n```\n\n"
           "Use this index for high‑level questions. For detailed code, you may use MCP tools (garage-qdrant search, etc.)."
       )
   ```

2. **Limit conversation history** to the last 2‑3 user‑assistant exchanges to prevent growth.

3. **Increase Ollama context size** to accommodate the index + snippets:
   ```bash
   export OLLAMA_NUM_CTX=8192   # or 16384 if you plan to load multiple folder indexes
   ```
   Add this to `start-all.sh` alongside `OLLAMA_KEEP_ALIVE=-1`, `OLLAMA_FLASH_ATTENTION=1`, `OLLAMA_KV_CACHE_TYPE=q8_0`.

4. **Switch to the GGUF version** of `gemma4:12b` for much faster prompt processing:
   ```bash
   ollama pull gemma4:12b
   ```
   Update your agent’s model name accordingly.

5. **Automate index generation** in `start-all.sh` with a new `--index` flag:
   ```bash
   # Add to argument parsing
   RUN_INDEXER=0
   case $1 in
       --index) RUN_INDEXER=1; shift ;;
       ...
   esac
   # After venv setup, before serve.py
   if [[ $RUN_INDEXER -eq 1 ]]; then
       "$PYTHON" "$PROJECT_ROOT/index_project.py" --project-root "$PROJECT_ROOT"
   fi
   ```

**Expected outcome after Phase 1**:
- First request: ~1‑2s (cache miss on small index).
- Subsequent requests: < 1s (cached).
- No more timeouts.

---

### Phase 2: MCP Tool Integration for Qdrant RAG

**Goal**: Enable the agent to fetch detailed code snippets on demand, using your existing MCP services.

1. **Index all project source code into Qdrant** (if not already).  
   Use the `garage-ingestion` MCP tools (e.g., `ingest_document`) to upload every `.py`, `.js`, `.html`, `.md`, etc. from all projects (Olivia, transcription, juris‑search, Garge, etc.) into dedicated Qdrant collections.

   You can write a one‑time script (or use the existing `extract_*` scripts) to walk directories and call the MCP ingestion endpoint.

2. **Ensure your agent runtime can call MCP tools**.  
   Your ecosystem already has a full MCP client configuration (see `agents-groups/_meta/policies/mcp-bootstrap/`).  
   If you’re using OpenClaude, add the `mcp.json` to the project or global config. The agent will then have functions like:
   - `garage-qdrant search`
   - `garage-ingestion ingest_document`
   - `juris-search search`

3. **Update the system prompt** to instruct the agent to use these tools for detailed questions.  
   For example:
   ```
   When asked about specific code (functions, endpoints, implementation details), use the 'garage-qdrant search' tool with a natural language query. For broader context, refer to the static index.
   ```

4. **Implement the function‑calling loop** in `serve.py`:  
   - Receive user query.
   - Send system + last few messages + query to the model (with tools enabled).
   - If the model calls a tool, execute it (via your MCP bridge), append the result to the conversation, and send again.
   - Return the final answer.

   Your `start-all.sh` already launches the MCP bridge (`streamable_bridge.py`). Use its endpoint to forward tool calls.

**Expected outcome after Phase 2**:
- Agent can answer specific questions about any project (e.g., “show me the transcription diarization code”) by retrieving exactly the relevant snippets.
- Prompt size remains small because only retrieved snippets are added.

---

### Phase 3: Optimization and Monitoring

1. **Set up logging** for token counts and response times (you already have some). Add a simple metric to track prompt size per request.

2. **Tune Qdrant collections**:
   - Choose appropriate embedding models (e.g., `all-MiniLM-L6-v2`).
   - Set chunk size (e.g., 512 tokens) for code files.

3. **Evaluate the hybrid system**:  
   - Test with typical queries (e.g., “what does the agent‑orchestration module do?” → static index).  
   - Test with deep queries (e.g., “show me the implementation of `sendMessage` in chat stream”) → triggers a Qdrant search.

4. **Consider incremental indexing**: use file‑system watchers or periodic cron jobs to keep Qdrant up‑to‑date.

---

## 4. Detailed Action Items

| Task | Files to Change | Command / Code Snippet |
|------|----------------|------------------------|
| **Prompt builder** | `serve.py` (or chat route) | `build_indexed_system_prompt()` as above. |
| **Ollama context** | `start-all.sh` | Add `export OLLAMA_NUM_CTX=8192`. |
| **Model switch** | Agent config | `model: "gemma4:12b"` (GGUF version). |
| **Index flag** | `start-all.sh` | Add `--index` case and run `index_project.py`. |
| **History truncation** | Chat logic | Keep only last 3 exchanges. |
| **MCP tool registration** | Agent runtime config | Add `mcp.json` from `agents-groups/_meta/policies/mcp-bootstrap/`. |
| **One‑time code indexing** | Script (e.g., `index_all_projects.py`) | Walk `config/index-project/` to get project roots, then call `garage-ingestion ingest_document` via MCP for each source file. |
| **Tool‑calling loop** | `serve.py` | Implement loop: model → tool call → execute → append → model. |

---

## 5. Testing and Validation

- **Performance**: Run a set of 10 common queries and measure response times (aim for < 2s).  
- **Accuracy**: Verify that answers referencing code snippets are correct (compare with actual source).  
- **Resource usage**: Monitor memory and VRAM during load (the GGUF model with 8k context should stay well within 16 GiB).

---

## 6. Expected Outcomes

- First request: **< 2 seconds** (index cache miss).  
- Subsequent requests: **< 0.5 s** (cached).  
- No 500 timeouts.  
- The agent can answer both high‑level structural questions and detailed code‑level questions across all your projects.  
- Your existing MCP and Qdrant infrastructure becomes fully utilised, future‑proofing for new projects.

---

## 7. Next Steps

1. **Implement Phase 1** (static index) today – it’s the highest impact and easiest.
2. **Test thoroughly** with a few queries to confirm speed improvement.
3. **Proceed to Phase 2** (MCP integration) over the next sprint.
4. **Monitor and fine‑tune** Qdrant indexing and retrieval quality.

You already have all the pieces; now it’s a matter of wiring them together. This strategy leverages your existing investment and will make your agent feel like a true augmentation to your workflow.