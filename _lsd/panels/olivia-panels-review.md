# Olivia Panel System — Review & Refinement Recommendations

> Written against `Olivia Panel System — Architecture Reference` (generated 2026-08-04).
> This is a design/engineering review, not a rewrite — the reference doc is accurate and well
> written. What follows is where the *system it describes* falls short of feeling like one
> designed thing, and what to do about it.

---

## The core observation

Seven panels, four separate implementations (`output.js`, `docs.js`, `studio.js`, `tabs.js`),
each with its own transition timing, its own close mechanism, its own size constants. Every
individual panel works. What's missing is the thing that actually reads as "professional" and
"minimalist" to a user: **the feeling that one person designed the whole system**, not that four
features were built at different times and never reconciled.

Right now the tells are everywhere once you line the panels up side by side:

| | Output | Preview | Browser | Studio AI |
|---|---|---|---|---|
| Close mechanism | `width: 0` | `display: none` | `width: 0` | `width: 0` |
| Transition | `none` (instant) | timeout-sequenced (10ms / 300ms) | `0.3s ease` | `0.28s` |
| Min width (drag) | 220px | 220px | 220px | 260px |
| Edge toggle | Yes | No | No | No |
| Persisted | No | No | No | No |

None of these differences look intentional. That's the actual problem — not that any one choice
is wrong, but that a user (or a developer reading the code six months from now) can't tell which
inconsistencies are decisions and which are just drift.

---

## Priority 1 — Fix what users actually feel

### 1.1 The `.panels-busy` chat collapse is the biggest risk in the system

When two right-side panels are open, the main chat gets crushed to a fixed **280px strip**, and
the header, toolbar, welcome state, and message log all get `display: none !important` — leaving
only the compose input, labeled by a small amber `::before` pseudo-element. (`output.js:633`)

This is the one behavior in the whole doc that will actually surprise a user mid-task. It reads
as a patch for a layout that ran out of room, not a considered state. A few directions, in order
of how much they'd cost to build:

- **Cheapest:** give the collapsed chat strip real content instead of hiding everything — even
  just the last message and a "N messages" affordance — so it reads as *minimized*, not *broken*.
- **Better:** don't let three panels compete for the same space in the first place (see 1.2).
  If only one right-side panel can ever be open, `.panels-busy` likely never needs to trigger for
  the common case, and the 280px emergency mode becomes a true edge case instead of something a
  normal workflow (open Output + Browser) runs into regularly.

### 1.2 Output, Preview, and Browser should not be three independent panels

They already share the same physical space and the same resize function
(`_initHorizResize`) — the architecture is *already* telling you these are one slot, not three.
What's missing is that the code doesn't enforce it: a user can open all three, and the system
reacts after the fact via `_syncWorkspacePanels()` and the busy-chat fallback above.

Recommend treating the right dock as **one slot with a switcher** (tabs, or last-opened-wins)
rather than three panels that happen to coexist. This is a bigger change, but it's the one that
would make the "clean" feel land — right now the ceiling state of this UI is three panels open
plus a crushed chat, and that's the opposite of minimal. A single-slot dock also removes the need
for `.panels-busy` as a rescue mechanism, rather than papering over what three-panels-open looks
like.

If a single slot is too big a change for now, a smaller version of the same idea: cap it at two
panels open, and make opening a third auto-close the least-recently-used one. Quieter fix, same
underlying instinct — the system should have an opinion about how much can be open at once,
rather than letting it happen and reacting.

---

## Priority 2 — Make the system consistent

These don't change behavior much, but they're exactly the kind of thing that makes an interface
feel deliberate instead of assembled.

### 2.1 One transition, everywhere
Three different values right now: `none` (Output), `0.3s ease` (Browser), `0.28s` (Studio AI),
plus Preview's timeout-based open/close which can't use a CSS transition at all in its current
form. Pick one curve and duration — something like `220ms cubic-bezier(.4,0,.2,1)` — and apply it
to every panel that opens or closes. A user won't consciously register "the timing is
consistent," but they will register "this feels considered" versus "this feels inconsistent,"
even if they can't say why.

### 2.2 One close mechanism
Preview's `display: none` (`docs.js:1087`) is the odd one out, and it's the reason it needs the
10ms/300ms timeout choreography instead of just transitioning like Output and Browser do. Move
Preview onto the same `width: 0` pattern as its siblings. This is flagged in the reference doc's
own known-issues list (#3) — agree with that assessment, and it's worth doing before persistence
work (below), since persisting a panel's state is simpler when open/closed is one boolean driven
by one mechanism.

### 2.3 Shared sizing tokens instead of scattered constants
Min-width shows up as 220, 200, 240, and 260 across `output.js`, `tabs.js`, and `studio.js`.
Some of that variance may be legitimate — a code editor plausibly needs a different floor than a
URL bar — but as written there's no way to tell intentional constraints apart from copy-paste
drift. Worth pulling these into one documented set of tokens (even just constants at the top of
a shared file) with a one-line comment on any panel that deliberately deviates.

### 2.4 Give z-index an actual scale
Current stack: `110, 100, 90, 55, 50, 20, 8, 5`. It works today, but there's no visible logic to
extend it by — the next person adding a floating element has to guess where it fits. A small
documented scale (e.g. base content / handles / overlays / mobile chrome / always-on-top edge
controls, each with a reserved range) turns "where do I put this" from a guess into a lookup.
Invisible to users when it's right; shows up as visible bugs when it's wrong — which is exactly
the kind of thing that quietly undermines "clean" the first time two things overlap unexpectedly.

---

## Priority 3 — Smaller, high-leverage polish

### 3.1 Persist panel state
Dark mode and doc-tree expansion already persist to `localStorage` — the pattern exists in the
codebase. Every panel's open/closed state and width resets on refresh, which is the kind of
detail power users notice fast ("why do I have to resize this every time"). Doesn't need to be
everything at once — sidebar width and the right-dock's last-open panel would cover most of the
felt benefit for the least surface area.

### 3.2 Resolve the edge-toggle asymmetry
Output has a persistent edge toggle (`#outputEdgeToggle`, z-index 110); Preview and Browser
don't. If 1.2 (single-slot dock) happens, this mostly resolves itself — one toggle for one dock.
If it doesn't happen soon, the asymmetry is worth fixing in one direction or the other: either
give all three a toggle, or remove Output's and rely on toolbar buttons everywhere, consistently.
Right now it's an accident of which panel got built first.

### 3.3 Mobile Preview is a documentation gap, possibly a real one
The reference doc specifies mobile behavior for Output (`display: none`, with a tablet
bottom-sheet fallback) and implies Browser is similarly hidden, but says nothing about Preview on
mobile. Worth confirming this is an intentional omission rather than an untested path — file
previews (PDF, docx, images) are exactly the kind of content people plausibly want on a phone.

---

## What's already right — keep these

Worth saying explicitly, since a review like this can read as all-criticism:

- **The 5px resize handles that stay invisible until hover** are a genuinely good minimalist
  choice — chrome that earns its presence instead of sitting there by default. Don't "improve"
  this into something more visible.
- **The collapsed sidebar's icon-only strip** is the right instinct — full content or nothing,
  no awkward half-state.
- **The existing `localStorage` pattern** for dark mode and doc-tree state is the right shape to
  extend from for 3.1, rather than inventing a new persistence approach.

---

## If only three things happen

1. Fix the `.panels-busy` chat collapse (1.1) — it's the one thing a user will actually notice
   and be bothered by.
2. Unify Preview onto `width: 0` (2.2) — small change, removes a timing hack, and is a
   prerequisite for clean persistence later.
3. Pick one transition timing for all four resizable panels (2.1) — cheapest fix on this list,
   disproportionate effect on whether the system feels like one thing.

Everything else compounds from there, but those three would move the needle on "professional,
minimalist, clean" faster than anything else in this list.