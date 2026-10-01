# Issue #518 stale PR base characterization

## Baseline and scope

Characterized protected baseline `main@22728c339722198cd937c7c6f1c0420dc06c1f81` using synthetic fixtures carrying the confirmed Issue #513 / PR #514 identities. The test does not call Context or sync-base against the real #513 worktree and performs no GitHub or Git mutation.

The canonical invariant is split across two contracts:

- Ordinary Context keeps a stale active PR at `STOP` until the separate bounded sync-base command is authorized.
- A same approved base ref with a well-formed older base SHA is stale evidence, not malformed identity. Sync-base still has to prove ancestry, exact identity, local durability, and conflict-free synchronization before mutation.
- Current `BLOCKER_RESOLUTION` authority binds the live protected-base SHA and live policy source. A sync-only continuation must preserve those current values while evaluating the otherwise-current route; it must not rewrite current protected-base evidence to the PR's historical base SHA.
- Unresolved, malformed, wrongly bound, or conflicting blocker resolution remains `STOP`.

## Baseline story results

Focused command:

```bash
pnpm exec vitest run --config ./vitest.config.mts tests/int/context-stale-base.int.spec.ts
```

Result on the protected baseline: **3 failed, 2 passed**.

| Story | Baseline result | Classification |
| --- | --- | --- |
| Well-formed `main@oldBase` remains ordinary Context `STOP`, with a stale-base diagnostic and no malformed-base identity diagnostic | Fails: `routeContext` adds “base identity is missing or malformed” after the adapter already reports the live-base mismatch | Implementation defect |
| Exact #513/#514 current-live-base `BLOCKER_RESOLUTION` remains applicable while sync-base checks otherwise-current continuation | Fails: `authorizeContextSync` changes its cloned `protectedBase.sha` to the old PR base before calling `routeContext`; the current-base resolution no longer binds | Implementation defect |
| Unresolved historical STOP remains denied | Passes | Existing behavior protected |
| Resolution with the wrong blocker ID remains denied | Passes | Existing behavior protected |
| Resolution bound to the old PR base instead of current live base remains denied | Fails: the same clone rewrite makes the incorrectly stale-bound resolution appear current | Implementation defect |

The two failing resolution-binding stories establish that fixing only the route result is insufficient: the stale continuation check must preserve the live protected-base and policy evidence used by blocker resolution. The correction should suppress only the exact, structurally well-formed stale-base condition inside the sync continuation evaluation. Normal Context remains `STOP`, and all separate sync-base ancestry, conflict, identity, and durability checks remain required.

## Existing regression anchors inspected

- `tests/int/context-sync.int.spec.ts` covers bounded authorization, scope binding, wrong base branch, wrong head, non-origin upstream, local durability, ambiguous evidence, ancestry, merge conflict, drift, and mutation readback.
- `tests/int/approved-base.int.spec.ts` covers approved-base resolution and Context/Handoff binding for starter `main` and child `dev`.
- `tests/int/context-router.int.spec.ts` covers exact-head STOP resolution and fail-closed wrong, duplicate, malformed, and unauthorized resolution records.
- `docs/agent-loop/context-story-matrix.md` explicitly keeps stale active PR routing at `STOP` and delegates one bounded continuation to sync-base.

These existing anchors cover adjacent safety rails but did not combine valid stale base movement with a STOP resolution bound to the current live protected base.

## Bounded regression map

The implementation regression suite now covers the following 11 stories. The legacy #513 case uses the historical schema-v2 STOP identity, the recorded policy source SHA, and BLOCKER_RESOLUTION comment `5923392741`; it remains a fixture and has not been dogfooded against the real #513 worktree or PR.

| Story | Expected result | Coverage |
| --- | --- | --- |
| Well-formed same-branch base SHA drift is identified as stale, not malformed | Ordinary Context `STOP` with stale-base diagnostic | `context-stale-base.int.spec.ts` |
| Current live protected-base resolution allows an otherwise-current stale continuation | Sync authorization allows; live protected-base and policy identities remain unchanged | `context-stale-base.int.spec.ts` |
| Historical schema-v2 #513 STOP resolves using current live protected-base and policy evidence | Sync authorization allows and input evidence remains unchanged | `context-stale-base.int.spec.ts` |
| Ordinary Context sees stale drift when the collector stale marker is absent | `STOP` from router identity comparison | `context-stale-base.int.spec.ts` |
| An unrelated evidence error accompanies the stale marker | Sync authorization denies | `context-stale-base.int.spec.ts` |
| PR base SHA is malformed | Sync authorization denies | `context-stale-base.int.spec.ts` |
| Historical STOP has no BLOCKER_RESOLUTION | Sync authorization denies | `context-stale-base.int.spec.ts` |
| BLOCKER_RESOLUTION targets the old PR base | Sync authorization denies | `context-stale-base.int.spec.ts` |
| BLOCKER_RESOLUTION names the wrong blocker | Sync authorization denies | `context-stale-base.int.spec.ts` |
| BLOCKER_RESOLUTION binds the wrong policy source | Sync authorization denies | `context-stale-base.int.spec.ts` |
| Native ancestry is missing or merge-tree reports conflict | Sync stops before merge or push | `context-sync.int.spec.ts` |

After merge, fresh reconstruction and dogfooding against real #513/PR #514 remain pending. No real sync-base invocation is part of this characterization.
