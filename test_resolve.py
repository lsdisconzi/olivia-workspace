import sys, os
sys.path.append(os.getcwd())
from serve import _resolve_remote_llm_target, OPENROUTER_API_KEY
print("OPENROUTER_API_KEY globally:", repr(OPENROUTER_API_KEY))
base, api = _resolve_remote_llm_target("openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free")
print("Target base:", base)
print("Target api:", repr(api))
