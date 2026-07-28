## Overview

You are running **Gemma 4** (a 7.5B parameter multimodal model with vision and audio) on an **Apple M2 Pro** with 16 GB unified memory, using Metal GPU acceleration. The logs capture initial load, two chat completion requests, and some background API calls.

## ✅ Implemented Changes (2026-07-28)

The following fixes have been applied to `serve.py`:

| Fix | Change | Status |
|-----|--------|--------|
| **API endpoint** | `OPENAI_BASE_URL` now includes `/v1` suffix so OpenClaude routes to `/v1/chat/completions` | Done |
| **Large context window** | `num_ctx: 32768` is sent in Ollama request payload (via `OLLAMA_NUM_CTX` env var) | Done |
| **Keep model alive** | `keep_alive: "24h"` sent in Ollama request payload (via `OLLAMA_KEEP_ALIVE` env var) | Done |

### Environment Variables

```bash
# Server-side (set before starting ollama serve):
OLLAMA_KEEP_ALIVE=-1   # keep model in memory permanently (server-level)

# Client-side (set before starting python serve.py):
OLLAMA_NUM_CTX=32768   # context window (default, already set in code)
OLLAMA_KEEP_ALIVE=24h  # keep model alive between requests (default, already set in code)
```

---

## Problems & Warnings

### 1. Incorrect API Endpoint → 404 Errors
Several requests hit `POST "/chat/completions"` and receive an immediate **404**.
- **Impact**: Failed requests; clients see errors.
- **Root cause**: Ollama’s OpenAI‑compatible endpoint is `/v1/chat/completions`, not `/chat/completions`.
- **Log evidence**:  
  `[GIN] 2026/07/28 - 17:21:32 | 404 | 11.583µs | POST "/chat/completions"`

### 2. Severe Prompt Truncation (Loss of Input)
```
WARN truncating input prompt limit=2051 prompt=8950 keep=5 new=2051
```
- **Impact**: Long prompts (8950 tokens) are brutally truncated to only **2051 tokens**, discarding over 75% of the input. This will severely degrade response quality and context coherence.
- **Why it happens**: With `num_ctx = 4096`, Ollama reserves half the context for generation when the client requests a large `max_tokens` (default often 2048). The available prompt space becomes `4096 - max_tokens - overhead ≈ 2051`.
- **Deeper issue**: The model itself supports **131,072 tokens** (`n_ctx_train = 131072`), yet only 4096 are configured. The log explicitly warns:  
  `n_ctx_seq (4096) < n_ctx_train (131072) -- the full capacity of the model will not be utilized`

### 3. KV Cache Shifting Disabled
```
KV cache shifting is not supported for this context, disabling KV cache shifting
```
- **Impact**: When the context window fills, the server cannot automatically shift out old tokens while preserving the cache. This can hurt long‑conversation performance.

### 4. Prompt Cache Invalidated Due to SWA/Hybrid Memory
```
forcing full prompt re-processing due to lack of cache data
(likely due to SWA or hybrid/recurrent memory, see …)
```
- **Impact**: Even though a prompt cache is saved (81 MiB), it is completely invalidated on the next request because Gemma 4 uses sliding window attention (SWA) and hybrid layers. This forces the model to **re‑evaluate the entire prompt from scratch** every time, wasting compute and adding latency.
- **Consequence**: The second request (after the first had just finished) re‑processed 2051 tokens at ~285 t/s, which could have been avoided with a working cache.

### 5. Frequent Model Reloads – High Cold‑Start Latency
The model is loaded twice within 8 minutes:
- First load at 17:21:32 (took 16.38 s)
- Second load at 17:29:34 (took 16.11 s)
- **Root cause**: Default `OLLAMA_KEEP_ALIVE` is 5 minutes. After the first request completed at 17:22:51, the model was unloaded before the next real request at 17:29:34.
- **Impact**: Every cold start adds **~16 seconds** of loading time, making interactive use sluggish.

### 6. Minor Warnings (Non‑Critical)
- **Audio experimental**: `init_audio: audio input is in experimental stage and may have reduced quality` – only relevant if you actually use audio input.
- **Model token bug**: `control-looking token: 212 '</s>' was not control-type; this is probably a bug in the model` – a minor upstream issue, unlikely to affect output noticeably.

---

## Efficiency Analysis

| Metric | Observed Value | Assessment |
|--------|---------------|------------|
| **Model load time** | ~16.2 s | High; avoidable by keeping model alive. |
| **Prompt processing speed** | 285–327 tok/s | Decent for M2 Pro, but can be improved. |
| **Token generation speed** | 28–30 tok/s | Typical for a 7.5B Q4_K model. Acceptable but not exceptional. |
| **GPU utilisation** | Model offloaded 43/43 layers to Metal. Flash attention enabled. Concurrency & fusion optimisations active. | Excellent – full GPU offloading in place. |
| **Memory usage** | GPU model buffer: 2.8 GiB, CPU model buffer: 5.9 GiB, KV cache: 104 MiB. Total ~8.7 GiB. Free system RAM ~6 GiB. | Plenty of headroom; you can increase context size and batch size. |
| **Batch size** | `n_batch = 512`, `n_ubatch = 512` | Default value; increasing can accelerate prompt processing. |
| **Threads** | 6 out of 10 cores used for computation | Could be raised, but GPU is the main workhorse. |
| **Context length** | `num_ctx = 4096` (model supports 131k) | **Major underutilisation** – limits both input length and generation space. |

---

## Recommendations for Improvement

### 🔧 Immediate Fixes (High Impact, Low Effort)

1. **Set the model to persist in memory**  
   ```bash
   OLLAMA_KEEP_ALIVE=-1 ollama serve
   # or when pulling/running the model
   ollama run gemma4:e4b --keepalive 24h
   ```
   *Eliminates the 16 s reload penalty.*

2. **Increase the context window**  
   Use a larger `num_ctx` – e.g., 16384 or 32768 – to stop prompt truncation and allow longer conversations.  
   ```bash
   ollama run gemma4:e4b --num-ctx 16384
   ```
   *Make sure the client also adjusts `max_tokens` accordingly. With 16 GB RAM, you can easily afford 32k context (KV cache would be ~832 MiB).*

3. **Fix the API endpoint**  
   Ensure your client sends requests to `/v1/chat/completions`, not `/chat/completions`.

### ⚡ Performance Tuning

4. **Increase batch size**  
   ```bash
   OLLAMA_BATCH_SIZE=1024   # or 2048
   ```
   This can push prompt processing speed well above 400 t/s.

5. **Increase CPU threads (optional)**  
   ```bash
   OLLAMA_NUM_THREADS=8
   ```
   May give a small boost to CPU‑bound operations (e.g., tokenisation).

6. **Workaround for prompt cache issue**  
   Since SWA invalidates the prompt cache, avoid submitting many separate prompts that share a long prefix. Instead, stream the entire conversation in a single request if possible, or wait for future llama.cpp improvements that address this limitation.

### 🧪 Longer‑Term Considerations

- **Upgrade quantisation** to Q5_K or Q6_K if output quality is paramount – your memory headroom allows it (model size would grow ~30–50%).
- **Disable audio encoder** if you don’t use audio, to save memory and avoid the experimental warning (requires a custom Modelfile).
- **Monitor GPU temperature / throttling** – M2 Pro can thermally throttle under sustained load; ensure good ventilation.

---

By applying the top three recommendations (persistent model, larger context, correct endpoint) you will eliminate cold‑start delays, end prompt truncation, and allow the model to leverage its full 131k context capacity. The result will be a dramatically smoother and higher‑quality experience.