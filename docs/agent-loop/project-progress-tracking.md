# Main-Issue progress tracking

Canonical harness protocol for Core and multi-stage work across Bemoat starter and child projects.

Do **not** introduce `implementation-stage.md`, a Project Status Card, or any
second committed progress file, Parent/Child ledger, machine-readable graph,
or second router.
The current cross-agent protocol is
`bemoat:context` → one bounded objective → `bemoat:handoff` → fresh GitHub
reconstruction. Use the existing GitHub and PR artifacts with clear
responsibility boundaries.

## Historical managed-state artifact model

```text
Implementation Plan
= roadmap, Tasks, Slices, implementation dependencies, contracts, and verification requirements

Main GitHub Issue checklist
= durable cross-session project stage and first incomplete milestone

Active Task Issue
= bounded active scope and acceptance criteria

Pull Request + exact-head CI
= actual code state and deterministic verification evidence

.superpowers/sdd/progress.md
= temporary local/session execution tracker while an agent is working

Existing execution ledger
= audit history only for commits, RED/GREEN evidence, reviews, and residual risks;
it is not a Parent/Child state store or execution authority
```

### Implementation Plan

The Implementation Plan is the canonical **roadmap and execution contract**. It owns:

- Task and Slice definitions
- predeclared Child ordering and dependencies for decomposed initiatives
- architecture and interface contracts
- scope and non-scope
- deliverables
- required verification and review gates

The plan must **not** become a duplicate current-state dashboard. Task-step checkboxes inside a plan may remain execution instructions, but they are **not** the durable cross-session project stage.

### Main GitHub Issue / Parent Issue

The Main Issue checklist is the canonical **durable project stage** for Core or
multi-stage initiatives. For a decomposed initiative, that Main Issue serves as
the Parent Issue. Keep it concise. It owns:

- completed durable milestones
- the first incomplete milestone
- current Slice / Task / gate
- active Task Issue and PR pointers
- relevant plan section
- current blocker or dependency
- current founder gate
- one next permitted action

For a Parent/Child initiative, the existing Implementation Plan/Main Issue
contract is the single canonical predeclared source for Child ordering and
fixed prerequisite/dependency edges. The Parent map is only a verified
readback projection of that source, never a second dependency ledger. The
Parent projection must retain the first incomplete milestone, current Slice /
Task / gate, relevant plan section, current blocker or dependency, and Founder
gate where applicable. Concise readback must not drop these durable Main Issue
fields.

Do **not** copy full command logs, RED/GREEN transcripts, CI output, review
transcripts, bundle reports, or long commit histories into the Main/Parent
Issue. Those belong in the owning Task/Child Issue, PR, CI evidence, HANDOFF,
or existing audit ledger.

The Parent is coordination/readback only. Its ordered Child map and
dependencies are ordinary Markdown Issue links/checklists that project the
canonical predeclared Plan/Main contract; they are not a machine-readable
graph, second ledger, or authorization source. Before any Child is selected,
Global MC must verify the projection against that source and current durable
evidence. A missing, stale, unverified, or mismatching source or Parent map
fails closed with `STOP`; no Child selection, reorder, repair, or start is
permitted. A Parent may point at the active Child/PR/gate only after the
pointer and status are verified from the owning artifact.

### Parent and Child responsibility boundary

The Parent records only the goal/invariants, short decision references, the
verified projection of the canonical ordered Child map and fixed dependency
IDs, completed milestones and the first incomplete milestone, current Slice /
Task / gate, relevant plan section, current blocker or dependency, Founder
gate where applicable, `DONE`/`BLOCKED`/`DEFERRED`, one active Child/PR/gate,
and one next permitted action. It does not own a Child's implementation, test
transcript, review, CI, or HANDOFF. The Implementation Plan/Main Issue
contract remains the single predeclared order/dependency source; the Parent
does not alter it or maintain a competing state store.

Each Child remains a normal Active Task Issue with one active Objective and
Scope, exact plain-text workflow metadata, a Parent link, fixed prerequisites,
bounded acceptance criteria, allowed/forbidden effects, an authority-backed
oracle/verification plan, a Child-only finish condition, and source links. The
Child, its PR, exact-head CI, and applicable HANDOFF own the result; the Parent
only reads back verified status and pointers.

When Child completion is proven, it does not authorize or self-advance a
sibling. A different Issue requires fresh Global MC reconstruction and a
destination-specific Execution handoff. The existing #627 same-Issue
continuation remains valid only when the same Issue/session/workspace and
fresh authority still identify that continuation; it is not a cross-Issue
Parent-to-sibling shortcut.

### Active Task Issue

Canonical source for a standalone Single Task or bounded Child scope,
acceptance criteria, allowed and forbidden files/effects, required tests and
evidence, review findings, and task-specific Founder gates. A Child must be
self-contained; it must not require a sibling's prose to select its Objective
or Scope.

### Pull Request

Canonical source for actual code changes, implementation branch, approved base branch, current head SHA, review discussion, and current merge state.

### Exact-head CI

Canonical source for automated verification of the **exact current PR head SHA**.

- A successful CI run for an older SHA is **not** current evidence.
- Exact-head CI means GitHub verification attached to the exact current PR head SHA.
- The Main Issue may be updated after exact-head CI because editing an Issue does not change the PR head SHA.
- Do **not** create a documentation-only commit merely to record CI evidence after final CI is green.

### `.superpowers/sdd/progress.md`

Temporary local/session tracker only. It may contain command-level progress, RED/GREEN notes, temporary next-step notes, and interrupted-session recovery context.

It is **not** the cross-session, cross-device, or project-wide source of truth and must not replace the Main Issue checklist.

### Agent summaries

Previous chat, Composer, Codex, or reviewer summaries are hints only. They cannot override repository and GitHub evidence.

## Conflict precedence

When artifacts conflict:

1. The current PR head, merge state, and exact-head CI are authoritative for current code state.
2. The active Task Issue is authoritative for current bounded scope and acceptance.
3. The Implementation Plan is authoritative for roadmap, dependencies, and permitted ordering.
4. The Main Issue checklist is authoritative for the last synchronized durable project stage after GitHub verification.
5. `.superpowers/sdd/progress.md`, execution ledgers, and agent summaries cannot override verified Plan, Issue, PR, or CI state.
6. Correct the Main Issue only after the discrepancy is verified.

## Main Issue milestone model

Adapt milestones to the initiative. Recommended form:

```md
## Durable Progress

### Slice A — Foundation

- [x] Task 1 implementation complete
- [x] Task 1 task-level review passed
- [x] Exact-head CI passed
- [x] Founder merge approval
- [x] PR merged into the approved base branch

### Slice B — Acquisition Handoff

- [ ] ...

## Current Stage

- First incomplete milestone:
- Current Slice:
- Current Task or gate:
- Active Task Issue:
- Active PR:
- Relevant plan section:
- Current blocker or dependency:
- Founder gate:

## Next Permitted Action

One concrete action only.
```

For Parent/Child initiatives, the checklist above is a concise readback of
verified child milestones, not a second progress ledger. Do not mark a Child
complete from a Parent checkbox alone, and do not treat a completed Child as a
permission to begin its sibling.

## Durable checklist completion rules

| Milestone | Check only when |
|-----------|-----------------|
| Task implementation complete | Scoped implementation is complete; required focused tests pass; focused commit exists; no known implementation blocker remains |
| Task-level review passed | Required specification and quality/security reviews are complete; no Critical or Important finding remains open |
| Whole-slice review passed | All required Tasks in the Slice are complete; composed Slice behavior reviewed; no Critical or Important whole-slice finding remains |
| Focused tests, E2E, bundle, or contamination gates | Final code head used for the gate passes and the gate applies |
| Exact-head CI passed | GitHub CI succeeds on the exact current PR head SHA |
| Founder merge approval | Explicit founder decision recorded — do not infer from mergeability, green CI, or agent summaries |
| PR merged | PR merge commit exists in the approved base branch |

A Slice is not fully complete until its PR is merged into the approved base branch.

## Update timing

### During implementation

Use `.superpowers/sdd/progress.md` for temporary execution progress. Do **not** edit the Main Issue for every command, retry, RED/GREEN transition, minor corrective commit, or CI rerun.

The coordination workflow may reconcile verified Issue/PR evidence and make
localized in-scope corrections without a Founder decision. Founder decisions
remain required for material scope, Acceptance Criteria, or architecture
changes; exhausted review budget; reopening; merge; production, migration,
destructive work, and required manual QA.

### Before PR creation or update

- audit the active Task Issue acceptance criteria
- publish the current Task Issue `## HANDOFF` with `bemoat:handoff` per
  [role-handoff-contract.md](./role-handoff-contract.md)
- update only Main Issue milestones that are already durably proven
- identify the current gate and next permitted action

### After review or exact-head CI

Update the Main Issue when a durable gate changes. This is the preferred place to record gate changes after final CI.

### After merge

Update the Main Issue when merge evidence is confirmed in the approved base branch.

### Illustrative Parent/Child map

The canonical non-mutating #637 Parent plus proposed A → B → C → D checklist
map is in [issue-intake-contract.md](./issue-intake-contract.md). It is an
ordinary-link/readback example only: it does not create or rewrite #637 or any
other Issue, change #637's active scope, or authorize execution.

## New-session resume protocol

```text
Main GitHub Issue
→ find the first incomplete Task, Slice, or gate
→ open the linked active Task Issue and Pull Request
→ verify branch, approved base, current head SHA, and exact-head CI
→ inspect unresolved Critical or Important findings
→ read only the referenced Task or Slice section of the Implementation Plan
→ continue only the next permitted action
```

Do not read the entire Implementation Plan merely to determine the current stage when the Main Issue already identifies the active milestone and relevant plan section.

If the next permitted action names a Child, verify that Child's own Issue,
prerequisite IDs, branch/PR/head, exact-head CI, review, and applicable
HANDOFF, and compare its Parent readback map with the canonical predeclared
Plan/Main contract. Do not infer a Child's authority from the Parent map, a
checked Parent item, or a sibling result. A stale, unverified, or mismatching
map is `STOP`. If the next work is a different Issue, begin with fresh Global
MC reconstruction and a destination-specific handoff.

## Agent completion protocol

Before closing a Task Issue or marking a durable Main Issue milestone:

1. Verify acceptance criteria against the Task Issue.
2. Confirm the PR head SHA and exact-head CI when CI is required.
3. Confirm no open Critical or Important findings block the gate.
4. Record founder approval only when explicitly given.
5. Update the Main Issue only for durably proven milestone or gate changes.
6. Publish the canonical `## HANDOFF` with `bemoat:handoff`, including PR URL,
   exact head, commands, test results, acceptance criteria audit, and next
   permitted action. See [role-handoff-contract.md](./role-handoff-contract.md).

## Preflight (`bemoat:context`)

`pnpm run bemoat:context <issue-number> --json` stays **read-only**. It must
never mutate issue checklists, plan files, PR state, branch state, or CI state.

The former compatibility preflight is retired and must not be selected for new
work.

The current supported preflight does not require or initialize managed Mission
Control state. New work is routed only from fresh GitHub/native Git evidence by
`bemoat:context`.

### Hard blockers

Produce a clear blocker when:

- a declared Main Issue cannot be found
- a declared canonical Implementation Plan path cannot be found
- a declared relevant plan section cannot be resolved well enough to continue safely
- the current active PR is required to continue but cannot be identified deterministically
- exact-head CI is required by the current gate but current-head status cannot be verified
- the current gate is blocked by unresolved Critical or Important findings
- dependent work would begin before the Main Issue and GitHub evidence prove the prerequisite milestone
- required live Issue/PR/CI evidence cannot be retrieved (`BLOCKED_EXTERNAL`)

### Warnings only

Produce a warning, not a blocker, when:

- the issue is valid but has no Main Issue because the task is Small or standalone
- the issue has no Implementation Plan because the work does not require one
- the Main Issue is missing optional convenience metadata but the next permitted action is still deterministic
- older CI exists but exact-head CI is also available and authoritative

For Founder gates, block only on a declared current gate or the first
incomplete Founder milestone. Future Founder milestones do not block the
current permitted action.

Do not silently fall back to a previous agent summary when declared GitHub or plan state is missing.

### Historical migration-only state behavior

Retained compatibility readers may report `STATE_MIGRATION_REQUIRED` for an
absent legacy managed-state block, `STATE_CONFLICT` for contradictory legacy
state, or a warning for a non-managed historical task. These classifications
exist only to interpret or migrate old records; they must not become a current
preflight requirement.

## Child adoption contract

After this starter change merges, each affected child project must:

1. create a dedicated harness-sync branch
2. run `pnpm run bemoat:boilerplate:sync -- --harness-only`
3. validate safety and harness drift
4. open or update a child sync PR
5. identify or normalize the initiative's Main Issue
6. add a concise durable progress checklist to the Main Issue from verified Plan and GitHub evidence
7. link active Task Issues and PRs
8. keep unproven and future milestones unchecked

See [harness-sync-workflow.md](./harness-sync-workflow.md) and [source-of-truth.md](./source-of-truth.md).

## Related docs

| Doc | Use for |
|-----|---------|
| [issue-driven-branch-workflow.md](./issue-driven-branch-workflow.md) | Branch gates and PR workflow |
| [checklist.md](./checklist.md) | Task-size tiers and validation |
| [issue-intake-contract.md](./issue-intake-contract.md) | Issue structure normalization |
| [../superpowers/plans/README.md](../superpowers/plans/README.md) | Plan organization and boundaries |
| [AGENTS.md](../../AGENTS.md) | Default agent workflow |
