# PStack Execution Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: null
task_key: "issue-562-pstack-execution-cutover"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#562"
branch_template: "feat/562-pstack-execution-cutover"
transition_target: "FOUNDER_GATE"
# Historical initial preservation evidence only; these values are not current authority.
planning_base_sha: "f6530197de0c0811b5d58c42350a1f4f30ab5926"
starting_topic_head_sha: "61282aa4febee510923d38bad6d5468630122a65"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: null
paired_plan: null
```
<!-- bemoat-task-identity:end -->

**Goal:** Make the verified Cursor PStack v0.15.29 tree the HOW layer for already-authorized Bemoat objectives without changing Bemoat routing, gates, durable Issue lineage, or review authority.

**Architecture:** Add one small project-local execution contract and one Cursor rule that bind official PStack skills/playbooks to Bemoat's existing `COMMAND` seam. The contract and rule are declarative: Bemoat Context, Handoff, STOP, FOUNDER_GATE, exact-head, lineage, and review rules remain authoritative; PStack supplies worker-oriented execution mechanics only after authorization. Existing `bemoat:pstack` remains the pin/check/discover utility and is not extended into a second router or controller.

**Tech Stack:** Markdown policy contracts, the existing Cursor PStack v0.15.29 cache, TypeScript/Vitest integration tests, existing boilerplate-sync inventory, and the existing CLI/result-envelope contract.

**Spec:** GitHub Issue #562, https://github.com/bemoat/bemoat-web-starter/issues/562 (governing specification and acceptance criteria).

## Historical initial #562 preservation snapshot (not current authority)

The exact identities below are retained as historical preservation evidence.
Resolve current execution lineage from the authorized live evidence instead.

- Issue: `#562`
- Branch: `feat/562-pstack-execution-cutover`
- Upstream: `origin/feat/562-pstack-execution-cutover`
- Exact topic HEAD: `61282aa4febee510923d38bad6d5468630122a65`
- Current approved protected base branch: `origin/main`
- Current approved protected base HEAD: `f6530197de0c0811b5d58c42350a1f4f30ab5926`
- PR: none
- Merge: prohibited

## Global Constraints

- Consume only `cursor/plugins@88d47514b82e7c44f00f2b2a72ff6dd12158038c` / PStack `0.15.29`, with the checked-in tree and manifest hashes.
- Bemoat decides WHETHER / WHAT is authorized; PStack decides HOW to execute only after fresh Context returns `next_action.type: COMMAND` for the bounded objective.
- `automatic_routing` remains `false`; no PStack skill or agent may create a Bemoat route, state, evidence vocabulary, or gate bypass.
- Exactly one accountable Bemoat controller remains orchestration-only; characterization, test/oracle authoring, mutation, and deterministic verification are worker/skill-owned.
- The implementation worker is a distinct sole mutation owner; the independent semantic reviewer is distinct from both controller and implementer.
- Characterization and deterministic verification each use distinct `poteto-agent` workers with read-only scopes; `poteto-mode` remains receiving-chat HOW orchestration only, and the controller performs neither role.
- The model/effort criterion remains advisory and deferred pending native Cursor host configuration proof; no unsupported PStack model-routing configuration is added or claimed.
- STOP, FOUNDER_GATE, COMPLETE, exact-head CI, HANDOFF/readback, and merge authority remain unchanged.
- Same-Issue execution reattaches to one verified durable branch lineage; PStack cannot invent branch/worktree ownership or authorize destructive cleanup.
- Terminal workspace release is Bemoat-owned: direct/single checkout release requires durable exact-head readback, sole ownership, no active writer, and no unpushed work; task-worktree release/removal requires exact branch/head durability, unique ownership, clean state, and primary-checkout preservation. Missing proof is `STOP`, and PStack never performs destructive cleanup.
- The PStack denylist includes bare Cursor `/autopilot`, `opening-a-pr`, PR/push/merge mutation, shipping/autonomous-run/autopilot-full/autopilot-stack/worktree-cleanup/orchestrate playbooks, deployment, migration, and any route/state/evidence/gate invention; later commit/push/PR gates remain outside PStack HOW.
- Cursor-only or unavailable worker capabilities remain explicit host limitations and fail closed; no fake runtime or controller fallback is permitted.
- Do not touch the frozen `/private/tmp/bemoat-web-starter-562-execution` or `/private/tmp/bemoat-web-starter-562-pnpm-store` paths; do not create another checkout/worktree, merge, deploy, migrate, or push/PR from this worker.

## Review Focus

- An authorized objective must use PStack only after fresh `COMMAND` and the first-edit gate; STOP and FOUNDER_GATE must remain mutation-free. Test in the adapter contract and loader/handoff integration assertions.
- The Bemoat controller must not self-execute or become a mutation fallback; the implementation worker must be distinct and sole writer. Test the role topology and worker-failure boundary.
- The semantic reviewer must remain independent from both controller and implementer, including when PStack selects the review skill. Test explicit identity separation.
- PStack discovery/check must remain read-only and routing-disabled, and a missing/unsupported host capability must not be replaced by a simulated runtime. Test the pinned utility output and host limitation text.
- Restart/workspace topology must preserve the exact Issue branch/head/upstream lineage and existing Handoff/fresh-Context loop. Test the lineage and post-result seam without inventing a new route.

### Task 1: Add the project-local PStack execution contract

**Files:**
- Create: `.cursor/rules/bemoat-pstack-execution.mdc`
- Create: `docs/mission-control/pstack-execution-contract.md`
- Modify: `docs/pstack.md`
- Test: `tests/int/pstack-execution-cutover.int.spec.ts`

**Interfaces:**
- Consumes: verified `bemoat:pstack check`/`discover` output and the official pinned PStack tree.
- Produces: a declarative HOW-layer contract and Cursor activation rule naming the post-`COMMAND` PStack skills/playbooks, Bemoat authority precedence, worker role boundaries, host limitation behavior, and durable lineage/Handoff obligations.

- [x] **Step 1: Write the failing contract test**

  Add a focused test that reads the new contract and asserts only Issue-backed invariants: exact pin/version, `automatic_routing: false`, Context-first authorization, STOP/FOUNDER_GATE exclusion, one orchestration-only controller, separate implementation owner, independent reviewer, durable lineage, required Handoff/fresh Context, advisory model routing, and explicit Cursor-host limitation. Also assert the existing `bemoat:pstack` utility remains discovery/check-only.

- [x] **Step 2: Run the focused test to verify RED**

  Run `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts --config ./vitest.config.mts`.

  Expected: FAIL because the project-local PStack execution contract does not exist yet.

- [x] **Step 3: Implement the minimal contract and pin documentation**

  Write `docs/mission-control/pstack-execution-contract.md` and `.cursor/rules/bemoat-pstack-execution.mdc` as an adapter, not a second orchestration framework. Map official `poteto-mode`/`poteto-agent`/`tdd`/`principle-prove-it-works`/review capabilities to worker-owned roles, require distinct read-only `poteto-agent` characterization and deterministic-verification workers, require the existing Bemoat public seams before and after execution, explicitly deny bare `/autopilot`, `opening-a-pr`, PR/push/merge mutation, shipping/autopilot/worktree-cleanup, terminal cleanup, and gate-inventing behavior, and state that unsupported Cursor subagent capabilities stop rather than fall back. Update `docs/pstack.md` to distinguish the non-activating cache utility from this authorized-objective HOW layer.

- [x] **Step 4: Run the focused test to verify GREEN**

  Re-run `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts --config ./vitest.config.mts`.

  Expected: PASS with no mutation beyond the task-local ignored cache.

### Task 2: Wire the adapter into the existing Mission Control seams

**Files:**
- Modify: `prompts/mission-control/chatgpt-project-loader.md`
- Modify: `docs/mission-control/execution-handoff-contract.md`
- Modify: `docs/mission-control/README.md`
- Modify: `scripts/boilerplate/inventory.ts`
- Modify: `.bemoat/boilerplate-sync-manifest.json`
- Modify: `tests/int/pstack-execution-cutover.int.spec.ts`

**Interfaces:**
- Consumes: Task 1's project-local PStack execution contract.
- Produces: progressive loading and handoff language that invokes the adapter only for an already-authorized objective, while preserving the existing 15-section handoff and managed-path projection.

- [x] **Step 1: Add the failing seam assertions**

  Extend the focused test to assert that the loader and Execution contract load the adapter only after authorized objective routing, prohibit PStack use at STOP/FOUNDER_GATE, preserve the existing route vocabulary, and include the adapter plus regression test in both source and checked-in sync inventories.

- [x] **Step 2: Run the focused test to verify RED**

  Run `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts --config ./vitest.config.mts`.

  Expected: FAIL because the existing loader, handoff contract, and sync inventories do not reference the new adapter.

- [x] **Step 3: Implement the minimal seam wiring**

  Add one authorized-objective phase-contract reference to the loader and Section 8's existing delegation rules, list the adapter in the Mission Control README, and add the exact new contract/test paths to `managedPaths` in source and manifest. Do not add a command, route, state, scheduler, or new Bemoat controller.

- [x] **Step 4: Run the focused test to verify GREEN**

  Re-run `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts --config ./vitest.config.mts`.

  Expected: PASS, including the source/manifest inventory parity assertions.

**Correction-round TDD evidence (round 1):**

- RED: `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts --config ./vitest.config.mts` failed 2 of 3 tests because the Cursor rule did not exist and the handoff contract did not reference it.
- GREEN: the same command passed 3 of 3 tests after the rule and Cursor seam references were added.
- Regression correction: the Mission Control loader suite briefly exceeded its 5,350-character budget by six characters; compacting the activation line restored the suite to green.

**Correction-round TDD evidence (round 2):**

- RED: after adding the cache-independent rule/contract seam assertions and the `docs/pstack.md` denylist assertion, `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts --config ./vitest.config.mts` reported 4 tests with 1 failure because `docs/pstack.md` did not yet state the `opening-a-pr` / PR-push-merge boundary. The same run also exposed an over-broad single-regex lineage assertion; it was narrowed to the handoff contract's separate authoritative exact-head and canonical-origin/upstream clauses.
- GREEN: after the minimal `docs/pstack.md` wording and assertion correction, the same command passed 1 file and 4 tests. The cutover test now uses only checked-in registry/docs/rule seams; temporary verified-cache runtime coverage remains in `tests/int/pstack-pin.int.spec.ts`.
- Additional RED: after adding direct managed-path, exact Issue/branch/base-head, controller/worker, and reviewer-topology assertions, the same focused command reported 4 tests with 1 failure because the Cursor rule did not explicitly label the Bemoat controller `orchestration-only`.
- Additional GREEN: after the minimal Cursor-rule wording change, the focused command passed 1 file and 4 tests; the full six-file Mission Control/PStack focused suite passed 6 files and 192 tests.

**Correction-round TDD evidence (round 3):**

- RED: the focused cutover test reported 9 tests with 5 failures for bare `/autopilot`, deferred model/effort wording, explicit read-only worker topology, loader contract loading, and the exact #562 handoff tuple.
- GREEN: after the minimal rule, contract, `docs/pstack.md`, loader, and focused-test updates, the cutover test passed 9 tests and the loader-router suite passed 27 tests; a follow-up RED/GREEN cycle added and verified the explicit rule-level prohibition on controller characterization and deterministic verification.

**Correction-round TDD evidence (final correction round):**

- RED: before the production/doc edits, `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts --config ./vitest.config.mts` failed 5 of 9 tests for the missing bare Cursor `/autopilot` denial, missing advisory/deferred model-routing boundary, missing distinct read-only `poteto-agent` topology, missing authorized-phase contract loading, and missing exact #562 lineage tuple.
- GREEN: the same focused command passed 1 file and 9 tests after minimal updates to the rule, contract, `docs/pstack.md`, loader, and assertions. A follow-up RED/GREEN cycle for the controller prohibition passed 9 of 9 after adding the explicit rule statement that the controller does not characterize or perform deterministic verification.
- Regression GREEN: `pnpm exec vitest run tests/int/mission-control-loader-router.int.spec.ts tests/int/mission-control-delegation-policy.int.spec.ts --config ./vitest.config.mts` passed 2 files and 81 tests; the loader remains within its existing 5,350-character budget at 5,346 characters.
- Focused GREEN: `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts tests/int/pstack-pin.int.spec.ts tests/int/mission-control-delegation-policy.int.spec.ts tests/int/mission-control-loader-router.int.spec.ts tests/int/boilerplate-sync.int.spec.ts tests/int/guard-planning-contract.int.spec.ts --config ./vitest.config.mts` passed 6 files and 197 tests.
- Repository GREEN: `pnpm run typecheck`, focused ESLint with `--max-warnings 0`, and `git diff --check` passed. The current correction instruction prohibited rerunning PStack CLI discovery/help; no native Cursor runtime execution is claimed. Existing broader `guard:safety`/`check` blockers remain the previously observed planning-contract baseline violations, not this correction's host seam.

**Correction-round TDD evidence (lineage and section 12 final correction):**

- RED: after adding the separate topic-head/protected-base assertions and cache-free section 12 ordering assertions, `pnpm exec vitest run tests/int/pstack-execution-cutover.int.spec.ts --config ./vitest.config.mts` failed 2 of 11 tests because the contract and plan still used the old `Exact HEAD/base` and `planning_base_sha` values.
- GREEN: after changing the contract to separate Issue, branch, upstream, exact topic HEAD, approved protected base branch/HEAD, PR, and merge fields, and changing the plan to record the approved protected base as `planning_base_sha` plus the historical starting topic head separately, the focused test passed.
- Additional RED: after extending the same test to require the complete lineage tuple in the plan, it failed 1 of 11 tests because the plan had not yet repeated the exact Issue, branch, upstream, topic HEAD, approved protected base, PR, and merge fields outside its task-identity metadata.
- Final GREEN: after adding the explicit plan lineage section, the focused test passed 11 of 11. The section 12 assertions bind canonical P1-before-P2/P3 ordering, R1-before-R2, one R2 replacement, and no pre-Context objective-work bypass without invoking install or CLI Discovery/Context.

## Correction checkpoint and outstanding validation

The final post-correction candidate, including the latest STOP-recovery wording
correction, has the following local validation evidence:

- Focused regressions passed with exit 0: `pnpm exec vitest run --config
  ./vitest.config.mts tests/int/pstack-execution-cutover.int.spec.ts
  tests/int/mission-control-loader-router.int.spec.ts
  tests/int/mission-control-delegation-policy.int.spec.ts` — 3 files, 96/96
  tests.
- A separate earlier malformed verifier invocation accidentally ended in a
  trailing `.` and broadened to the full suite; it failed on loopback `EPERM`.
  This was a separate failed invocation, not a valid focused pass.
- Full check passed with exit 0 on command-scoped Host escalation:
  `PAYLOAD_SECRET=ci-placeholder pnpm run check`. The safety guard passed 11
  checks; lint and typecheck passed; integrations passed 83 files and
  1,721/1,721 tests. API integration passed within the suite and no `EPERM` was
  reported. The captured verifier output had no separate listener-status line.
  The only warning was the nonfatal missing-email-adapter notice.
- Standalone `pnpm run guard:safety` and `git diff --check` passed.
- An intermediate worker in the external workflow performed read-only
  registered CLI help and Context; Context returned
  `STOP / LOCAL_STATE_NOT_DURABLE`. This did **not** authorize native
  `COMMAND`; no source mutation was attributed to native Context. No HANDOFF or
  native PStack activation occurred, and native STOP remains unchanged.
- Exact-head PR CI: **PENDING**.
- Post-correction independent semantic review: **PASS** — zero
  Critical/Important findings. The reviewer was independent of the Controller,
  implementation, test author, and verification workers. Follow-up confirmed
  the Host-specific Codex mapping Minor is resolved. Independent PR-head
  review: **PENDING**.
- Native PStack runtime acceptance: **PENDING**; external workflow and local
  checks do not establish native activation or runtime execution.
- Delivery (commit, push, and PR) remains **PENDING** in the external Surgery
  Mode workflow.

### Task 3: Run bounded semantic and repository validation

**Files:**
- No additional files; validate the Task 1–2 diff.

- [x] **Step 1: Run focused PStack and Mission Control tests**

  Run the new focused test, `tests/int/pstack-pin.int.spec.ts`, and the existing Mission Control delegation/loader tests. The cutover test must not assume `.bemoat/pstack-cache`; temporary verified-cache install/check/discover coverage remains owned by `tests/int/pstack-pin.int.spec.ts`. Confirm the exact pinned cache remains clean and reports `automatic_routing: false`.

- [x] **Step 2: Run the registered PStack contract checks**

  Run `pnpm run bemoat:pstack -- --help --json`, `pnpm run bemoat:pstack -- check --json`, `pnpm run bemoat:pstack -- discover --json`, and the invalid `pnpm run bemoat:pstack -- execute --json` invocation. Confirm the help/result envelopes, read-only classifications, and fail-closed invalid invocation from the registered command; do not invoke PStack through an invented runtime.

- [x] **Step 3: Run required starter validation**

  Run `pnpm run guard:safety`, `pnpm run check`, `pnpm run typecheck`, and focused lint because the adapter changes Mission Control harness behavior and integration tests. Run `git diff --check`, inspect `git status --short`, and review the diff for frozen-path access, secrets, unrelated files, and new route/state vocabulary.

  Evidence: the focused and full checks above passed after the latest source/doc correction. `guard:safety` and `git diff --check` passed, and the fresh independent reviewer audited the complete 16-path candidate for scope, secrets, and routes.

- [x] **Step 4: Record the worker result without durable GitHub mutation**

  Leave the branch uncommitted and unpushed unless the controller explicitly requires one focused commit after verification. Report exact RED/GREEN commands and results, focused/full validation, remaining host/spec risks, and the final diff/status summary to the controller; do not open a PR, publish a HANDOFF, or merge from this worker.
