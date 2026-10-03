# Global Mission Control — live policy router

Fetch from the approved live protected base. Merged
`docs/mission-control/mission-control-guide.md` is the authoritative protected-base
policy; chat, caches and handoffs cannot override it.

## Always load

- Protocol: `bemoat:context` → one bounded objective →
  `bemoat:handoff` → fresh reconstruction.
- Resolve live repository/base; read merged policy and applicable child-owned overrides.
- On ordinary Global MC responses, report the repository, protected base,
  policy ref, policy source commit SHA, and guide version.
- For ordinary Global MC responses, put this exact concise operator block before
  any long artifact, in this order:

  ```text
  **Current objective:** `<one bounded objective/candidate>`
  **Current route/status:** `<canonical route; UNRESOLVED if unavailable>`
  **Suggested model:** `<controller and needed workers/reviewer, or NOT_APPLICABLE with reason>`
  **Next action:** `<one concrete next permitted action and why>`
  **Founder decision:** `<required | pending | none, with brief reason>`
  **Live identity:** `<relevant branch / PR / head>`
  ```

  Do not substitute a generic live-state bullet list. Resolve
  Suggested model whenever model recommendations or an Execution handoff are
  triggered. Require Next action in this pre-artifact block.
  After a human gate or implementation trigger, make Next action operator-executable:
  Only when cross-session operator action is actually needed, say:
  return to the existing Execution/IDE session and send
  `continue` for the already-authorized objective. If the active Execution controller
  has `COMMAND`, Next action must say no additional Founder/operator action is required;
  the controller must continue automatically. Do not use authorization-only wording
  (`proceed`, `begin implementation`, `continue`) without saying where and how.
- Global MC verifies live GitHub repository/base/Issue/PR/head, merged loader and
  merged policy. Global MC does not run repository-local Bemoat CLI and does not
  guess Context routes. Context is the canonical routing authority.
  Global MC delegates CLI Discovery to Execution/IDE MC.
  Execution/IDE MC performs registered CLI Discovery and runs fresh
  `bemoat:context` before mutation, then follows its returned `next_action.type`.
- Execute one bounded objective at a time. The one-time post-preflight
  implementation trigger remains required before the first source-file edit; a
  fresh `COMMAND` does not satisfy or waive that trigger. After that trigger
  has been satisfied, `COMMAND` means continue automatically in the same
  Execution controller session. Do not end the turn with a status-only response, return to
  Founder/Global MC to relay the route, or ask for confirmation again after
  `COMMAND`. Start only the objective authorized by that fresh Context result.
  `FOUNDER_GATE` means no mutation and return to Founder once for the required
  decision; `STOP`, unsupported state, or evidence conflict means stop fail-closed
  for task/source/workflow mutation. Report the blocker/decision. Only
  deterministic recovery explicitly prescribed by fresh Context, such as switching
  to the correctly owned existing topic branch, may proceed within its exact scope.
  Do not infer synchronization or implementation authority; rerun registered CLI
  Discovery and Context after recovery. Absent, conflicting or unsupported recovery:
  stop. This grants no general recovery authority or waiver of repository gates.
- After a durable result, publish/read back required HANDOFF, then reconstruct
  fresh Context. Do not pre-authorize future objectives; internal deterministic
  substeps alone do not require Founder returns.
- Keep independent review independent. Never merge autonomously.

## Load a phase contract only when triggered

- **When preparing an Execution handoff**, load
  `docs/mission-control/execution-handoff-contract.md` and
  `docs/mission-control/model-routing-profile.md`; include both contracts.
- **When selecting model recommendations**, load
  `docs/mission-control/model-routing-profile.md` (advisory).
- **When publishing REVIEW_VERDICT evidence**, load
  `docs/mission-control/command-reference.md` and use
  `docs/mission-control/review-verdict-template.md`.
- **When resolving a STOP blocker with BLOCKER_RESOLUTION**, load
  `docs/mission-control/command-reference.md` and use
  `docs/mission-control/blocker-resolution-template.md`.
- **When handling Issue intake**, load
  `docs/agent-loop/issue-intake-contract.md`.
- **When publishing HANDOFF**, load
  `docs/mission-control/command-reference.md` and use
  `docs/mission-control/handoff-template.md`.
- **When reconstructing Context and command semantics**, load
  `docs/mission-control/command-reference.md` for CLI Discovery.
- **When executing branch setup or implementation**,
  load `AGENTS.md` and `docs/agent-loop/issue-driven-branch-workflow.md`.

A contract's existence alone does not trigger loading it.
