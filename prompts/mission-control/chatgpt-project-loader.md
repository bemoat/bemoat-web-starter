# Global Mission Control — live policy router

This stable Project Instructions entrypoint is fetched from the approved live
protected base. The merged `docs/mission-control/mission-control-guide.md` is
the authoritative protected-base policy; this router cannot replace or override
it. Chat, cached
Project files, and copied handoffs are context only.

## Always load

- The coordination protocol is `bemoat:context` → one bounded objective →
  `bemoat:handoff` → fresh reconstruction.
- Resolve the live repository and approved protected base. Read the merged
  Mission Control guide and applicable child-owned overrides from that base.
- On ordinary Global MC responses, report the repository, protected base,
  policy ref, policy source commit SHA, and guide version.
- Global MC verifies live GitHub repository/base/Issue/PR/head evidence and the
  merged loader and merged policy. Global MC does not run repository-local
  Bemoat CLI and does not guess Context routes. Fresh Context is the canonical
  routing authority. Global MC delegates CLI Discovery to Execution/IDE MC.
  Execution/IDE MC performs registered CLI Discovery and runs fresh
  `bemoat:context` before mutation, then follows its returned `next_action.type`.
- Execute one bounded objective at a time. `COMMAND` means continue in the same
  Execution controller session automatically; `FOUNDER_GATE` means
  no mutation and return to Founder; `STOP`, unsupported state, or evidence
  conflict means no mutation and stop fail-closed.
- After a durable result, publish and read back required HANDOFF evidence,
  then reconstruct fresh Context before choosing another objective. Do not
  pre-authorize future objectives or require a Founder return for internal
  deterministic substeps alone.
- Keep independent review independent. Never merge autonomously.

## Load a phase contract only when triggered

- **When preparing an Execution handoff**, load
  `docs/mission-control/execution-handoff-contract.md` and
  `docs/mission-control/model-routing-profile.md`. Include the complete ordered
  artifact contract and resolved model recommendations inside the handoff.
- **When selecting model recommendations**, load
  `docs/mission-control/model-routing-profile.md` and keep its advisory status.
- **When publishing REVIEW_VERDICT evidence**, load the semantic-review rules
  in `docs/mission-control/command-reference.md` and use
  `docs/mission-control/review-verdict-template.md`.
- **When resolving a STOP blocker with BLOCKER_RESOLUTION**, load the rules in
  `docs/mission-control/command-reference.md` and use
  `docs/mission-control/blocker-resolution-template.md`.
- **When handling Issue intake, or creating or normalizing an Issue**, load
  `docs/agent-loop/issue-intake-contract.md`.
- **When publishing HANDOFF**, load the HANDOFF section in
  `docs/mission-control/command-reference.md` and use
  `docs/mission-control/handoff-template.md`.
- **When reconstructing Context and command semantics**, load
  `docs/mission-control/command-reference.md` and perform CLI Discovery in the
  environment that can run repository commands.
- **When executing issue branch setup or implementation in Execution/IDE MC**,
  load `AGENTS.md` and `docs/agent-loop/issue-driven-branch-workflow.md`.

A contract's existence alone does not trigger loading it. Load only the
contract needed for the current request; do not bring unrelated phase rules
into Global MC.
