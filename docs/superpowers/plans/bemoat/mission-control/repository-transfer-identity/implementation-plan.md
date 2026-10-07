# Issue #582 implementation plan: repository transfer identity

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: "#582"
task_key: "issue-582-repository-transfer-identity"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#582"
branch_template: "fix/582-repository-transfer-identity"
transition_target: "FOUNDER_GATE"
planning_base_sha: "46fe5363697cb24f0db5a6d4338a5540665bb697"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: "docs/superpowers/specs/bemoat/mission-control/repository-transfer-identity/design.md"
paired_plan: "docs/superpowers/plans/bemoat/mission-control/repository-transfer-identity/implementation-plan.md"
```
<!-- bemoat-task-identity:end -->

## Required input

- `docs/superpowers/specs/bemoat/mission-control/repository-transfer-identity/design.md`

## Objective

Implement the selected stable GitHub repository-ID compatibility for immutable pre-transfer Mission Control evidence while preserving current exact identity checks and existing #565/#580 gates.

## Global constraints

- Current protected main was `46fe5363697cb24f0db5a6d4338a5540665bb697` at fresh Context. The initial authorized target was `fix/582-repository-transfer-identity@8889e1898d5d20833143bc568f325175ee46956b`.
- Keep the original task-owned worktree `/Users/boat/.codex/worktrees/issue-582-characterization/bemoat-web-starter` unchanged.
- Treat repository ID `1267006707` as continuity proof only when live current and historical repository records and the exact native resource/parent chain independently agree.
- Keep current writes, presentation, local origin, active PR ownership, current Issue/PR URLs, branch/head/base, review, native-author, and durability checks exact.
- Apply historical compatibility through one central primitive. Do not add a general or persistent alias service.
- Never require a direct repository-ID field on a native resource when GitHub exposes the binding through a deterministic parent-resource chain.
- Keep missing, ambiguous, conflicting, unavailable, and different-ID proof fail-closed.
- Do not publish or edit historical comments; do not publish a second ordinary FOUNDER_DECISION; no autonomous merge.
- Do not expand into #565 synchronization implementation, #580 policy redesign, unrelated review-verdict parser changes, or global historical-name replacement.
- The Founder direction in comment 6019146779 includes behavior-affecting current-identity repairs in this same bounded objective. Correct the starter strict CI guard, boilerplate/source defaults, and only directly coupled operator/runtime documentation. Preserve historical examples and fixtures where the old name is accurate.
- Protected Mission Control policy at the approved current base already has `canonical_repository: bemoat/bemoat-web-starter` and `trusted_founder_login: bemoat`; retain the merged policy. Historical-policy readers may need the central continuity proof, but do not overwrite the current policy with the older target copy.

## Task 1: Characterize and add stories before production changes

- Record the immutable pre-merge #578 stale-base/no-recovery baseline and exact cause: missing Issue scope plus historical HANDOFF repository-name mismatch. Current #578 Context is now COMPLETE because PR #579 is merged; do not claim the live route remains STOP. Reconstruct the historical Issue snapshot with exact native VERIFY comment 6010840947 and schema-v3 STOP comment 6010924707, plus the recorded PR head/base, and evaluate it through current-main code.
- Add the same-ID live native-resource-to-parent-to-repository proof story and fail-closed siblings for missing, ambiguous, conflicting, malformed, and different IDs. Keep exact immutable native record fields in the full-history characterization; label any isolated one-record proof fixture accurately.
- Protect exact current origin/active-PR/write identity, one independent #565 eligibility failure, copied child policy, existing #580 competing-HANDOFF behavior, and canonical current identity in the starter strict CI guard and boilerplate/source defaults.
- Characterize the already-correct current protected policy values without adding a change that would roll them back. Keep any historical-name references in examples/fixtures when they describe actual historical evidence.
- Run the positive characterization against the exact protected-main baseline before changing production semantics. Classify the baseline result using the repository's A/B/C story taxonomy.

Exact test bindings and current live-state boundary:

- Current repository is `bemoat/bemoat-web-starter`, live repository ID `1267006707`; historical repository claim is `boat1994/bemoat-web-starter`. Current protected base is `main@46fe5363697cb24f0db5a6d4338a5540665bb697`; policy is `bemoat-mission-control` v1.6.0 at `docs/mission-control/mission-control-guide.md`, source SHA `35f3ab438724a79c377a964747cb5bd5d9d040c5`.
- Fresh live Context for #578 at current main returns `COMPLETE` because Issue #578 is closed and PR #579 is merged. Do not assert live #578 currently returns STOP. The immutable pre-merge no-recovery result is preserved in #582 HANDOFF comment `6014391169`; its exact historical HANDOFF comment is `6010924707`, parent Issue #578, PR #579 head `67b08e3505139da886d22b79a36a0bed31861195`, historical PR base `d8cf45d21829b6bde78411f07c335031701003a7`. Reconstruct that prior active stale-base state only as a production-shaped fixture evaluated by current-main code.
- The exact live chain may bind a comment by native ID and `issue_url` to the parent Issue, then the Issue `repository_url` to the current repository object/ID; the comment need not directly expose a repository ID. Historical-name lookup corroborates the numeric ID and is insufficient by itself.
- Issue branch is `fix/582-repository-transfer-identity` at starting head `8889e1898d5d20833143bc568f325175ee46956b`. Task 1 is tests-only: do not alter production code, publish evidence, or commit expected-red characterization tests. The repo rule forbids committing while checks fail; leave Task 1 changes uncommitted for Task 2 to make green.

Expected test areas:
- `tests/int/context-repository-identity.int.spec.ts` for the live identity proof chain, historical #578 stale-base scope binding, and fail-closed proof variants. Keep the new stories in this one file so the complete positive characterization can be run unchanged against a disposable exact-main baseline.
- Existing `tests/int/context-sync.int.spec.ts`, `tests/int/context-router.int.spec.ts`, `tests/int/context-no-pr-founder-decision.int.spec.ts`, and handoff transport coverage as regression controls; avoid duplicating their established gates.

## Task 2: Implement central identity proof and current-identity repairs

- Acquire the current repository database ID and the exact native parent/resource facts through read-only GitHub API calls.
- Resolve historical repository-name claims only as corroboration; require ID equality with the canonical current repository and exact linkage to the source comment/policy blob.
- Add one central predicate used by historical HANDOFF, Founder/repair, blocker-resolution, review-summary, and historical-policy readers that consume repository identity.
- Preserve each reader's existing Issue, PR, branch/head/base, policy, comment/review, author, and durability bindings.
- Keep `local-git.ts`, HANDOFF writing, `pr-issue-ownership.ts`, active PR selection, and current repository URL checks exact unless a test proves a historical read boundary is incorrectly coupled to them.
- Keep compatibility proof internal to Context evidence; do not persist a new alias mapping or rewrite native records.
- Update the starter strict CI guard, `.bemoat-boilerplate-sync.json`, and the five boilerplate/source defaults to `bemoat/bemoat-web-starter`, with focused regression coverage.
- Correct only directly coupled current-facing docs (deploy links, boilerplate source instructions, CI target note, review-verdict publication template, and starter-source links); do not globally replace historical names in immutable evidence, old plans, or characterization fixtures.
- Preserve the current protected Mission Control policy fields already correct on the approved base.

## Task 3: Validate and independently review

- Run the new focused identity and stale-base stories, then the related #565/#580 regressions.
- Run the required starter code tier `pnpm run check`; fix only in-scope failures.
- Verify the diff contains only the spec/plan, bounded tests, and required Context implementation.
- Obtain an independent semantic review against this specification and the Issue #582 acceptance criteria.
- Audit every live Issue #582 acceptance criterion before PR creation/update; mark completed evidence and human/CI gates.
- Follow the repository workflow for one focused commit, push, PR targeting current protected `main`, and applicable HANDOFF. Do not merge.

## Completion evidence

The objective is complete when the #578 same-ID story reaches only the existing bounded recovery, all proof-negative and exact-current controls remain fail-closed, the focused and required validation pass, the independent review is clean or has explicitly adjudicated residuals, and the change is durable in the Issue #582 PR with no autonomous merge.
