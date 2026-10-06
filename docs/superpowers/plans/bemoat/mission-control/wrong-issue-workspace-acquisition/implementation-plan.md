# Wrong-Issue Workspace Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: null
task_key: "issue-573-wrong-issue-workspace-acquisition"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#573"
branch_template: "fix/573-wrong-issue-workspace-recovery"
transition_target: "FOUNDER_GATE"
planning_base_sha: "f047963ddda7e166a29b91899fd6e222d97f7ab6"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: null
paired_plan: null
```
<!-- bemoat-task-identity:end -->

**Goal:** Let Execution recover from a clean wrong-Issue workspace by reusing one exact queried-Issue workspace or provisioning an isolated canonical checkout, without Founder Git setup or loss of the original workspace.

**Architecture:** Keep `docs/mission-control/execution-handoff-contract.md` as the single authority for acquisition order, exact evidence, and stop boundaries. Keep Context read-only and retain its existing `STOP` route and exact branch-switch recovery; Execution performs only the explicitly bounded workspace setup, then reruns CLI Discovery and fresh Context.

**Tech Stack:** Markdown mission-control contracts, TypeScript Context routing, Vitest integration stories.

**Spec:** [Issue #573](https://github.com/boat1994/bemoat-web-starter/issues/573), especially Founder direction comments `6008304115` and `6008320328`.

## Global Constraints

- Prefer one uniquely proven clean, durable, canonical queried-Issue workspace before provisioning.
- Provision only a separate canonical checkout at the exact live approved-base SHA; preserve the wrong-Issue checkout unchanged.
- Use the existing durable zero-delta issue-branch bootstrap only when its full eligibility checks pass.
- Keep Context read-only and retain `STOP` / `FOUNDER_GATE` semantics; acquisition grants no implementation authority.
- Dirty, non-durable, stale, ambiguous, conflicting, noncanonical, destructive, or host-capability cases remain fail-closed.
- Add no general scheduler/worktree manager, no HANDOFF schema change, and no autonomous merge.

## Review Focus

- A unique live target that is already checked out locally must use the existing branch and exact matching upstream; stale/local divergence must suppress recovery.
- An unmerged active PR must not route work from a numbered wrong-Issue workspace; only its exact live branch/head may be recovered, while matching PR work and valid merged terminal reconstruction remain unchanged.
- An unavailable or conflicting canonical base must stop before provisioning.
- A wrong-Issue checkout must remain byte-for-byte and worktree-state unchanged while a sibling workspace is prepared.
- Fresh Context after acquisition must still control whether implementation may begin.
- Existing same-Issue routing, sync recovery, and STOP boundaries must remain unchanged.

---

### Task 1: Specify canonical acquisition and route entrypoints

**Files:**
- Modify: `docs/mission-control/execution-handoff-contract.md`
- Modify: `docs/agent-loop/issue-driven-branch-workflow.md`
- Test: `tests/int/mission-control-loader-router.int.spec.ts`

**Interfaces:**
- Consumes: current exact bounded recovery section, durable zero-delta bootstrap contract, and Founder direction comment `6008320328`.
- Produces: one canonical acquisition order and linked entrypoints that direct agents to it without duplicating authority.

- [x] Verify the new authority-backed characterization fails before the documentation change.
- [x] Specify the ordered path: reuse exactly one eligible Issue workspace; otherwise provision a separate exact-live-base clone only when canonical identity and permissions are known; otherwise stop.
- [x] Specify exact readback, zero-delta bootstrap eligibility, unchanged source-workspace state, and immediate CLI Discovery plus fresh Context.
- [x] Run `pnpm exec vitest run --config ./vitest.config.mts tests/int/mission-control-loader-router.int.spec.ts` and expect all stories to pass.

### Task 2: Close exact branch-recovery test gaps

**Files:**
- Modify: `tests/int/context-evidence.int.spec.ts`
- Modify only when required by an authority-backed failing story: `scripts/context/local-git.ts`, `scripts/context/no-pr-routing.ts`, `scripts/context/evidence.ts`, `scripts/context/model.ts`, `scripts/context/router.ts`, `scripts/agent-context.ts`

**Interfaces:**
- Consumes: the existing `SWITCH_BRANCH` recovery binding and candidate evidence.
- Produces: explicit local-target reuse coverage, exact repository/Issue/base/source/target binding, and fail-closed characterization for stale, conflicting, or noncanonical upstreams.

- [x] Add a story where the unique target is already local, at the live SHA, with exact `origin/<branch>` upstream; expect one exact local switch.
- [x] Add a nearby conflicting local-head/upstream story and a durable source tracking another remote; expect STOP without recovery.
- [x] Bind every recovery to exact repository, Issue, protected-base branch/SHA, source and target branches/heads, and source durability.
- [x] Keep PR-owned exact branch/head routing intact, recover a unique mismatched active-PR workspace only to its exact live PR head, and preserve merged terminal routing.
- [x] Run `pnpm exec vitest run --config ./vitest.config.mts tests/int/context-evidence.int.spec.ts` and `pnpm exec vitest run --config ./vitest.config.mts tests/int/context-sync.int.spec.ts`.

### Task 3: Exercise the bounded workspace path and preserve scope

**Files:**
- No production files outside the paths above.
- Evidence: disposable clone under `/private/tmp`; never use or alter `/Users/boat/projects/bemoat-web-starter`.

**Interfaces:**
- Consumes: the canonical acquisition order from Task 1 and the exact recovery behavior from Task 2.
- Produces: a recorded pre-merge dogfood result and a clear post-merge acceptance status without merging autonomously.

- [x] Verify canonical live refs, clone origin, exact source and base SHAs, branch identity, and clean status before acting.
- [x] Exercise the exact reuse switch in the disposable wrong-Issue clone; preserve the original checkout and rerun registered CLI Discovery plus fresh Context.
- [ ] Repeat this dogfood after human merge. The no-autonomous-merge rule makes post-merge acceptance wait for that gate.

### Task 4: Validate, review, and publish

**Files:**
- All changed implementation, test, and plan paths.

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: one focused commit, an updated/created PR targeting `main`, independent semantic review, and required HANDOFF/readback.

- [x] Run focused Context, sync, documentation, and safety tests.
- [x] Run `pnpm run check` and `git diff --check`.
- [x] Obtain independent semantic review from a worker distinct from the controller and intermediate test author.
- [ ] Audit every live Issue #573 acceptance criterion in the PR body; distinguish completed evidence from post-merge or human-gated items.
- [ ] Push and open/update the PR; publish the registered HANDOFF required by fresh Context. Do not merge.
