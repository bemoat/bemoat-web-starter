# Issue #520 BLOCKER_RESOLUTION lifecycle characterization

## Baseline and authority

Characterization uses protected baseline `main@eccb36837c7e0c2fdda0aa2871999364507aa937`. The fixture is synthetic and reproduces #513 / PR #514 identities; no real #513 Context or sync-base command, GitHub mutation, or repository mutation is performed. Production code and policy are unchanged.

Merged policy and command reference bind each resolution to the current protected-base branch and SHA, current policy identity and source SHA, source STOP, repository, Issue, active PR, exact PR head, blocker, and trusted Founder identity. Stale, wrong, duplicate, competing, or ambiguous resolution evidence remains STOP. Timestamp and latest-comment order do not determine authority. The current command reference does not define a publication-time validity record, an ancestry carry-forward rule, or a historical policy-compatibility proof.

The #513 resolution `5923392741` was published at `main@22728c339722198cd937c7c6f1c0420dc06c1f81` and policy blob `ecc49947022953ee87a82aefbc3b69888f70a59d`. After merge, protected `main` advanced to `eccb36837c7e0c2fdda0aa2871999364507aa937`; the current policy blob remains `ecc49947022953ee87a82aefbc3b69888f70a59d`. Readback confirms the immutable comment and policy bytes, but does not establish a general compatibility proof contract.

Authority inspected: [merged command reference](https://github.com/boat1994/bemoat-web-starter/blob/eccb36837c7e0c2fdda0aa2871999364507aa937/docs/mission-control/command-reference.md) (blob `f7e23941bd16335994abbada14ed568dc09764ed`), [merged policy guide](https://github.com/boat1994/bemoat-web-starter/blob/eccb36837c7e0c2fdda0aa2871999364507aa937/docs/mission-control/mission-control-guide.md), [Founder decision 5913459162](https://github.com/boat1994/bemoat-web-starter/issues/513#issuecomment-5913459162), and [resolution 5923392741](https://github.com/boat1994/bemoat-web-starter/issues/513#issuecomment-5923392741). The Issue requests characterization and a decision; its candidate mechanisms are not merged protocol authority.

## Baseline story matrix

Focused tests use the #513-shaped fixture in `tests/int/context-stale-base.int.spec.ts` and existing bounded anchors in `tests/int/context-router.int.spec.ts` and `tests/int/context-sync.int.spec.ts`.

| # | Story | Protected-baseline result | Classification / evidence |
| --- | --- | --- | --- |
| 1 | Resolution binds current protected base | Sync authorization allows the current-base resolution; ordinary Context still stops on stale PR base. | Existing behavior protected; #518 stale-base characterization. |
| 2 | Resolution was valid, then base advanced with other identity and policy semantics unchanged | Ordinary Context and sync authorization remain STOP for the old-base resolution. | Current STOP matches merged contract. Any supported carry-forward outcome is a **Protocol/spec gap**: merged evidence does not define the validity or compatibility proof required. No continuation expectation is invented. |
| 3 | Base advances and relevant policy semantics change | Current policy version/source binding mismatch remains fail-closed. | Existing behavior protected by current-base wrong-policy fixture; no historical compatibility model is specified. |
| 4 | PR head changes | With current PR/local/verification head identity consistently changed, authorization recomputes to the same result with the historical resolution removed. | Existing behavior protected by current-base fixture; old STOP is no longer applicable to the new head, so this is not an asserted STOP expectation. |
| 5 | Wrong repository, Issue, PR, or blocker | Each independently altered binding is rejected. | Existing behavior protected by current-base fixture. |
| 6 | Original protected base was never valid | An unrelated recorded base SHA is rejected. | Existing behavior protected by current-base fixture. |
| 7 | Duplicate or competing resolutions | STOP remains fail-closed for duplicates and competing records. | Existing router anchor: duplicate/competing evidence is rejected regardless of comment order. |
| 8 | Comment timestamps/order vary | A later timestamp does not grant authority or select among records. | Existing router anchors cover timestamp independence and competing-order permutations. |
| 9 | Resolution becomes historical or needs revalidation | Evaluation leaves immutable source STOP and resolution evidence unchanged; no rewrite/delete path is exercised. | Existing append-only contract plus fixture immutability; any revalidation format is unspecified. |
| 10 | Resolution/migration grants workflow authority | A valid resolution does not bypass independent failed-head evidence; Context recomputes to `FIX`. | Existing router anchor also checks pending checks → `VERIFY` and failed checks → `FIX`. |
| 11 | Lifecycle interacts with sync-base | Current-base resolution permits the existing bounded sync authorization; after base advancement the old resolution is STOP. No sync mutation is invoked. | Existing #518 authorization and sync safety anchors cover ancestry, conflict, identity, durability, drift, and readback. |
| 12 | Real #513 lifecycle dogfood | Not run. | Deferred by explicit task boundary; requires post-merge fresh authorization and must not be simulated as real evidence. |
| 13 | Existing #509 review lineage | Existing strict resolution and legacy lineage stories remain unchanged. | Bounded regression anchor in `context-router.int.spec.ts`; no #509 recovery. |
| 14 | Existing #518 stale-base classification/sync safety | Existing tests and new #520 fixtures retain stale PR STOP and current-base-only authorization. | Bounded regression anchors in `context-stale-base.int.spec.ts` and `context-sync.int.spec.ts`. |

No story produced an **Implementation defect** against the current merged contract. Story 2 is classified **Protocol/spec gap** for proposed historical carry-forward: its current stale STOP agrees with the contract, but no authorized continuation mechanism is defined. Added passing baseline stories are **Missing coverage**. The draft story 4 assertion produced one red (314 passed, 1 failed): it expected STOP on a new head but observed independently recomputed REVIEW. This red is **Missing coverage**, not an implementation defect: the old exact-head STOP is inapplicable, and removing its historical resolution produces the same result. The corrected story protects that behavior. No production semantics were changed to make it green.

## Bounded neighboring regressions

- #518: same-ref stale base remains ordinary Context `STOP`; sync authorization only evaluates with a current-base resolution and preserves live policy/base evidence. Wrong/missing blocker evidence remains denied.
- #509: exact-head STOP/review-lineage stories in `context-router.int.spec.ts` remain regression anchors only; no recovery is attempted.
- General resolution controls: duplicate/competing records, timestamp independence, immutable STOP, exact Founder identity, all-blockers resolution, and no route authority beyond independently evaluated checks remain covered by `context-router.int.spec.ts`.
- Sync safety: ancestry, conflict, exact identity, local durability, drift, and readback remain covered by `context-sync.int.spec.ts`; this characterization invokes only the pure authorization evaluator.

## Founder/protocol question

May an immutable resolution that was valid when published carry forward after protected-base advancement when source STOP, Issue, PR, exact head, blocker, and relevant policy semantics remain invariant? If so, what reproducible proof must establish original validity, approved-base ancestry, and policy compatibility? Until merged policy answers this uniquely, current fail-closed STOP remains authoritative. No mechanism is selected.

## Issue #520 acceptance criteria audit

1. **Story-first characterization of all 14 cases on protected baseline — Not done in full.** All 14 are mapped; synthetic lifecycle and bounded regression coverage run against unchanged protected-baseline production. Real story 12 remains prohibited before merge and fresh authorization. No production semantic change has begun.
2. **Distinguish publication-valid from genuinely stale/invalid evidence with reproducible proof — Not done.** Existing record/comment and unchanged blob can be read back, but the merged contract provides no general proof semantics; Founder/protocol decision needed.
3. **Demonstrate smallest safe lifecycle semantics; Founder decision before unresolved choice — Not done.** Current semantics are confirmed as STOP after base movement. Historical carry-forward requires the Founder/protocol decision above; implementation is stopped.
4. **No timestamp/latest-comment authority — Done.** Existing router tests cover timestamp independence and ordering permutations.
5. **Historical evidence remains append-only and unchanged — Done for characterization.** Synthetic evaluation does not mutate records; real comment `5923392741` was read-only evidence.
6. **Duplicate, competing, ambiguous evidence remains fail-closed — Done.** Existing router regression anchors cover these cases.
7. **Resolution/revalidation grants no workflow or merge authority — Done for current resolver behavior.** Existing router tests show independent pending/failed checks determine `VERIFY`/`FIX`; revalidation semantics remain undefined.
8. **#518 classification and sync safety regressions — Done for focused regression coverage.** Existing #518 stale-base and sync tests are included in the focused command below.
9. **#509 review-lineage strictness — Done for regression coverage.** Existing #509-shaped router story remains unchanged.
10. **Focused and canonical validation — Done for the characterization delta.** Focused regression passes 7 files / 315 tests; both full pipelines pass 58 files / 859 tests, with zero-warning lint. These results do not establish a production correction or successful real recovery.
11. **Exact-head CI — Waiting for CI / human review.** No PR was created for this characterization-only slice.
12. **Independent semantic review — Waiting for CI / human review.** No implementation delta exists for review.
13. **Founder merge gate preserved; no autonomous merge — Done.** No merge or merge-authorizing evidence was produced.
14. **Post-merge real #513 / PR #514 supported recovery succeeds — Not done.** Explicitly deferred; this worker is prohibited from invoking real sync/recovery.
15. **Fresh #513 Context after recovery — Not done.** Depends on item 14 and separate fresh authorization.
16. **Keep #520 and #518 open until dogfood and Context evidence — Done.** No issue mutation or closeout was attempted.

## Validation boundary

Only synthetic fixtures and pure route/sync authorization evaluators are used. No `bemoat:context 513` or `bemoat:context:sync-base 513` operation is part of this characterization; no comments, branches, PRs, merges, or recovery writes are created by the tests.

This is a characterization-only branch delta. No implementation PR is opened, as the requested production mechanism is blocked on the protocol decision. Existing managed test paths and the managed characterization directory cover these changes; no inventory/manifest update is required. Child synchronization and real recovery wait for a separately authorized correction and Founder merge.

## Commands and results

Run on 2026-10-01 with Node `v24.16.0`, pnpm `10.27.0`, and the canonical repository root. The existing standalone pnpm launcher was selected through `/tmp/bemoat-520-bin`; `npm_config_scripts_prepend_node_path=false` preserved the Node 24 script runtime. Missing dependencies were restored with an offline frozen-lockfile install, with scripts disabled; tracked package files are unchanged.

```bash
export PATH=/tmp/bemoat-520-bin:/home/boat/.nvm/versions/node/v24.16.0/bin:$PATH
export npm_config_scripts_prepend_node_path=false
pnpm run bemoat:context -- --help --json
pnpm run bemoat:context 520 --json
pnpm exec vitest run --config ./vitest.config.mts \
  tests/int/context-stale-base.int.spec.ts tests/int/context-router.int.spec.ts \
  tests/int/context-sync.int.spec.ts tests/int/approved-base.int.spec.ts \
  tests/int/context-corrections.int.spec.ts tests/int/context-evidence.int.spec.ts \
  tests/int/context-parser.int.spec.ts
pnpm run check
pnpm run bemoat:guard:safety -- --help
pnpm run bemoat:check
git diff --check
pnpm run bemoat:handoff -- --help --json
```

- Fresh initial Context: `IMPLEMENT`, no active PR, clean attached pushed durable topic branch, exact protected base `eccb36837c7e0c2fdda0aa2871999364507aa937`.
- Focused final regression: exit 0, 7 files / 315 tests passed. Earlier draft: 314 passed / 1 failed; classification and corrected expectation are recorded above.
- `pnpm run check`: exit 0, guards passed, lint zero warnings, typecheck passed, 58 files / 859 tests passed.
- `pnpm run bemoat:check`: exit 0, guards passed, lint zero warnings, typecheck passed, 58 files / 859 tests passed. Its registry-defined Tier C delegated help was used.
- `git diff --check`: exit 0. Help invocations returned help without workflow mutation.
- Test runtime emitted the existing Payload no-email-adapter warning; no production email, deployment, or migration operation was run.
- Exact-head correction CI and independent review: pending because there is no production correction PR. No successful real #513 command evidence is claimed.

The controller outcome is **STOP at the Founder/protocol question above**. Fresh Context without an active PR can still return `IMPLEMENT`; a HANDOFF cannot manufacture workflow authority or a different native route. Do not equate that mechanical route with an answer to the unresolved semantic contract.
