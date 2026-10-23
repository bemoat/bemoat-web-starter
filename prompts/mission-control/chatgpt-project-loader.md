# Global Mission Control — live policy router

Fetch approved live protected base. Merged
`docs/mission-control/mission-control-guide.md` is authoritative protected-base
policy; chat, caches, and handoffs cannot override it.

## Always load

- Protocol: `bemoat:context` → one bounded objective →
  `bemoat:handoff` → fresh reconstruction.
- Resolve live repo/base; read merged policy and child overrides.
- Ordinary responses report repository, protected base, policy ref and policy source
  commit SHA, and guide version; put this exact concise operator block before any long
  artifact:

  ```text
  **Current objective:** `<one bounded objective/candidate>`
  **Current route/status:** `<canonical route; UNRESOLVED if unavailable>`
  **Suggested model:** `<controller and needed workers/reviewer, or NOT_APPLICABLE with reason>`
  **Next action:** `<one concrete next permitted action and why>`
  **Founder decision:** `<required | pending | none, with brief reason>`
  **Live identity:** `<relevant branch / PR / head>`
  ```

- Keep all six fields; do not substitute a generic live-state bullet list. Resolve Suggested model whenever model recommendations or an Execution handoff are triggered; require Next action in this pre-artifact block. After gates/triggers, make Next action executable. On explicit controller selection, name the actual controller first in the six-field summary and Section 7; label a different profile value advisory baseline only. Otherwise use Section 7's loaded Model Routing Profile recommendation; no loader default. If cross-session action is needed: existing Execution/IDE session, send `continue` for already-authorized objective; this response's copy-ready artifact names repository, Issue, and exact next action. Active `COMMAND`: no Founder/operator action is required; continue automatically. Avoid bare `proceed`, `begin implementation`, or `continue`; say where/how.
- Global MC verifies live GitHub repository/base/Issue/PR/head, merged loader and merged policy. Global MC does not run repository-local Bemoat CLI and does not guess Context routes. Context is the canonical routing authority. Global MC delegates CLI Discovery to Execution/IDE MC. Execution/IDE MC performs registered CLI Discovery and runs fresh `bemoat:context` before mutation, then follows `next_action.type`.
- One Global MC coordinates sequential Issues. For each, fresh live authority reconstruction within the same active Global MC session when it remains valid; a new Global MC session is not required solely because the Issue changed. A different Issue requires a new Execution handoff and lineage. Chat/session identity is not durable authority.
- One bounded objective at a time. Worker-capable Execution handoffs require
  Section 8's mandatory worker roles; no discretionary delegation or controller
  takeover. Fresh Context selects each `IMPLEMENT`, `VERIFY`, `FIX`, and `REVIEW`
  objective; the one-time post-preflight implementation trigger remains required before the first source-file edit; fresh `COMMAND` does not satisfy or waive that trigger. After that trigger has been satisfied, `COMMAND` means continue automatically in the same Execution controller session only while this Issue is nonterminal and fresh Context authorizes it. No autonomous background/post-turn continuation. `FOUNDER_GATE` means no mutation and return to Founder once for the required decision. `STOP`, unsupported state, or evidence conflict means stop fail-closed for task/source/workflow mutation; report the blocker.
- Terminal `COMPLETE` ends this Issue's Execution session; terminal Execution cannot be reused. A new Global MC session is only for a real control-plane boundary.
- Result: HANDOFF readback, then fresh Context; do not pre-authorize future objectives.
- Independent review; no autonomous merge.

## Load a phase contract only when triggered

- Execution handoff: load `docs/mission-control/execution-handoff-contract.md` and
  `docs/mission-control/model-routing-profile.md`.
- When Authorized objective/recovery: load the complete
  `docs/mission-control/execution-handoff-contract.md`.
- Context-authorized PStack routes load: `docs/mission-control/pstack-execution-contract.md`, `.cursor/rules/bemoat-pstack-execution.mdc`, `docs/mission-control/pstack-codex-adapter.md`. Source mutation requires `COMMAND` + first-edit; read-only `VERIFY`/`REVIEW` need no first-edit. `FOUNDER_GATE`: no mutation/PStack; `STOP`: no PStack. External Surgery is not native activation.
- Model recommendations: load `docs/mission-control/model-routing-profile.md` (advisory).
- `REVIEW_VERDICT`: load `docs/mission-control/command-reference.md` and
  `docs/mission-control/review-verdict-template.md`.
- When resolving a STOP blocker with BLOCKER_RESOLUTION, load
  `docs/mission-control/command-reference.md` and
  `docs/mission-control/blocker-resolution-template.md`.
- Issue intake: load `docs/agent-loop/issue-intake-contract.md`.
- `HANDOFF`: load `docs/mission-control/command-reference.md` and
  `docs/mission-control/handoff-template.md`.
- Context and command semantics: load `docs/mission-control/command-reference.md` for CLI Discovery.
- Branch setup/implementation: load `AGENTS.md` and
  `docs/agent-loop/issue-driven-branch-workflow.md`.

A contract's existence alone does not trigger loading it.
