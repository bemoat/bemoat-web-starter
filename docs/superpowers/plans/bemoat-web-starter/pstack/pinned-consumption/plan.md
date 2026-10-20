# Pinned PStack Consumption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: null
task_key: "issue-561"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#561"
branch_template: "chore/561-pstack-pinned-consumption"
transition_target: "AWAITING_REVIEW_1"
planning_base_sha: "572630df1776138a052d4290bdc2d42a41792899"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: "docs/superpowers/specs/bemoat-web-starter/pstack/pinned-consumption/design.md"
paired_plan: "docs/superpowers/plans/bemoat-web-starter/pstack/pinned-consumption/plan.md"
```
<!-- bemoat-task-identity:end -->

**Goal:** Add a deterministic, integrity-verified, task-local PStack cache and read-only discovery surface for Bemoat Issue #561 without activating routing or changing Bemoat authority.

**Architecture:** Store the official Cursor PStack commit, version, subtree, and manifest hashes in a small checked-in pin file. A dependency-free Node utility manages an ignored cache and exposes explicit install/check/discover operations; it never changes agent configuration or executes PStack. Add only the sync metadata needed for future child compatibility.

**Tech Stack:** TypeScript executed with the existing `tsx` runtime, Node built-ins, Git CLI, Vitest integration tests, existing boilerplate sync inventory.

**Spec:** `docs/superpowers/specs/bemoat-web-starter/pstack/pinned-consumption/design.md`

## Global Constraints

- Official source is `cursor/plugins@88d47514b82e7c44f00f2b2a72ff6dd12158038c/pstack`.
- Official plugin version is `0.15.29`.
- Exact upstream commit is `88d47514b82e7c44f00f2b2a72ff6dd12158038c`.
- Install is deterministic, task-local, integrity-verified, and non-activating.
- `check` and `discover` are read-only.
- `automatic_routing` remains `false`.
- Bemoat Context, Handoff, STOP, FOUNDER_GATE, exact-head, review, and merge authority remain unchanged.
- `scripts/pstack.ts` uses Node built-ins and existing script architecture; it must not create an orchestration or authority layer.
- Child repositories are not modified; sync metadata is starter-only preparation for #522.

## Review Focus

- A cache at the wrong commit must fail before discovery — covered by the cache identity test.
- A clean cache with a modified or untracked PStack file must fail deterministically — covered by the drift test.
- Install must not overwrite an existing mismatched cache — covered by the install safety test.
- Discovery must not execute skills or enable routing — covered by the read-only/routing-off test.
- Existing Context/Handoff semantics must remain untouched — covered by the existing stateless contract suite and final diff review.

### Task 1: Pinned cache utility and contract proof

**Files:**
- Create: `.bemoat/pstack-pin.json`
- Create: `scripts/pstack.ts`
- Create: `tests/int/pstack-pin.int.spec.ts`
- Modify: `.gitignore`
- Modify: `package.json` only for the namespaced `bemoat:pstack` command
- Modify: `.bemoat/boilerplate-sync-manifest.json` only for the matching managed paths/script
- Modify: `scripts/cli/command-contract-registry.ts` with a read-only utility contract
- Modify: `scripts/cli/utility-routing-policy.ts` with an explicit non-stateful route
- Modify: `scripts/architecture-contract.json` with the tooling entrypoint

**Interfaces:**
- `pnpm run bemoat:pstack -- install [--cache-dir <path>]`
- `pnpm run bemoat:pstack -- check [--cache-dir <path>]`
- `pnpm run bemoat:pstack -- discover [--cache-dir <path>]`
- JSON output includes the exact pin identity and `automatic_routing: false`.

- [x] Write failing tests for exact pin identity, install into an empty task-local cache, mismatched-cache rejection, drift rejection, and read-only discover/check output.
- [x] Run the focused tests and confirm they fail for the missing utility.
- [x] Implement the minimal utility with explicit cache ownership, no overwrite of mismatched caches, Git commit/tree/blob verification, and no runtime activation.
- [x] Run the focused tests and confirm they pass.
- [x] Run `git diff --check` and review the bounded diff.
- [x] Validate CLI discovery and the scripts architecture contract, then commit the coherent utility/test checkpoint.

### Task 2: Child-compatible sync metadata and documentation

**Files:**
- Create: `docs/pstack.md`
- Modify: `scripts/boilerplate/inventory.ts`
- Modify: `tests/int/boilerplate-sync.int.spec.ts` only if a focused manifest assertion is required

**Interfaces:**
- Boilerplate sync carries `.bemoat/pstack-pin.json`, `scripts/pstack.ts`, `docs/pstack.md`, and the focused test as managed paths, plus `bemoat:pstack` as a managed namespaced script. The checked-in source manifest and local inventory remain aligned.

- [x] Add update, rollback, clean-checkout install, check, discover, and routing-off documentation.
- [x] Add only the required managed paths/script metadata and preserve child-owned package behavior.
- [x] Add or update focused sync coverage if the existing inventory contract requires it.
- [x] Run focused sync tests and commit the documentation/sync checkpoint.

### Task 3: Required validation and independent review

- [x] Run `pnpm run guard:safety`.
- [x] Run `pnpm run check` with the repository-approved local validation secret and elevated local-server permission; 82 suites and 1,706 tests passed.
- [x] Run `pnpm run boilerplate:check` where useful for starter sync drift; expected managed drift against the pre-merge `main` baseline was reported.
- [x] Verify exact branch/head/upstream readback and push each checkpoint.
- [x] Perform an independent semantic review confirming dependency introduction only, routing OFF, and unchanged Context/Handoff authority.
- [x] Audit every Issue #561 acceptance criterion before PR creation.
