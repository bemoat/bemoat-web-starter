<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: "#495"
task_key: "issue-498"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#498"
branch_template: "fix/498-malformed-current-handoff"
transition_target: "AWAITING_REVIEW_1"
planning_base_sha: "351a9167c334062ca7ddb0a8f48bdd2027964b9d"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: "docs/superpowers/specs/bemoat/agent-protocol/malformed-current-handoff/design.md"
paired_plan: "docs/superpowers/plans/bemoat/agent-protocol/malformed-current-handoff/plan.md"
```
<!-- bemoat-task-identity:end -->

# Malformed Current HANDOFF Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Context route otherwise-current HANDOFFs with malformed or partial identity to `STOP` while retaining stale-record re-evaluation.

**Architecture:** Preserve `handoffIdentityStatus(payload, evidence, activePr)` and `resolveApplicableHandoffs` in the existing Context runtime. Distinguish a valid mismatch from malformed/absent identity, then feed malformed-current candidates into the existing conflict path. Do not change route precedence or HANDOFF schema.

**Tech Stack:** TypeScript, Vitest, Bemoat Context router, canonical HANDOFF parser.

**Spec:** `docs/superpowers/specs/bemoat/agent-protocol/malformed-current-handoff/design.md`

## Global Constraints

- Work only on Issue #498 / CTX-255-001 in `boat1994/bemoat-web-starter`.
- Any structurally valid wrong repository, Issue, PR, base, branch, or head keeps the HANDOFF non-applicable, even if another field is malformed.
- Case-equivalent repository/PR values identify the same current resource but remain malformed when they do not use canonical spelling; case-distinct values naming another resource remain valid mismatches.
- Malformed/absent identity with at least one matching current anchor and no valid mismatch must fail closed through `malformedCurrent`.
- Preserve CTX-496-001/002/003, FIX and FOUNDER_GATE supersession, #425/#469, and existing conflict precedence.
- Context remains read-only; do not add timestamps, latest-comment authority, counters, state, protocol fields, or routes.
- Do not touch bogus-jewelry, PR #257, HeroMediaLoader, or #495 Round 2–5.
- Keep `scripts/context/runtime.ts` at or below 400 physical lines without a structural-protection exception.

## Task 1: Characterize and correct current HANDOFF identity classification

**Files:**
- Modify: `tests/int/context-router.int.spec.ts`
- Modify: `scripts/context/runtime.ts` (or add only a focused pure-classifier sibling if required to stay under the 400-line ceiling)
- Create: `docs/superpowers/specs/bemoat/agent-protocol/malformed-current-handoff/design.md`
- Create: `docs/superpowers/plans/bemoat/agent-protocol/malformed-current-handoff/plan.md`

**Interfaces:**
- Consumes: `routeContext`, `NormalizedContextEvidence`, `ActivePullRequestEvidence`, and rendered HANDOFF records.
- Preserves: `handoffIdentityStatus(payload, evidence, activePr)` and `resolveApplicableHandoffs` routing through `malformedCurrent`.

- [ ] **Step 1: Add production-shaped failing router stories.**

  Add a helper that changes one identity value inside the canonical JSON body
  returned by the existing HANDOFF fixture. Cover empty, non-string, and
  missing identity values; short/malformed exact-head SHA; malformed/missing
  protected-base identity; malformed/missing PR identity; and malformed
  current identity with valid exact-head review evidence that otherwise permits
  a less restrictive route. Assert `STOP` for each plausible current record.

  Add pairwise mixed stories where one identity field is malformed but another
  structurally valid field identifies a different repository, Issue, PR,
  approved base, or exact head. Assert those remain non-applicable and existing
  current evidence is re-evaluated. Cover case-equivalent repository/PR spellings
  as malformed current evidence and different case-distinct resources as valid
  mismatches. Retain existing valid FIX/FOUNDER_GATE,
  supersession, #425/#469, and timestamp/order-independence stories unchanged.

- [ ] **Step 2: Run the characterization against protected main.**

  Run `pnpm exec vitest run tests/int/context-router.int.spec.ts` before
  changing production code. Confirm the new current-malformed cases fail
  because missing identity is unknown or malformed values are stale, and that
  mixed valid-mismatch cases retain historical routing. Correct test mistakes
  before implementation if a failure is not the expected behavior.

- [ ] **Step 3: Implement the minimum classifier change.**

  Keep the existing three-argument classifier signature. Validate each field's
  structural form before comparing values. A valid mismatch takes precedence;
  case-equivalent same-resource repository/PR spellings count as matching anchors
  while remaining malformed. Otherwise return malformed-current only when at
  least one valid field matches and some required value/container is missing or
  malformed. Route that status
  through the existing `malformedCurrent` array. Keep the runtime under 400
  lines; only if needed, move the pure classifier into a sibling that imports
  model types directly and has no runtime cycle.

- [ ] **Step 4: Verify focused stories and full code validation.**

  Run `pnpm exec vitest run tests/int/context-router.int.spec.ts`,
  `pnpm run guard:safety`, `pnpm run check`, and `git diff --check`. Discover
  the registered `bemoat:check` contract and its safe help invocation before
  running it, then run `pnpm run bemoat:check`. Require zero lint warnings and
  verify the runtime line ceiling and exact allowed file set.

- [ ] **Step 5: Commit and deliver for exact-head review.**

  Commit one focused change, push `fix/498-malformed-current-handoff`, and
  open/update one PR targeting `main` under the starter bootstrap exception.
  Include the Issue #498 acceptance audit with command evidence in the PR body.
  Do not merge. Publish the required canonical HANDOFF and reconstruct Context
  after the durable PR/head result; stop at the resulting independent-review
  route for the controller.

## Acceptance audit at delivery

- Reproduce CTX-255-001 against protected main: report the red focused stories
  from before implementation.
- Correct smallest Context identity/ambiguity surface: cite changed classifier
  and existing conflict path.
- Cover malformed/partial current identity: cite the focused router story set.
- Preserve stale/wrong-identity re-evaluation: cite mixed malformed plus valid
  mismatch stories and existing router regressions.
- Preserve listed authority invariants and read-only/no-timestamp behavior:
  cite existing regression stories and final code/safety checks.

## Out of scope

Child/product changes, HeroMediaLoader, child-only harness exceptions,
Persistent state, counters, recovery state machines, alternate protocols,
#495 Round 2–5, migrations, deployment, child synchronization, and merge.
