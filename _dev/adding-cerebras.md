csk-cyvvdcvwfd966hhjf85y9c4f998nvtffvn253533y55v2283



Model
Max Context Length
Max Completion Tokens
Type
Quota
gemma-4-31bPreview
131,072
40,000
Requests
minute:5day:2,400
Total tokens
minute:90,000day:3,000,000
Uncached tokens
minute:30,000day:1,000,000
Images
input per request:10
Learn more about image input support
gpt-oss-120bProduction
131,000
40,000
Requests
minute:5day:2,400
Total tokens
minute:90,000day:3,000,000
Uncached tokens
minute:30,000day:1,000,000











Gemma 4 31B
This model excels at multimodal reasoning across screenshots, documents, diagrams, and design assets. Ideal for visual agentic workflows, image-aware copilots, and teams migrating from closed multimodal APIs to an open model.
Model IDgemma-4-31b
Try in PlaygroundModel card
Model Stats
SPEED
~1850
tokens/sec
CONTEXT WINDOW
Free65k tokens
Paid131k tokens
MAX OUTPUT
Free32k tokens
Paid40k tokens
MODALITY
InputText, Image
OutputText
Pricing
per million tokens
Input
$0.99
Output
$1.49
Developer pricing. For volume discounts and enterprise features, see our pricing page.
Model Notes
Image inputs are only available in Chat Completions. The Completions endpoint does not support image inputs.
See the Image Inputs guide for limits and token behavior.
Structured outputs and tool calling with strict: true (constrained decoding) is supported for this model.
Reasoning is disabled by default for Gemma 4. Use reasoning_effort to control it in Chat Completions. Gemma 4 does not support raw or hidden reasoning formats today. See the reasoning guide for details.
Rate Limits
Tier
Requests / min
Input tokens / min
Daily tokens
Images / request
Free Trial
5
30k
1M
2
Developer
300
500k
N/A
10
Endpoints
Chat Completions/v1/chat/completions
Completions/v1/completions
Capabilities
Image Inputs
Reasoning
Streaming
Sampling Controls
Structured Outputs
Tool Calling
Parallel Tool Calling
Prompt Caching


OpenAI GPT OSS
This model excels at efficient reasoning across science, math, and coding applications. It’s ideal for real-time coding assistance, processing large documents for Q&A and summarization, agentic research workflows, and regulated on-premises workloads.
Model IDgpt-oss-120b
Try in PlaygroundModel card
Model Stats
SPEED
~3000
tokens/sec
CONTEXT WINDOW
Free65k tokens
Paid131k tokens
MAX OUTPUT
Free32k tokens
Paid40k tokens
MODALITY
InputText
OutputText
Pricing
per million tokens
Input
$0.35
Output
$0.75
Developer pricing. For volume discounts and enterprise features, see our pricing page.
Model Notes
Use the reasoning_effort parameter to control reasoning for this model. The default effort level is medium. Learn more in our reasoning guide.
When min_tokens is set, the model may generate EOS (End of Sequence) tokens which may cause parser failures. Use at your own risk.
This model may call tools that aren't directly specified due to its training. Monitor for non-approved tools and reprompt with "you're hallucinating a tool call" to help the model self-correct and stick to provided tools.
For this model, our API maps the "system" role to developer-level instructions in our prompt hierarchy. See our OpenAI Compatibility guide for more details.
In Chat Completions, standard sampling controls are supported, including temperature, top_p, frequency_penalty, presence_penalty, seed, and logit_bias. See the Chat Completions API reference for parameter details.
Rate Limits
Tier
Requests / min
Input tokens / min
Daily tokens
Free Trial
5
30k
1M
Developer
1K
1M
N/A
Endpoints
Chat Completions/v1/chat/completions
Capabilities
Reasoning
Streaming
Sampling Controls
Structured Outputs
Tool Calling
Prompt Caching





Dedicated Endpoints
Dedicated Endpoints
Deploy private, high-performance inference endpoints for enterprise workloads.
A dedicated endpoint is a private, provisioned instance of the Cerebras Inference service reserved exclusively for your organization. Your traffic runs on reserved capacity, ensuring latency and throughput are not affected by other users.
Dedicated endpoints are intended for production workloads that require predictable performance—such as real-time applications, customer-facing products, and high-volume pipelines that need guaranteed capacity. See supported models here.
Key Benefits
Dedicated capacity
Consistent latency and throughput
Bring your own weights
Performance customization
Exclusive access to advanced features
To get started with a dedicated endpoint, contact us.
​
Supported Models
Dedicated endpoints support a broad range of model families, including multiple versions, parameter sizes, and weight variations (e.g., -instruct and -thinking) as well as your own custom weights. We can also work with you to tune your endpoint configuration to meet your specific performance goals.

Alibaba Qwen — Qwen3, Qwen3-Coder
Qwen3-235B-A22B
Qwen/Qwen3-235B-A22B-Instruct-2507
Qwen/Qwen3-235B-A22B-Thinking-2507
Qwen3-32B
Qwen/Qwen3-32B
Qwen3-30B-A3B
Qwen/Qwen3-30B-A3B-Instruct-2507
Qwen/Qwen3-30B-A3B-Thinking-2507
Small & Tiny Variants
Qwen/Qwen3-14B
Qwen/Qwen3-8B
Qwen/Qwen3-1.7B
Qwen/Qwen3-0.6B
Qwen3-Coder
Qwen/Qwen3-Coder-480B-A35B-Instruct
Qwen/Qwen3-Coder-30B-A3B-Instruct
OpenAI (OSS) — GPT-OSS
openai/gpt-oss-120b
openai/gpt-oss-safeguard-120b
openai/gpt-oss-20b

MiniMax — MiniMax M2.X
MiniMaxAI/MiniMax-M2.5
MiniMaxAI/MiniMax-M2.1
Google — Gemma 4
google/gemma-4-31b-it
Meta — Llama 3, Llama 4
meta-llama/Llama-4-Maverick-17B-128E-Instruct (402B total)
meta-llama/Llama-4-Scout-17B-16E-Instruct (109B total)
meta-llama/Llama-3.3-70B-Instruct

Mistral — Mistral Small, Mistral Large 3, Devstral 2, Mixtral
mistralai/Mistral-Large-3-675B-Instruct-2512
mistralai/Mistral-Small-24B-Instruct-2501
mistralai/Devstral-Small-2-24B-Instruct-2512
mistralai/Mathstral-7B-v0.1
mistralai/Codestral-22B-v0.1

Z.AI — GLM 4.X, GLM 5.X
zai-org/GLM-5.1
zai-org/GLM-5
zai-org/GLM-4.7
zai-org/GLM-4.7-Flash
zai-org/GLM-4.6
zai-org/GLM-4.5
zai-org/GLM-4.5-air

Moonshot AI — Kimi K2.X
moonshotai/Kimi-K2.6
moonshotai/Kimi-K2.5
moonshotai/Kimi-K2-Instruct
moonshotai/Kimi-K2-Thinking

DeepSeek — DeepSeek V3.X
deepseek-ai/DeepSeek-V3.2
deepseek-ai/DeepSeek-V3.1
deepseek-ai/DeepSeek-V3

StepFun — Step 3.X Flash
stepfun-ai/Step-3.7-Flash
stepfun-ai/Step-3.5-Flash

ByteDance — OSS Seed
ByteDance-Seed/Seed-OSS-36B-Instruct

ServiceNow — Apriel
ServiceNow-AI/Apriel-1.6-15b-Thinker
Coming soon: multimodal






​
Features
Dedicated endpoints include all shared endpoints capabilities, plus:
Fine-tuning — Deploy custom model weights on your dedicated endpoint.
Management API — Programmatically manage models, capacity, and endpoints.
Batch API — Run large-scale asynchronous workloads against your reserved capacity.
Predicted Outputs — Reduce latency on dedicated endpoints by supplying expected output content.
Service tiers — Configure request prioritization to match your SLA requirements.
Metrics — Monitor your endpoint with Prometheus-compatible metrics for requests, tokens, latency, and health.
​




