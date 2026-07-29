Pt-2 Olivia-Workspace – Livro de Refinamento do Ollama
Livro de Refinamento do Ollama, servindo como base para futuras medições e otimizações.
Ollama Refinement Book – Chapter 2: Performance Optimization Development Proposal
Target Machine: MacBook Pro M2 Pro, 16 GiB unified memory
Ollama Version: 0.31.1 · MLX 0.32.0
Model Baseline: gemma4:12b-mlx (7.7 GiB download, speculative decoding enabled)
Current Status: Prompt processing is severely bottlenecked (3–12 tokens/sec), memory peaks up to 17.91 GiB (causing swap), and client timeouts prevent generation from even starting in most calls.


1. Executive Summary
The current deployment of gemma4:12b-mlx on the M2 Pro is unusable for real-time agentic workflows due to:

Extremely slow prompt evaluation (8 t/s average, vs. expected 50+ t/s for this hardware).
Memory oversubscription (peak 17.91 GiB on a 16 GiB system → heavy swapping).
Frequent HTTP 500 errors caused by the client aborting after a 5‑minute timeout.

The following development plan proposes a set of immediate configurational changes, code‑level adjustments, and ongoing monitoring strategies to bring this model to a productive state. If after optimisation performance remains insufficient, a fallback to a smaller model (qwen3.5:9b-mlx or lfm2.5:8b) is outlined.


2. Root‑Cause Analysis (from session logs)
Symptom
Evidence from Log
Underlying Cause
Client timeouts
Every request with >4k new tokens takes >5 minutes; the client cancels before any text is generated.
Default timeout of 5 minutes is too short for large‑context prompt eval on this hardware.
High memory pressure
Peak memory reached 17.91 GiB – exceeding physical RAM. Swap must have been used.
Unconstrained KV cache growth (63,900 tokens) and overhead from speculative decoding / FP16 KV cache.
Slow prompt eval
Even after full cache, 1,514 tokens took 3m47s (~6.7 t/s); 253 tokens took 57s (~4.4 t/s).
Memory bandwidth saturated; possible non‑quantised KV cache; flash attention not enabled.
Ever‑growing context
Total context climbed from 28k to 64k tokens.
No message pruning or summarization in the agent; history kept accumulating.



3. Proposed Solutions
3.1 Client‑Side Resilience: Eliminate Timeouts
Objective: Ensure the client waits long enough for slow prompt eval and uses streaming to show progress.

Actions:

Enable response streaming in all API calls. This lets the user see tokens as soon as generation starts, and avoids the “black hole” feeling that triggers cancellation.
Increase HTTP timeout to at least 600 seconds (10 minutes) or set it to None / unlimited.
Implement a progress callback for prompt processing, so the client can show status even before the first token.

Code Snippets (Python with Ollama SDK):

import ollama

import httpx

client = ollama.Client(

    host='http://localhost:11436',

    timeout=httpx.Timeout(600.0, connect=10.0)  # 10 min total

)

stream = client.chat(

    model='gemma4:12b-mlx',

    messages=messages,

    stream=True,

    options={

        'num_ctx': 32768,    # limit context (see 3.2)

        # other options...

    }

)

for chunk in stream:

    if 'message' in chunk:

        print(chunk['message']['content'], end='', flush=True)

For cURL testing:

curl -N -X POST http://localhost:11434/api/chat \

  -H "Content-Type: application/json" \

  -d '{

    "model": "gemma4:12b-mlx",

    "stream": true,

    "messages": [...],

    "options": {"num_ctx": 32768}

  }' --max-time 600

Expected gain: Eliminate all 500‑errors. Users will see immediate feedback, making long eval times tolerable while we optimise throughput.


3.2 Model Configuration: Reduce Memory, Speed Up Eval
3.2.1 KV Cache Quantisation
Why: KV cache stores key‑value states for every token. At FP16, a 64k context for a 12B model consumes ~8–10 GiB just for the cache. Quantising to q8_0 halves that.

How: Set environment variable before starting Ollama or add to the server launch command:

OLLAMA_KV_CACHE_TYPE=q8_0 ollama serve

Add it permanently to ~/.ollama/server.conf or your launch script.

Expected memory saving: 4–5 GiB under full context, reducing peak memory from 18 GiB to ~13 GiB, eliminating swap.
3.2.2 Enable Flash Attention
Why: Flash Attention reduces memory footprint and speeds up attention computation, especially on long sequences.

How:

OLLAMA_FLASH_ATTENTION=true ollama serve

Compatibility: Check Ollama 0.31.1 release notes; MLX backend likely supports it. If not, this may have no effect, but it’s safe to enable.
3.2.3 Cap Maximum Context Length
Why: The agent currently sends the entire conversation history (63k tokens). Capping prevents the KV cache from ballooning and keeps inference time predictable.

How: Option A – Pass num_ctx in the API request:

"options": {"num_ctx": 32768}

Option B – Create a custom Modelfile to bake the limit:

FROM gemma4:12b-mlx

PARAMETER num_ctx 32768

Then build and use the new model:

ollama create gemma4-12b-optimized -f Modelfile

ollama run gemma4-12b-optimized

Recommended value: 32768 tokens (32k) for M2 Pro/16GB. Test 16384 if memory is still tight.
3.2.4 Remove Speculative Decoding (Optional)
Speculative decoding uses a draft model that adds ~49 arrays and some memory/compute overhead. It speeds up token generation but may not help prompt eval and could increase memory pressure.

Test: Pull gemma4:12b (non‑MLX, without the assistant draft) and compare performance. The MLX version is generally faster on Apple Silicon, but removing the draft could reduce memory spikes. If the standard version is significantly faster, consider switching.

How to test:

ollama pull gemma4:12b

ollama run gemma4:12b

(Keep all other optimisations equal.)


3.3 Conversation Management: Keep Context Lean
Even with a 32k limit, you want the agent to be efficient with tokens. Implement a sliding window + summarisation strategy in the application layer.

Algorithm:

Keep the last N messages (e.g., 10 turns) verbatim.
For older messages, generate a short summary (using the same model or a fast smaller model) and prepend it to the system prompt.
Always enforce a hard maximum token count (num_ctx) – this will automatically truncate from the beginning if exceeded, but it’s better to summarise gracefully.

Example prompt structure:

System: [Summary of previous conversation...]

System: [Current instructions]

User: Hello...

Assistant: Hi...

...

(User/Assistant turns up to limit)

This keeps the working set under 8k–12k tokens in typical use, drastically reducing prompt eval time.


3.4 Monitoring & Profiling
To continuously refine, embed lightweight metrics gathering:

Log prompt eval time per request (difference between request start and first token).
Log peak memory via /api/ps or by parsing the runner logs (already shown).
Track KV cache hit ratio to verify that capping context isn’t causing constant re‑eval of the whole history.

A simple Python decorator can record timings:

import time, logging

def log_timing(func):

    def wrapper(*args, **kwargs):

        start = time.time()

        result = func(*args, **kwargs)

        elapsed = time.time() - start

        logging.info(f"Prompt eval: {elapsed:.2f}s")

        return result

    return wrapper

Store logs in a structured format (JSON lines) for later analysis.


4. Implementation Roadmap
Phase
Action
Owner
Expected Outcome
Timeline
Phase 1 – Quick Wins
1. Increase client timeout to 600s + enable streaming
2. Set OLLAMA_KV_CACHE_TYPE=q8_0 and OLLAMA_FLASH_ATTENTION=true

3. Add num_ctx=32768 in API call
Developer
No more 500 errors; memory stays ≤13 GiB; prompt eval still slow but usable
Day 1
Phase 2 – Performance Tuning
1. Compare gemma4:12b (no draft) vs. MLX version
2. If MLX+ draft remains slow, try removing the draft via custom Modelfile (if possible)

3. Profile with different num_ctx sizes (16k, 24k, 32k)
Developer
Find fastest configuration; aim for prompt eval ≥20 t/s
Day 2
Phase 3 – Application Logic
1. Implement sliding‑window summarisation in the agent

2. Ensure total tokens per request ≤ 8k after first few turns
Developer
Prompt eval times fall to ≤30 seconds
Day 3‑4
Phase 4 – Monitoring & Iteration
1. Add structured logging of timing/memory
2. Create a dashboard or simple CLI report

3. Evaluate fallback models (qwen3.5:9b-mlx, lfm2.5:8b) if targets not met
Developer
Continuous improvement; final decision on production model
Week 2



5. Fallback Plan
If after Phase 2 optimisations the model still cannot deliver acceptable interactivity (e.g., prompt eval >60s for typical 4k‑token inputs), switch to a smaller, more efficient model:

Fallback Model
Size
Expected Prompt Speed
Trade‑off
qwen3.5:9b-mlx
8.9 GiB
30–60 t/s
Slightly lower reasoning scores on STEM; still strong agent performance
lfm2.5:8b
5.2 GiB
80+ t/s
Text only, but built for fast tool calling; excellent for pure agentic coding


These can be benchmarked using the same monitoring framework to make an objective decision.


6. Conclusion
The current pain points are entirely solvable through a combination of client‑side resilience, model‑level memory optimisation, and application‑side context discipline. The proposed changes will transform gemma4:12b-mlx from an unusable, swap‑bound experiment into a practical, interactive coding assistant for the M2 Pro, while preserving its superior reasoning capabilities.

This chapter will be updated as each phase is implemented, with measured outcomes and any new insights. The next entry should document the exact numeric improvements after Phase 1 is applied.



Next Step: Execute Phase 1 items and report back with a fresh session log.

