# Issue #509: historical FIX lineage characterization

Status: characterization only. Production semantics are unchanged.

## Authority and historical state

This baseline is protected `main` at `89a88f21d73038ebff33a72600be9561e13239ed`, policy blob `7e2e8bdcb51ac36c74a9ff729eedcc9399352d75`. The published #504 native review [5353114057](https://github.com/boat1994/bemoat-web-starter/pull/505#pullrequestreview-5353114057) reviewed `41187038e7df1bba755f1a44a971f44e51bfd1f9` and reported `CORRECTION REQUIRED`. The append-only [FIX HANDOFF 5891095039](https://github.com/boat1994/bemoat-web-starter/issues/504#issuecomment-5891095039) bound repository, Issue, PR, branch, old protected base `46857c0fad0b1746e5a13224d97bcef67831ed71`, reviewed head, and the native review URL. These records predate the #503 contract merged as `e64d670b4efbadfdaa00c47d9b53cafa0aa52ab6`. Their publication-era contract did not require the later structured review identity fields and immutable finding JSON.

PR #505 currently points to `e4256de811006fe27aa7bff0d1f80d9467d686db`. The fixture deliberately uses the old reviewed head. It does not model the current PR as if it were still at that head, and no real #504 synchronization was attempted.

## Baseline result and control boundary

The initial story expected the old exact-head FIX evidence to permit bounded stale-base recovery. On unchanged protected-main production code, `routeContext(preMovement)` returned `STOP` instead of `FIX`. `authorizeContextSync()` therefore returned `STOP` with `pre-movement context is not otherwise valid for continuation` before any Git fetch, ancestry, merge-tree, merge, or push operation.

The historical review's human-readable `Reviewed exact head:` and `Verdict:` lines parse as null under the current structured parser, as do repository, Issue, PR, and base. The HANDOFF itself contains exact identity and a canonical native review URL. Current `hasNativeReviewLineage()` requires the newer complete review body and immutable finding section; `resolveApplicableHandoffs()` rejects the current-head FIX when that lineage fails. Independently, `routeContext()` treats the native review body as invalid current-head semantic evidence. Thus a sync-only bypass would leave a second STOP; the narrow control boundary is **historical native review interpretation shared by HANDOFF lineage and routing**, before sync's pre-movement route gate. Existing ancestry, source, durability, and merge-tree gates are downstream and should remain intact.

## Twelve story outcomes

`Protocol/spec gap` means current merged policy does not uniquely select a safe migration rule. `Missing coverage` includes passing baseline behavior newly pinned to the #504-shaped lifecycle. No production behavior was changed to make a red story green.

| # | Story | Protected-main result | Baseline class |
| --- | --- | --- | --- |
| 1 | Publication-era valid FIX review/HANDOFF, then protected base advances | Expected recovery route was red: pre-movement `STOP`, sync authorization `STOP` | Protocol/spec gap |
| 2 | Current-format exact-head FIX | `FIX`; sync authorization allowed with otherwise valid stale evidence | Missing coverage |
| 3 | Malformed historical review | `STOP` | Missing coverage |
| 4 | Wrong repository, Issue, PR, base, branch, or head in HANDOFF | All six refuse sync authorization | Missing coverage |
| 5 | Competing legacy/current FIX HANDOFFs | `STOP` | Missing coverage |
| 6 | Current-head historical Issue `REVIEW_VERDICT` migration | `FIX` for a complete bound comment | Missing coverage |
| 7 | Append-only HANDOFF | Routing and authorization leave the input and record count unchanged | Missing coverage |
| 8 | Old review and HANDOFF on a later correction head | `REVIEW`; old review does not satisfy the new head | Missing coverage |
| 9 | Durability, repository identity, approved-base gates | All refuse authorization; existing sync tests cover ancestry, merge-tree, and source gates | Missing coverage |
| 10 | Current native review database ID, canonical URL, immutable finding | All three malformed variants `STOP` | Missing coverage |
| 11 | #503, #498, #501, #425, #469 anchors | Existing Context router, corrections, sync, acquisition, and CLI suites pass | Missing coverage |
| 12 | Real #504-shaped historical fixture | Old base, reviewed head, native review ID, HANDOFF ID retained; baseline `STOP` | Protocol/spec gap |

The committed characterization asserts observed baseline behavior. Before that assertion was recorded, the expected `FIX` assertion was run and failed against unchanged production code (`Expected FIX; Received STOP`).

## Invariants and unresolved decision

Any future recognition of old evidence would need exact, unique agreement among the native review database ID and canonical URL, review commit, immutable HANDOFF identity, PR, repository, Issue, branch, old base, and reviewed head. Malformed, wrong-identity, conflicting, or superseded candidates must continue to STOP. The historical record cannot satisfy semantic review for a new correction head; after a synchronized or corrected head, CI and an independent Delta Review must bind to that new SHA. The sync command must still prove live source identity, local durability, protected-base ancestry, branch ancestry, and a clean merge-tree before mutation.

Current merged policy authorizes bounded reading of historical evidence but does **not** specify whether an old native review's missing structured identity and finding fields may be supplied by its exact HANDOFF, which old review formats qualify, or how mixed old/current candidates should be ranked. Those are authority semantics, not facts the test can choose. An architecture/Founder decision must define them before a production correction. No timestamp, latest-comment ordering, history rewrite, or real #504 mutation is proposed by this characterization.
