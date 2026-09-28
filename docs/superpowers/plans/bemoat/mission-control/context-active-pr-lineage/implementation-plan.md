# Context Active-PR Lineage Implementation Plan

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: "#495"
task_key: "issue-501"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#501"
branch_template: "fix/501-context-active-pr-lineage"
transition_target: "FOUNDER_GATE"
planning_base_sha: "09c45bd29fd09736a6388458032b099b27734236"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: "docs/superpowers/specs/bemoat/mission-control/context-active-pr-lineage/design.md"
paired_plan: "docs/superpowers/plans/bemoat/mission-control/context-active-pr-lineage/implementation-plan.md"
```
<!-- bemoat-task-identity:end -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Context treat merged PRs as historical evidence rather than competing active candidates for open Issues while preserving current open-PR safety and closed-Issue terminal reconstruction.

**Architecture:** Keep lifecycle normalization, Issue↔PR association, identity validation, and routing vocabulary unchanged. Correct the post-normalization selector in `scripts/context/github.ts` so unmerged PRs win, merged PRs are selected only for verified closed-Issue terminal reconstruction, and an open Issue with no unmerged PR yields the existing empty active set.

**Tech Stack:** TypeScript, Vitest integration tests, GitHub CLI evidence adapters, Bemoat Context CLI.

**Spec:** `docs/superpowers/specs/bemoat/mission-control/context-active-pr-lineage/design.md`

## Global Constraints

- Work only in `bemoat-web-starter`; never modify `bogus-jewelry` or child Issue #255.
- Use protected `main` `09c45bd29fd09736a6388458032b099b27734236` as the implementation base.
- Modify only the smallest reusable Context lifecycle-selection surface and directly relevant tests/SDD artifacts.
- Preserve fail-closed competing-open-PR behavior, exact identity binding, merged terminal reconstruction, historical review lineage, #498, #425, #469, read-only Context, and child portability.
- Do not add timestamps, latest-comment authority, persistent state, counters, Issue-specific exceptions, hard-coded child numbers, routes, deployments, migrations, or merges.
- One controller owns mutation; the final semantic review is performed by a separate independent worker.

## Review Focus

- Two genuinely open, correctly Issue-bound PRs must still remain competing candidates and STOP; add an adapter-level assertion in the lifecycle matrix.
- A closed Issue with one valid merged PR must retain the existing terminal COMPLETE path; keep the existing reconstruction test green.
- A closed Issue with only closed-unmerged history must not gain a false terminal candidate; add an isolated story.
- Historical Issue comments containing HANDOFF/REVIEW evidence must remain readable when merged PRs are filtered from active selection; assert comment preservation.
- Approved-base advancement and historical merged PRs must not resurrect active ambiguity; cover merged records whose base is older than the live protected base.

## Files and responsibilities

- Create: `docs/superpowers/specs/bemoat/mission-control/context-active-pr-lineage/design.md` — behavioral contract and evidence-backed design.
- Create: `docs/superpowers/plans/bemoat/mission-control/context-active-pr-lineage/implementation-plan.md` — execution and verification contract.
- Modify: `scripts/context/github.ts` — smallest post-normalization lifecycle selector.
- Modify: `tests/int/context-evidence.int.spec.ts` — bounded lifecycle characterization and regression matrix.

## Task 1: Correct lifecycle selection and protect the matrix

**Interfaces:**

- Consumes: existing `readGithubEvidence()` candidate association, lifecycle normalization, `IssueEvidence.state`, and `ActivePullRequestEvidence` shape.
- Produces: `GithubEvidenceResult.activePrs` containing only current unmerged candidates for open Issues; existing merged terminal evidence for closed Issues; unchanged `errors`, `exactHead`, comments, and identity behavior.

- [ ] **Step 1: Write the failing regression**

  Change the current multiple-merged/open-Issue characterization in `tests/int/context-evidence.int.spec.ts` to represent two merged PRs with zero open PRs and assert `activePrs` is empty. Keep the fixture’s valid merge commits and Issue ownership evidence.

- [ ] **Step 2: Run the focused test and verify RED**

  Run:

  ```bash
  pnpm exec vitest run --config ./vitest.config.mts tests/int/context-evidence.int.spec.ts -t "historical merged PRs as active candidates"
  ```

  Expected: the test fails because the protected-main selector returns both merged records as active candidates.

- [ ] **Step 3: Implement the minimal selector correction**

  Modify only the selection expression in `scripts/context/github.ts`: choose all retained unmerged candidates first; when none exist, choose merged candidates only for a verified `CLOSED` Issue; otherwise return an empty selection. Keep validation, association, comment collection, and verification-index mapping unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Re-run the command from Step 2. Expected: PASS, with the two merged records excluded from `activePrs` and no new evidence error.

- [ ] **Step 5: Complete the bounded lifecycle matrix**

  Add or adjust focused tests in the same test file for: one open unique PR; two open competing PRs; merged history plus one open PR; one merged terminal PR for a closed Issue; closed-unmerged-only history; historical HANDOFF/REVIEW comment preservation; and merged PRs with an older base after protected-base advancement. Assert current active selection separately from historical comment/terminal evidence.

- [ ] **Step 6: Run focused green verification**

  Run:

  ```bash
  pnpm exec vitest run --config ./vitest.config.mts tests/int/context-evidence.int.spec.ts tests/int/context-router.int.spec.ts tests/int/context-corrections.int.spec.ts tests/int/context-parser.int.spec.ts tests/int/context-cli.int.spec.ts tests/int/context-sync.int.spec.ts tests/int/approved-base.int.spec.ts tests/int/stateless-public-contract.int.spec.ts
  ```

  Expected: all selected Context lifecycle, router, lineage, approved-base, and read-only tests pass with zero failures.

- [ ] **Step 7: Run starter structural verification**

  Run:

  ```bash
  git diff --check
  pnpm run guard:safety
  ```

  Expected: clean diff check and passing safety/structural guards.

- [ ] **Step 8: Commit the focused implementation**

  Stage only the two Context/test files plus the two SDD artifacts and commit:

  ```bash
  git add scripts/context/github.ts tests/int/context-evidence.int.spec.ts docs/superpowers/specs/bemoat/mission-control/context-active-pr-lineage/design.md docs/superpowers/plans/bemoat/mission-control/context-active-pr-lineage/implementation-plan.md
  git commit -m "fix(context): exclude merged history from active PR selection"
  ```

## Final verification and delivery

- Run the repository-declared `bemoat:check` help discovery before invoking it, then run final `pnpm run bemoat:check` and the raw starter `pnpm run check` if required by the starter validation tier.
- Confirm `git diff --check`, clean status, focused matrix, and final check results at the exact commit.
- Push `fix/501-context-active-pr-lineage`, open one PR targeting `main` with `Closes #501`, and include the complete acceptance-criteria audit and child-sync impact note.
- Obtain exact-head CI and an independent Luna Max-class semantic review from a separate worker. Apply at most one bounded in-scope FIX loop, with RED→GREEN focused proof and final full checks if required.
- Run CLI Discovery for `bemoat:handoff`, publish exactly one strict JSON HANDOFF with the route required by fresh evidence, then run fresh `pnpm run bemoat:context 501 --json` at the exact pushed head.
- Do not merge, deploy, migrate, sync the child, or touch `bogus-jewelry`.

## Acceptance audit mapping

- One open PR uniquely active — Task 1 matrix and existing adapter evidence.
- Multiple open PRs fail closed — Task 1 matrix plus existing router STOP.
- Merged PRs historical for open Issues — RED/GREEN regression and selector contract.
- Merged history plus one open selects only open — existing regression retained.
- Closed-unmerged history non-active — Task 1 isolated story.
- Historical HANDOFF/REVIEW remains available — Task 1 comment-preservation story and existing parser/router suites.
- Approved-base advancement does not resurrect merged PRs — Task 1 older-base story.
- No-open behavior remains canonical — existing no-active router test and fresh Context route.
