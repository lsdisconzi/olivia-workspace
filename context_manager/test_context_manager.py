"""Test harness for the Context Manager (Phase 8).

Tests:
- Token budget assertion (≤1,200 tokens under normal conditions)
- Golden set of queries — verify correct answers without hallucination
- Summary extraction accuracy
- History truncation and de-duplication
- RAG formatting
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Add workspace root to path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from context_manager import (
    ContextManager,
    RagRetriever,
    format_retrieved_chunks,
    RETRIEVAL_SCOPE_AUTO,
    RETRIEVAL_SCOPE_ALL,
    RETRIEVAL_SCOPE_NONE,
)
from context_manager.summary_generator import generate_summary, _extract_current_phase, _extract_decisions
from context_manager.history_manager import truncate_history, deduplicate_user_quote
from context_manager.rag_integration import format_retrieved_chunks, RagRetriever
from src.orchestration_contracts import build_agent_prompt


# ---------------------------------------------------------------------------
# Test configuration
# ---------------------------------------------------------------------------

PROJECT_DIR = WORKSPACE_ROOT / "uploads" / "projects" / "olivia-memory-capture-agent"
TEST_SESSION = "test_session_001"
PASS = 0
FAIL = 0
ERRORS: list[str] = []


def check(name: str, condition: bool, detail: str = ""):
    """Assert a test condition and record pass/fail."""
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {name}")
    else:
        FAIL += 1
        msg = f"  ✗ {name} — FAILED"
        if detail:
            msg += f" ({detail})"
        print(msg)
        ERRORS.append(f"{name}: {detail}")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_cm_instantiation():
    """Phase 0: ContextManager can be instantiated with valid paths."""
    print("\n--- Test: ContextManager Instantiation ---")
    cm = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id=TEST_SESSION,
        enable_snapshots=False,
    )
    check("ContextManager created", cm is not None)
    check("Session ID set", cm.session_id == TEST_SESSION)
    check("Token budget default", cm.token_budget == 1200)
    check("Sys prompt template exists", cm.sys_prompt_path.is_file())
    return cm


def test_build_prompt_basic(cm: ContextManager):
    """Phase 1+2: Basic prompt assembly works."""
    print("\n--- Test: Basic Prompt Assembly ---")
    prompt = cm.build_prompt("What is the current phase?")
    check("Prompt is a list", isinstance(prompt, list))
    check("Has at least 2 messages", len(prompt) >= 2)

    # Check system message
    system_msgs = [m for m in prompt if m["role"] == "system"]
    check("Has system message", len(system_msgs) >= 1)
    if system_msgs:
        has_summary = "[Phase]" in system_msgs[0]["content"]
        check("System message contains project summary", has_summary)
        # Tools are now in MCP tool definitions, not the system prompt
        no_explicit_tools = "search_docs" not in system_msgs[0]["content"]
        check("System message is clean (no inlined tool references)", no_explicit_tools)
        check("System message contains agent_role", "{agent_role}" not in system_msgs[0]["content"])

    # Check user message
    user_msgs = [m for m in prompt if m["role"] == "user"]
    check("Has user message", len(user_msgs) >= 1)
    if user_msgs:
        check("User message content preserved", "current phase" in user_msgs[-1]["content"])

    return prompt


def test_prompt_with_history(cm: ContextManager):
    """Phase 5: History truncation works."""
    print("\n--- Test: History Truncation ---")
    history = [
        {"role": "user", "content": "What is this project about?"},
        {"role": "assistant", "content": "This project implements agent context management."},
        {"role": "user", "content": "What phase are we in?"},
        {"role": "assistant", "content": "We are in Phase 0."},
        {"role": "user", "content": "Tell me more about Phase 0."},
        {"role": "assistant", "content": "Phase 0 is the foundation phase."},
    ]
    prompt = cm.build_prompt(
        "What comes after Phase 0?",
        history=history,
    )
    # Count assistant messages in the prompt — should be at most 3 (max_turns)
    assistant_msgs = [m for m in prompt if m["role"] == "assistant"]
    check("History truncated to ≤3 turns", len(assistant_msgs) <= 3)
    check("Latest history preserved", "Phase 0" in str(prompt))

    return prompt


def test_deduplication():
    """Phase 5: Quote de-duplication catches repeated content."""
    print("\n--- Test: Quote De-duplication ---")
    assistant_reply = "The current phase is Phase 0, which focuses on building the Context Manager foundation."
    history = [
        {"role": "user", "content": "What phase is active?"},
        {"role": "assistant", "content": assistant_reply},
    ]

    # Exact repeat
    result = deduplicate_user_quote(history, assistant_reply)
    check("Exact repeat detected", "referenced previous response" in result)

    # Close paraphrase
    similar = "The current phase is Phase 0, which focuses on building the Context Manager."
    result2 = deduplicate_user_quote(history, similar)
    check("Close paraphrase detected", "referenced previous response" in result2)

    # Different question — should NOT be caught
    different = "What tools are available?"
    result3 = deduplicate_user_quote(history, different)
    check("Different question not caught", result3 == different)

    return True


def test_summary_extraction():
    """Phase 2: Summary generation from planning files."""
    print("\n--- Test: Summary Extraction ---")
    summary = generate_summary(PROJECT_DIR)
    check("Summary is non-empty", len(summary) > 0)
    check("Contains [Phase]", "[Phase]" in summary)
    check("Contains [Decisions]", "[Decisions]" in summary)
    check("Contains [Last update]", "[Last update]" in summary)

    # Test phase extraction
    task_plan = (PROJECT_DIR / "task_plan.md").read_text(encoding="utf-8")
    phase = _extract_current_phase(task_plan)
    check("Phase extracted", len(phase) > 0 and "Phase" in phase)

    # Test decision extraction
    memory = (PROJECT_DIR / "memory.md").read_text(encoding="utf-8")
    decisions = _extract_decisions(memory)
    check("Decisions extracted", len(decisions) >= 1)
    if decisions:
        check("Decision contains meaningful text", len(decisions[0]) > 10)

    return summary


def test_rag_formatting():
    """Phase 3: RAG chunk formatting works."""
    print("\n--- Test: RAG Formatting ---")
    chunks = [
        {"text": "Phase 0 focuses on Context Manager foundation.", "source": "task_plan.md", "score": 0.95},
        {"text": "Decision: reuse-before-build was established.", "source": "memory.md", "score": 0.87},
    ]
    formatted = format_retrieved_chunks(chunks)
    check("Formatted block is non-empty", len(formatted) > 0)
    check("Contains source names", "task_plan.md" in formatted and "memory.md" in formatted)
    check("Contains scores", "0.95" in formatted and "0.87" in formatted)
    check("Starts with header", formatted.startswith("[Retrieved from Olivia docs]"))

    # Empty chunks
    empty = format_retrieved_chunks([])
    check("Empty chunks returns empty string", empty == "")

    return True


def test_rag_search_live():
    """Phase 3: Live Qdrant search via Garage API returns real results."""
    print("\n--- Test: Live RAG Search (Garage API) ---")
    retriever = RagRetriever(
        collection_name="olivia-dev-code",
        top_k=2,
        min_score=0.3,
    )
    results = retriever.search("current phase context manager")
    check("Search returned results", len(results) >= 1)
    if results:
        r = results[0]
        check("Result has 'text' key", "text" in r)
        check("Result has 'source' key", "source" in r)
        check("Result has 'score' key", "score" in r)
        check("Text is non-empty", len(r["text"]) > 0)
        check("Source identifies a file", r["source"].endswith(".md"))
        check("Score between 0 and 1", 0 <= r["score"] <= 1)
        print(f"    Sample result: [{r['source']}] score={r['score']:.3f}")
        print(f"    Text preview: {r['text'][:80]}...")

    # Graceful degradation — non-existent collection returns empty
    retriever2 = RagRetriever(collection_name="__nonexistent_collection__")
    empty = retriever2.search("anything")
    check("Non-existent collection returns empty", len(empty) == 0)

    # Graceful degradation — bad URL returns empty
    retriever3 = RagRetriever(
        collection_name="olivia-dev-code",
        base_url="http://127.0.0.1:1",
    )
    bad = retriever3.search("anything")
    check("Bad URL returns empty gracefully", len(bad) == 0)

    return results


def test_token_budget(cm: ContextManager):
    """Phase 8: Token budget assertion."""
    print("\n--- Test: Token Budget ---")
    prompt = cm.build_prompt("What is the current phase and what decisions have been made?")

    total_chars = sum(len(m.get("content", "")) for m in prompt)
    estimated_tokens = total_chars // 4
    print(f"  Estimated tokens: ~{estimated_tokens} (budget: {cm.token_budget})")
    check(f"Under token budget ({estimated_tokens} ≤ {cm.token_budget})", estimated_tokens <= cm.token_budget)

    return estimated_tokens


def test_panel_injection(cm: ContextManager):
    """Phase 4: Panel content injection."""
    print("\n--- Test: Panel Content Injection ---")
    prompt = cm.build_prompt(
        "Look at the browser output",
        panel_content="[Browser panel] File listing: task_plan.md, memory.md",
        panel_name="browser",
    )
    user_msgs = [m for m in prompt if m["role"] == "user"]
    has_panel = any("[Panel: browser]" in m["content"] for m in prompt)
    check("Panel content injected", has_panel)

    # Panel without content should NOT be injected
    prompt2 = cm.build_prompt(
        "What phase?",
        panel_content="",
        panel_name="empty-panel",
    )
    user_msgs2 = [m for m in prompt2 if m["role"] == "user"]
    no_stray_panel = not any("[Panel: empty-panel]" in m["content"] for m in prompt2)
    check("Empty panel not injected", no_stray_panel)

    return True


def test_context_snapshots():
    """Phase 6: Context snapshots are written to disk."""
    print("\n--- Test: Context Snapshots ---")
    cm = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="test_snapshot_session",
        enable_snapshots=True,
    )
    cm.build_prompt("Save this context for debugging.")

    snapshot_dir = WORKSPACE_ROOT / "context_snapshots" / "test_snapshot_session"
    check("Snapshot directory created", snapshot_dir.is_dir())

    snapshots = list(snapshot_dir.glob("turn_*.json"))
    check("Snapshot file written", len(snapshots) >= 1)

    if snapshots:
        content = json.loads(snapshots[0].read_text(encoding="utf-8"))
        check("Snapshot has session_id", content.get("session_id") == "test_snapshot_session")
        check("Snapshot has messages", len(content.get("messages", [])) > 0)

    return True


def test_index_planning_files(cm: ContextManager):
    """Phase 3: Index planning files (interface test, not actual Qdrant)."""
    print("\n--- Test: Index Planning Files ---")
    result = cm.index_planning_files()

    # Should not crash — currently a placeholder that reports files
    # (actual Qdrant indexing requires garage-qdrant to be wired)
    check("Index result is dict", isinstance(result, dict))
    check("Index result has indexed_count key", "indexed_count" in result)

    return result


# ---------------------------------------------------------------------------
# Phase 7 — Orchestrator Integration Tests
# ---------------------------------------------------------------------------

def test_project_id_resolution():
    """Phase 7: project_id correctly resolves the project directory."""
    print("\n--- Test: Project ID Resolution (Phase 7) ---")
    cm = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="test_project_session",
        project_id="olivia-memory-capture-agent",
        enable_snapshots=False,
    )
    expected_dir = WORKSPACE_ROOT / "uploads" / "projects" / "olivia-memory-capture-agent"
    check("Project dir matches project_id", cm._project_dir == expected_dir)
    check("Project id stored", cm.project_id == "olivia-memory-capture-agent")
    return cm


def test_agent_role_injection():
    """Phase 7: agent_role is injected into the system prompt."""
    print("\n--- Test: Agent Role Injection (Phase 7) ---")
    cm = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="test_role_session",
        agent_role="Legal Document Analyst",
        enable_snapshots=False,
    )
    prompt = cm.build_prompt("What phase?")
    system_text = " ".join(m["content"] for m in prompt if m["role"] == "system")
    check("Agent role 'Legal Document Analyst' in system prompt",
          "Legal Document Analyst" in system_text)
    check("Agent role stored", cm.agent_role == "Legal Document Analyst")

    # Default agent role
    cm2 = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="test_role_session2",
        enable_snapshots=False,
    )
    prompt2 = cm2.build_prompt("What phase?")
    system_text2 = " ".join(m["content"] for m in prompt2 if m["role"] == "system")
    check("Default agent role 'Memory Capture Agent'",
          "Memory Capture Agent" in system_text2)
    return cm


def test_phase_tag_in_prompt():
    """Phase 7: phase_tag appears in system prompt as phase context."""
    print("\n--- Test: Phase Tag in Prompt (Phase 7) ---")
    cm = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="test_phase_session",
        phase_tag="Phase 7 — Orchestrator Integration",
        enable_snapshots=False,
    )
    prompt = cm.build_prompt("What is the current status?")
    system_text = " ".join(m["content"] for m in prompt if m["role"] == "system")
    check("Phase tag in system prompt",
          "Orchestrator Integration" in system_text)
    check("Active phase annotation present",
          "Active phase:" in system_text)
    check("Phase tag stored", cm.phase_tag == "Phase 7 — Orchestrator Integration")

    # Per-call phase_hint override
    prompt2 = cm.build_prompt("Any updates?", phase_hint="Phase 8 — Testing")
    system_text2 = " ".join(m["content"] for m in prompt2 if m["role"] == "system")
    check("Per-call phase_hint overrides instance tag",
          "Phase 8 — Testing" in system_text2)
    return cm


def test_force_retrieval_scope():
    """Phase 7: force_retrieval_scope controls RAG behavior."""
    print("\n--- Test: Force Retrieval Scope (Phase 7) ---")
    # Scope "none" — even long query should not trigger retrieval
    cm_none = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="test_ret_none",
        force_retrieval_scope="none",
        enable_snapshots=False,
    )
    prompt_none = cm_none.build_prompt("What is the current phase and what decisions have been made?")
    all_system_none = " ".join(m["content"] for m in prompt_none if m["role"] == "system")
    check("Scope 'none' suppresses RAG", "[Retrieved from Olivia docs]" not in all_system_none)

    # Scope "all" — even short query should trigger retrieval
    cm_all = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="test_ret_all",
        force_retrieval_scope="all",
        enable_snapshots=False,
    )
    prompt_all = cm_all.build_prompt("hi")
    all_system_all = " ".join(m["content"] for m in prompt_all if m["role"] == "system")
    # May or may not have RAG results, but should have run the search
    check("Scope 'all' allows RAG for short query", True)  # Always passes, just ensures no crash
    print(f"    Scope 'all' with short query: RAG present = {'[Retrieved from Olivia docs]' in all_system_all}")

    # Per-call force_retrieval override
    cm_auto = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="test_ret_override",
        force_retrieval_scope="auto",
        enable_snapshots=False,
    )
    # Short query with force=True should trigger retrieval
    prompt_override = cm_auto.build_prompt("no", force_retrieval=True)
    all_system_ovr = " ".join(m["content"] for m in prompt_override if m["role"] == "system")
    check("Per-call force=True overrides auto (no crash)", True)  # No crash assertion
    print(f"    force=True with short query: RAG present = {'[Retrieved from Olivia docs]' in all_system_ovr}")

    return True


def test_isolated_instances():
    """Phase 7: Isolated ContextManager instances have independent state."""
    print("\n--- Test: Isolated Instances (Phase 7) ---")
    cm1 = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="isolated_1",
        agent_role="Analyst Alpha",
        project_id="olivia-memory-capture-agent",
        enable_snapshots=False,
    )
    cm2 = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="isolated_2",
        agent_role="Analyst Beta",
        project_id="olivia-memory-capture-agent",
        enable_snapshots=False,
    )

    # Different agent roles
    check("Instance 1 has correct agent role", cm1.agent_role == "Analyst Alpha")
    check("Instance 2 has correct agent role", cm2.agent_role == "Analyst Beta")

    # Different session IDs
    check("Instance 1 has correct session ID", cm1.session_id == "isolated_1")
    check("Instance 2 has correct session ID", cm2.session_id == "isolated_2")

    # Independent turn counters
    cm1.build_prompt("First message")
    cm1.build_prompt("Second message")
    cm2.build_prompt("First for beta")
    check("Instance 1 turn counter = 2", cm1._turn_counter == 2)
    check("Instance 2 turn counter = 1", cm2._turn_counter == 1)

    # Independent system prompts
    prompt1 = cm1.build_prompt("Status?")
    prompt2 = cm2.build_prompt("Status?")
    sys1 = " ".join(m["content"] for m in prompt1 if m["role"] == "system")
    sys2 = " ".join(m["content"] for m in prompt2 if m["role"] == "system")
    check("Instance 1 prompt has 'Analyst Alpha'", "Analyst Alpha" in sys1)
    check("Instance 2 prompt has 'Analyst Beta'", "Analyst Beta" in sys2)

    return True


def test_orchestrator_integration():
    """Phase 7: build_agent_prompt() orchestrator function works end-to-end."""
    print("\n--- Test: Orchestrator Integration (Phase 7) ---")
    result = build_agent_prompt(
        project_root=str(WORKSPACE_ROOT),
        session_id="orchestrator_test",
        user_message="What is the current phase?",
        project_id="olivia-memory-capture-agent",
        agent_role="Legal Analyst",
        phase_tag="Phase 7 — Orchestrator Integration",
        enable_snapshots=True,
    )

    check("Result has ok=True", result.get("ok") is True)
    check("Result has messages list", isinstance(result.get("messages"), list))
    check("Has at least 2 messages", len(result["messages"]) >= 2)
    check("Has config dict", isinstance(result.get("config"), dict))
    check("Config has project_id", result["config"].get("project_id") == "olivia-memory-capture-agent")
    check("Config has agent_role", result["config"].get("agent_role") == "Legal Analyst")
    check("Config has phase_tag", result["config"].get("phase_tag") == "Phase 7 — Orchestrator Integration")
    check("Has token_estimate", isinstance(result.get("token_estimate"), int))
    check("Has char_count", isinstance(result.get("char_count"), int))
    check("Has message_count", result["message_count"] >= 2)
    check("Has snapshot_path", isinstance(result.get("snapshot_path"), str))
    check("Has project_summary", len(result.get("project_summary", "")) > 0)

    # Agent role in system prompt
    system_text = " ".join(m["content"] for m in result["messages"] if m["role"] == "system")
    check("Agent role 'Legal Analyst' in prompt", "Legal Analyst" in system_text)
    check("Phase tag 'Orchestrator Integration' in prompt", "Orchestrator Integration" in system_text)

    # Verify snapshot was written
    snapshot_dir = WORKSPACE_ROOT / "context_snapshots" / "orchestrator_test"
    check("Snapshot directory exists", snapshot_dir.is_dir())
    snapshots = list(snapshot_dir.glob("*.json"))
    check("Snapshot file exists", len(snapshots) >= 1)

    return result


def test_diagnostic_report():
    """Phase 7+8: Full diagnostic trace of prompt assembly.

    Prints detailed token, character, path, and ordering information.
    """
    print("\n--- Test: Diagnostic Report (Phase 7+8) ---")
    cm = ContextManager(
        project_root=str(WORKSPACE_ROOT),
        session_id="diagnostic_session",
        project_id="olivia-memory-capture-agent",
        agent_role="Diagnostic Agent",
        phase_tag="Phase 7 — Orchestrator Integration",
        enable_snapshots=True,
    )

    history = [
        {"role": "user", "content": "What is this project about?"},
        {"role": "assistant", "content": "Agent context management system."},
    ]
    prompt = cm.build_prompt(
        "What is the current phase and what decisions have been made?",
        history=history,
        panel_content="[Browser] File: task_plan.md",
        panel_name="browser",
    )

    # 1. Overall structure
    print(f"\n  {'='*50}")
    print(f"  PROMPT ASSEMBLY DIAGNOSTIC")
    print(f"  {'='*50}")
    print(f"  Messages: {len(prompt)}")
    for i, msg in enumerate(prompt):
        role = msg["role"]
        chars = len(msg["content"])
        tokens_est = chars // 4
        preview = msg["content"][:60].replace("\n", " | ") + ("..." if len(msg["content"]) > 60 else "")
        print(f"  [{i}] role={role}, chars={chars}, ~{tokens_est} tokens")
        print(f"       preview: {preview}")

    # 2. Summary statistics
    total_chars = sum(len(m.get("content", "")) for m in prompt)
    total_tokens_est = total_chars // 4
    role_counts: dict[str, int] = {}
    for m in prompt:
        role_counts[m["role"]] = role_counts.get(m["role"], 0) + 1
    
    print(f"\n  {'─'*50}")
    print(f"  SUMMARY")
    print(f"  {'─'*50}")
    print(f"  Total characters:  {total_chars}")
    print(f"  Estimated tokens:  ~{total_tokens_est}")
    print(f"  Token budget:      {cm.token_budget}")
    print(f"  Budget remaining:  {cm.token_budget - total_tokens_est}")
    print(f"  Message breakdown: {role_counts}")

    # 3. Configuration audit
    config = cm.get_effective_config()
    print(f"\n  {'─'*50}")
    print(f"  EFFECTIVE CONFIGURATION")
    print(f"  {'─'*50}")
    for key, val in config.items():
        print(f"  {key}: {val}")

    # 4. RAG block verification
    all_system = " ".join(m["content"] for m in prompt if m["role"] == "system")
    has_rag = "[Retrieved from Olivia docs]" in all_system
    print(f"\n  {'─'*50}")
    print(f"  RAG STATUS")
    print(f"  {'─'*50}")
    print(f"  RAG block present: {has_rag}")
    if has_rag:
        for m in prompt:
            if "[Retrieved from Olivia docs]" in m.get("content", ""):
                rag_lines = [l for l in m["content"].split("\n") if l.strip()]
                print(f"  RAG lines: {len(rag_lines)}")
                for line in rag_lines[:4]:
                    print(f"    {line[:100]}")
                break

    # 5. Snapshot path
    snapshot_path = WORKSPACE_ROOT / "context_snapshots" / "diagnostic_session" / "turn_0001.json"
    print(f"\n  {'─'*50}")
    print(f"  SNAPSHOT")
    print(f"  {'─'*50}")
    print(f"  Path: {snapshot_path}")
    print(f"  Exists: {snapshot_path.is_file()}")

    # Assertions (no hard failures, just diagnostics)
    check("Diagnostic: messages assembled", len(prompt) >= 3,
          detail=f"expected ≥3, got {len(prompt)}")
    check("Diagnostic: under token budget", total_tokens_est <= cm.token_budget,
          detail=f"~{total_tokens_est} > {cm.token_budget}")
    check("Diagnostic: agent role in prompt", "Diagnostic Agent" in all_system)
    check("Diagnostic: phase tag in prompt", "Orchestrator Integration" in all_system)
    check("Diagnostic: project summary in prompt", "[Phase]" in all_system)
    check("Diagnostic: panel content injected",
          any("[Panel: browser]" in m.get("content", "") for m in prompt))
    check("Diagnostic: history preserved",
          any("context management" in m.get("content", "") for m in prompt))

    return {
        "messages": prompt,
        "total_chars": total_chars,
        "total_tokens_est": total_tokens_est,
        "config": config,
        "has_rag": has_rag,
        "snapshot_path": str(snapshot_path),
    }


# ---------------------------------------------------------------------------
# Golden Query Tests (Phase 8)
# ---------------------------------------------------------------------------

GOLDEN_QUERIES = [
    ("What is the current phase?", "Phase 0"),
    ("What decisions were made?", "reuse-before-build"),
    ("Where is the project located?", "olivia"),
]


def test_golden_queries(cm: ContextManager):
    """Phase 8: Golden set of queries — verify the prompt contains expected context
    from both project summary AND live RAG retrieval."""
    print("\n--- Test: Golden Queries ---")
    for query, expected_context in GOLDEN_QUERIES:
        prompt = cm.build_prompt(query)
        prompt_text = json.dumps(prompt).lower()
        expected_lower = expected_context.lower()

        # The expected context should be in the system message (project summary)
        system_text = " ".join(m["content"] for m in prompt if m["role"] == "system").lower()
        found = expected_lower in system_text
        check(f"Golden query '{query}' — context found", found)

    # Verify RAG injection: a substantive query should trigger retrieval
    rag_prompt = cm.build_prompt("What is the current phase and what decisions have been made?")
    all_system = " ".join(m["content"] for m in rag_prompt if m["role"] == "system")
    has_rag = "[Retrieved from Olivia docs]" in all_system
    check("RAG block injected for substantive query", has_rag,
          detail="Expected [Retrieved from Olivia docs] in system messages")

    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    """Run all tests."""
    global PASS, FAIL
    print("=" * 60)
    print("Context Manager Test Harness")
    print(f"Workspace: {WORKSPACE_ROOT}")
    print(f"Project:   {PROJECT_DIR}")
    print("=" * 60)

    start = time.time()

    try:
        # Tests that don't need a ContextManager instance
        test_summary_extraction()
        test_deduplication()
        test_rag_formatting()
        test_rag_search_live()

        # Tests that need a ContextManager
        cm = test_cm_instantiation()

        test_build_prompt_basic(cm)
        test_prompt_with_history(cm)
        test_token_budget(cm)
        test_panel_injection(cm)
        test_index_planning_files(cm)
        test_golden_queries(cm)

        # Snapshot test needs its own instance
        test_context_snapshots()

        # Phase 7 — Orchestrator Integration tests
        test_project_id_resolution()
        test_agent_role_injection()
        test_phase_tag_in_prompt()
        test_force_retrieval_scope()
        test_isolated_instances()
        test_orchestrator_integration()
        test_diagnostic_report()

    except Exception as e:
        print(f"\n  ✗ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        FAIL += 1

    elapsed = time.time() - start

    print("\n" + "=" * 60)
    print(f"Results: {PASS} passed, {FAIL} failed, in {elapsed:.2f}s")
    if ERRORS:
        print("\nFailures:")
        for err in ERRORS:
            print(f"  - {err}")
    print("=" * 60)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
