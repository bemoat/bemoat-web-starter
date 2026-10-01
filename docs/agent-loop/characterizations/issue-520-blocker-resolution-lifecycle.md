# Issue #520 BLOCKER_RESOLUTION lifecycle characterization

## Baseline and authority

Characterization uses protected baseline `main@eccb36837c7e0c2fdda0aa2871999364507aa937`. The fixture is synthetic and reproduces #513 / PR #514 identities; no real #513 Context or sync-base command, GitHub mutation, or repository mutation is performed. Production code and policy were unchanged during the initial characterization recorded below.

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

## Historical Founder/protocol question (resolved by the approved contract below)

May an immutable resolution that was valid when published carry forward after protected-base advancement when source STOP, Issue, PR, exact head, blocker, and relevant policy semantics remain invariant? If so, what reproducible proof must establish original validity, approved-base ancestry, and policy compatibility? Until merged policy answers this uniquely, current fail-closed STOP remains authoritative. No mechanism is selected.

## Initial characterization acceptance criteria audit (historical)

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

## Founder-approved contract baseline — 2026-10-01

Founder approval in `docs/superpowers/specs/bemoat/mission-control/blocker-resolution-history/design.md` resolves the historical carry-forward protocol gap recorded above. The newly approved contract permits an immutable old-base resolution to keep resolving only its named blocker if it replays against the exact historical canonical snapshot, the recorded base is an ancestor of the exact current approved base, and the historical/current blobs match for both the mission-control guide and command reference. All existing repository, Issue, PR, exact-head, STOP source, blocker, Founder identity, policy, duplicate, and competing-evidence checks remain mandatory. The resolution still grants no route or sync authority; current evidence is recomputed, and ordinary stale-PR Context remains STOP.

The baseline fixture uses exact source facts: B1 `22728c339722198cd937c7c6f1c0420dc06c1f81`; B2 `eccb36837c7e0c2fdda0aa2871999364507aa937`; compare status `ahead`, `ahead_by=2`, `behind_by=0`, and merge base B1; guide blob `ecc49947022953ee87a82aefbc3b69888f70a59d`; command-reference blob `f7e23941bd16335994abbada14ed568dc09764ed` at both bases. At this baseline run, the proof was a test-only transient extension on `NormalizedContextEvidence`; production did not yet consume it and no durable transport was added. It binds resolution comment ID and SHA-256 of the exact body, canonical repository, historical/current base branch and SHA, historical policy, both historical/current contract blob identities, and the raw compare facts. The implemented interface retains these facts as freshly collected in-memory evidence, separate from durable HANDOFF records.

### Approved-contract baseline run

Command:

```bash
PATH=/tmp/bemoat-520-bin:/home/boat/.nvm/versions/node/v24.16.0/bin:$PATH npm_config_scripts_prepend_node_path=false pnpm exec vitest run --config ./vitest.config.mts tests/int/context-stale-base.int.spec.ts tests/int/context-router.int.spec.ts
```

Latest result against unchanged production: **3 failed, 242 passed** across 2 files. The three red variants are the same canonical lifecycle story with otherwise-current `REVIEW`, independent `VERIFY`, and independent `FIX` evidence. Each supplies the complete proposed transient proof, yet `authorizeContextSync` returns `STOP`; the existing evaluator ignores the new proof property and requires the resolution to bind B2. All three are **Implementation defect** under the now-explicit Founder contract. The ordinary `routeContext` assertions remain green at `STOP`, as required. Negative stories for absent/duplicate proof, either changed contract blob, wrong historical/current policy or base/repository/comment bindings, changed resolution bytes, native or declared Founder mismatch, competing resolution records with individually matching proofs, unavailable/diverged ancestry, immutable evaluation, and the original #518/#509 anchors remain fail-closed and green. The first run had a test fixture identifier typo (`commandReferenceSha`); it was corrected before the recorded semantic runs and is not counted as a semantic red.

### Coverage across the required 14 stories

| # | Approved-contract result | Baseline evidence |
| --- | --- | --- |
| 1 | Current-base resolution remains valid; ordinary stale-PR Context remains STOP. | Existing #518 test passes; current-bound sync path remains covered. |
| 2 | Proven B1→B2 carry-forward should allow only the otherwise-current sync evaluation. | Red in all three REVIEW/VERIFY/FIX variants: `STOP` instead of the independently recomputed route. **Implementation defect.** |
| 3 | Either compatibility blob changing must deny carry-forward. | Guide and command-reference mismatch neighbors both return STOP. |
| 4 | A changed PR head makes the old STOP inapplicable; recompute current evidence without relying on that resolution. | Existing changed-head fixture compares results with and without the old resolution. |
| 5 | Wrong repository, Issue, PR, or blocker remains STOP. | Current exact-binding fixture neighbors remain green; inherited router tests cover source and identity mismatch. |
| 6 | A never-valid historical base cannot be made valid by proof. | Wrong historical-base proof remains STOP. |
| 7 | Duplicate, competing, ambiguous, or malformed resolutions/proofs remain STOP. | Existing router duplicate/competition anchors remain green; missing/mismatched proof variants remain STOP. |
| 8 | Timestamp and comment ordering do not confer authority. | Existing router order/timestamp anchors remain green; proof binds comment identity and bytes, not order. |
| 9 | Historical records stay append-only; proof evaluation is transient and does not mutate inputs. | Existing immutable-source coverage remains green; no new durable proof record is introduced. |
| 10 | Resolution itself grants no workflow route or merge permission. | The three intended outcomes are derived separately as REVIEW, VERIFY, and FIX; old normal Context stays STOP. Existing router tests cover pending/failed checks. |
| 11 | Sync-base ancestry, conflict, identity, durability, drift, scope, and readback gates remain mandatory. | Only pure authorization is invoked; existing sync safety suite remains a bounded regression anchor. |
| 12 | Real #513 / PR #514 post-merge dogfood. | Not run; still deferred until correction validation, exact-head CI, independent review, Founder merge, and fresh authorization. |
| 13 | #509 review-lineage strictness remains unchanged. | Existing #509 router regression remains green; no #509 recovery. |
| 14 | #518 classification and sync safety remain unchanged. | Existing #518 stale-base and sync tests remain green. |

This new section updates the earlier protocol-gap finding: the Founder contract now uniquely defines the allowed historical proof and expected continuation. It does not change the earlier recorded baseline result or authorize this characterization worker to implement production behavior, run real #513 synchronization, or write GitHub state.

The original characterization commit remains immutable. The subsequent correction implements the explicitly approved contract; it does not rewrite the original STOP or resolution, introduce a durable evidence type, or alter either compatibility-anchor document. The new historical acquisition module is registered in the managed inventory and sync manifest. Child synchronization and real recovery still wait for correction merge and the required fresh authorization.

## Initial characterization commands and results (historical)

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

The initial controller outcome was **STOP at the Founder/protocol question above**. Fresh Context without an active PR can still return `IMPLEMENT`; a HANDOFF cannot manufacture workflow authority or a different native route. Do not equate that mechanical route with an answer to the unresolved semantic contract.


## Approved correction and current acceptance audit

The Founder decision authorizes deterministic historical carry-forward with four independent proofs: replay of strict immutable resolution and historical policy identity; exact approved-branch ancestry; identical guide and command-reference blobs; and invariant current repository/Issue/PR/head/source STOP/blocker identity. Acquisition uses read-only GitHub endpoints pinned to full commit SHAs and binds the resulting facts to the exact comment ID and body digest. Missing, malformed, duplicate, competing, incompatible, or unprovable evidence remains STOP. No timestamps or comment ordering are used.

Context collects this proof only for the sole current active PR and exact head. The evaluator preserves the current-bound path and checks the historical policy's STOP blocker derivation before accepting carry-forward. It then independently recomputes the route; ordinary stale-base Context still stops, and sync authorization retains every existing safety gate. The public CLI exposes nonempty transient proof facts for audit without changing durable transport or caller inputs. The guide and command-reference files remain byte-for-byte unchanged so the correction itself does not invalidate the historical compatibility proof.

| Criterion | Status | Correction evidence |
| --- | --- | --- |
| 1. All 14 characterization cases before production changes | Not done in full | All 14 mapped; three approved-contract reds recorded before implementation. Synthetic and bounded neighboring coverage exists; real story 12 is necessarily post-merge. |
| 2. Reproducible distinction between historically valid and invalid records | Done | Exact historical snapshot replay, immutable body/comment binding, deterministic native ancestry, and both blob comparisons; negative neighboring stories. |
| 3. Smallest safe semantics selected after Founder decision | Done | Approved design and bounded implementation; current-bound behavior retained, no new durable evidence type or workflow transition. |
| 4. No timestamp/latest-comment authority | Done | Existing ordering stories retained; proof uses native identities and bytes. |
| 5. Append-only immutable history | Done | Input immutability story and read-only acquisition; real resolution 5923392741 and source STOP untouched. |
| 6. Duplicate/competing/ambiguous evidence fails closed | Done | Existing resolution ambiguity stories plus missing/duplicate/malformed historical proof neighbors. |
| 7. Resolution grants no workflow/merge authority | Done | REVIEW/VERIFY/FIX outcomes independently recomputed; ordinary stale-base Context remains STOP. |
| 8. #518 stale-base/sync safety preserved | Done for regression coverage | Existing ancestry/conflict/identity/durability/drift/readback suite unchanged; no real sync invoked. |
| 9. #509 review lineage preserved | Done for regression coverage | Existing router lineage stories retained. |
| 10. Focused and canonical validation | Done | Focused: 10 files / 381 tests. Both canonical pipelines: 58 files / 891 tests, guards, zero-warning lint, typecheck; exit 0. |
| 11. Exact-head CI | Waiting for CI / human review | Must pass on the correction PR's exact committed head. |
| 12. Independent semantic review | Waiting for CI / human review | Separate Sol Med exact-head review required. |
| 13. Founder merge gate | Done | No autonomous merge; native Context must reach the human gate. |
| 14. Real #513/PR #514 supported recovery | Not done | Required after correction CI/review and Founder-approved merge, with fresh authorization. |
| 15. Fresh #513 Context after recovery | Not done | Depends on criterion 14; no #513 production authority granted. |
| 16. Keep #520/#518 open pending dogfood | Done | PR uses non-closing linkage; excluded issues are unchanged. |


### Final correction verification

Luna Med verified the stable corrected tree using Node v24.16.0 and pnpm10 with the launcher environment recorded above:

```bash
pnpm exec vitest run --config ./vitest.config.mts \
  tests/int/context-stale-base.int.spec.ts tests/int/context-router.int.spec.ts \
  tests/int/context-sync.int.spec.ts tests/int/approved-base.int.spec.ts \
  tests/int/context-corrections.int.spec.ts tests/int/context-evidence.int.spec.ts \
  tests/int/context-parser.int.spec.ts tests/int/context-acquisition.int.spec.ts \
  tests/int/context-cli.int.spec.ts tests/int/cli-command-registry.int.spec.ts
pnpm run check
pnpm run bemoat:check
git diff --check
```

Focused verification passed 10 files / 381 tests. Both full pipelines exited 0: all 11 guards passed, lint passed with zero warnings, typecheck passed, and 58 files / 891 tests passed. The initial guard run identified missing task-identity blocks in the new paired documents; these were added. Lint then identified one unused test callback argument; it was removed. Full tests identified the structural inventory expectation of 77 after adding the new runtime module; the expectation was updated to 78 without changing structural limits, exceptions, or the protected oracle. The final pipelines verify those corrections. Sandbox subprocess EPERM failures were rerun with authorized execution and did not recur. These maintenance failures do not redefine the three contract-semantic red stories.

The existing Payload no-email-adapter warning remains; no production operation was performed. Exact-head GitHub CI, independent semantic review, and final native Context are recorded in the PR and HANDOFF after durable delivery. Real #513 recovery and fresh Context remain outstanding post-merge acceptance work, so this correction uses non-closing Issue linkage.
