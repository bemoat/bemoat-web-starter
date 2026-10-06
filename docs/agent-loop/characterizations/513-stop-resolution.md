# Issue #513: exact-head STOP resolution characterization

Protected baseline: `main` at `89a88f21d73038ebff33a72600be9561e13239ed`.
Policy: `bemoat-mission-control` 1.3.0, blob
`7e2e8bdcb51ac36c74a9ff729eedcc9399352d75`.
This characterization changes no production routing or transport semantics.

## Reconciliation with current protected main

This document records the baseline observed before the structured
`BLOCKER_RESOLUTION` contract was merged. On protected `main` at
`1f33afd4aa54f39772530d124bb11078e8c77401`, that contract and its
regressions are already present. The router test for the real #509 identity
tuple now proves both that the Founder decision alone leaves the STOP in place
and that a separate, valid structured resolution allows re-evaluation. The
original PR #514 test asserted the former case; the merged test covers it with
the current policy's exact legacy blocker identity. This reconciliation keeps
the original red-story evidence below as history and adds no routing semantics.

## Later narrow recovery contract (Issue #580)

On 2026-10-06, the Founder recorded a bounded decision in Issue #580 for the
active-PR #578 / PR #579 `VERIFY + STOP` conflict. The approved exception
applies only when exactly two applicable current-head HANDOFFs contain one
`VERIFY` and one valid schema-v3 `STOP` with explicit blockers, and both bind
the same repository, Issue, PR, branch, exact head, and protected base. The
schema-v3 `STOP` is the routing safety overlay; neither HANDOFF is rewritten,
and timestamps or comment order select nothing. Every explicit blocker still
requires its own valid `BLOCKER_RESOLUTION`. Once all blockers are resolved,
Context recomputes from durable evidence and the pair alone no longer causes
the original conflict.

This later decision resolves only that pair. `FIX + STOP`, `REVIEW + STOP`,
`FOUNDER_GATE + STOP`, duplicate or malformed evidence, mismatched identities,
`VERIFY + VERIFY`, `STOP + STOP`, and three or more applicable records remain
fail-closed. Existing `REVIEW/VERIFY -> FIX/FOUNDER_GATE` review-lineage
supersession and the separate blocker-resolution semantics are unchanged. The
production-shaped regression and bounded negative matrix live in
`tests/int/context-router.int.spec.ts`.

## Red story and observed baseline

The new `#509`-shaped router story was first run with an expected `REVIEW`
route after the Founder comment. On unchanged production code it failed:
`expected 'STOP' to be 'REVIEW'`. The committed version asserts the observed
baseline: Issue `#509`, PR `#511`, head
`86c0ec49311a1b356ff96be087bb335ea6dc992f`, HANDOFF comment
`5906598686`, and Founder decision comment `5907706574` still yield
`Exact-head HANDOFF STOP remains unresolved`.

The fixture uses synthetic bodies with those durable identities. It does not
claim to reproduce every field in the live comments. It proves the relevant
path: `parseRoleEvidence()` admits `HANDOFF`, `RESULT`, and `REVIEW_VERDICT`
markers, but does not admit `FOUNDER_DECISION`; `routeContext()` then returns
unconditionally when the applicable exact-head HANDOFF route is `STOP`.

**Red-story classification: `PROTOCOL_SPEC_GAP`.** Issue #513 states the
desired invariant, and the Founder decision resolves #509's review migration
decision. Merged policy does not specify a structured, identity-bound record
for resolving a named HANDOFF blocker, the authority test for that record, or
how one resolution binds one of several blockers. Treating the existing
free-form Founder prose or a later comment as that record would invent protocol
semantics. The unconditional router return is the observed implementation
point, but editing that line alone would not make resolution safe.

## Required story matrix

| # | Baseline outcome and classification |
| --- | --- |
| 1 | Unresolved current-head STOP stays `STOP`; the generic behavior has existing router coverage. A named-blocker form needs the resolution contract. `PROTOCOL_SPEC_GAP` for that form. |
| 2 | Exact resolution cannot be represented by a supported record; the expected re-evaluation probe is red. `PROTOCOL_SPEC_GAP`. |
| 3 | The decision comment cannot grant a route because it is excluded; this is safe today, but positive resolution without route grant needs a contract. `PROTOCOL_SPEC_GAP`. |
| 4–7 | Wrong repository, Issue, PR, or head HANDOFF records cannot control the current route in existing router cases. Wrong-identity *resolution* cases need a defined record. `PROTOCOL_SPEC_GAP` for resolution. |
| 8 | HANDOFF binds protected-base branch and SHA; policy identity is Context evidence, but no resolution policy binding exists. `PROTOCOL_SPEC_GAP`. |
| 9 | An unrelated Founder comment is ignored by the current parser. A positive authority rule is unspecified. `PROTOCOL_SPEC_GAP`. |
| 10 | Competing current-head HANDOFF records fail closed in existing tests. Competing resolution records have no format. `PROTOCOL_SPEC_GAP`. |
| 11 | No durable blocker identifier or multi-blocker resolution rule exists. `PROTOCOL_SPEC_GAP`. |
| 12 | Current STOP is pinned regardless of comment time. The future resolver must not use latest-comment order, but resolution ordering cannot be specified without a record contract. `PROTOCOL_SPEC_GAP`. |
| 13 | HANDOFF is read-only input in the router and transport remains append-only; no rewrite was attempted. Existing transport tests protect this. |
| 14 | Existing router cases cover current-head FIX, REVIEW, VERIFY, FOUNDER_GATE and supersession; no production path changed. |
| 15 | Protected-main #503 native review cases passed in the focused router run. #509's separate PR #511 characterization was read as live evidence but is not merged into this baseline or changed here. |
| 16 | Protected-main #425/#469/#498/#501 Context regression anchors passed in the focused and full suites; no routing change was made. |
| 17 | New #509-shaped test records the real identity tuple and demonstrates stale STOP despite the later Founder decision. `PROTOCOL_SPEC_GAP`. |

## Smallest demonstrated control surface

The evidence path is `scripts/context/issue-parser.ts` (recognized durable
records), `scripts/context/model.ts` (normalized evidence),
`scripts/context/runtime.ts` (exact-head HANDOFF applicability), and
`scripts/context/router.ts` (the STOP decision). A safe correction requires a
merged resolution contract before selecting the actual edit set. It must name
the blocker, bind repository/Issue/PR/head/base and policy as required, prove
human authority without prose matching, handle duplicate or competing records,
and remove only the resolved blocker before native evidence is re-evaluated.
Resolution alone must confer no route.

The structured `BLOCKER_RESOLUTION` contract now defines blocker identity,
Founder authority, and per-blocker binding without granting a route. Issue
#580 separately defines the narrow `VERIFY + STOP` safety overlay above. Other
competing-HANDOFF shapes remain fail-closed and need their own durable
authority before any additional recovery behavior is introduced. The #509
Founder decision does not supply a general resolution-record format.
