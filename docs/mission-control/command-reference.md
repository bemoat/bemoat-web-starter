# Stateless command reference

Run repository-defined CLI Discovery before invoking a retained command. Use
the registry-declared inputs, safe help invocation, and live evidence returned
by the command.

## Context

    pnpm run bemoat:context <issue-number> --json

This command is read-only. It binds the Issue to the repository, protected
base, policy path/SHA, PR, exact-head CI, review, and local durability
evidence, then returns one route. Help must not create or modify any state.

A uniquely verified schema-v2 no-PR `IMPLEMENT` HANDOFF may route to
`PR_READY` with `next_action.type: OPEN_PR` and `command: gh pr create`. This
route requires one canonical native HANDOFF for the queried repository, Issue,
branch, and exact currently pushed head; implementation mode; a passing
code-tier validation proof bound to that head; a clean durable canonical
upstream; no active PR; and no competing, malformed, stale, or incompatible
HANDOFF history. Its recorded protected-base branch must equal the live
approved base. If the recorded base SHA differs from live main, Context
requires native GitHub comparison evidence proving the recorded SHA is a
strict ancestor of the current approved base. The immutable HANDOFF SHA is not
rewritten. `PR_READY` authorizes only opening exactly one PR from that branch
to the approved base; it grants no source-edit or other Git mutation
authority. After PR creation, the prior `pr: null` HANDOFF remains historical
pre-PR evidence and does not supersede the strict identity checks for current
PR HANDOFFs.

## STOP blocker resolution evidence

An authorized Founder may append one `## BLOCKER_RESOLUTION` Issue comment for
one named blocker in an applicable exact-head STOP HANDOFF. The comment is a
strict JSON record in a `json` fence. Its native GitHub author and explicit
`authority.login` must both match the trusted Founder login declared by merged
protected-base policy. `OWNER` is an additional consistency check; neither
`OWNER` nor a JSON role claim grants authority. An unmerged policy change
cannot authorize its own evidence. Schema-v1 remains the active-PR variant and
binds the repository, Issue, active PR, exact head, protected base, protected
policy identity, source STOP HANDOFF comment, and blocker ID:

```json
{
  "schema_version": 1,
  "record_type": "BLOCKER_RESOLUTION",
  "repository": "owner/repository",
  "issue_number": "410",
  "pr_number": "411",
  "exact_head": "0123456789abcdef0123456789abcdef01234567",
  "protected_base": {
    "branch": "main",
    "sha": "89abcdef0123456789abcdef0123456789abcdef"
  },
  "policy": {
    "path": "docs/mission-control/mission-control-guide.md",
    "policy_id": "bemoat-mission-control",
    "version": "1.3.0",
    "source_sha": "0123456789abcdef0123456789abcdef01234567"
  },
  "source_stop_handoff": {
    "comment_id": "123456789",
    "url": "https://github.com/owner/repository/issues/410#issuecomment-123456789"
  },
  "blocker_id": "architecture-decision",
  "authority": {
    "role": "FOUNDER",
    "login": "founder-login"
  }
}
```

Schema-v2 is the distinct no-PR variant. It requires `pr_number: null` and
binds the exact durable topic branch and head, live protected-base branch and
SHA, merged policy identity, exact source STOP comment, blocker, and Founder.
The source STOP may retain its historical base snapshot; the exact comment ID
and URL bind that immutable history while schema-v2 binds current live base
and policy evidence. The two versions are not interchangeable:

```json
{
  "schema_version": 2,
  "record_type": "BLOCKER_RESOLUTION",
  "repository": "owner/repository",
  "issue_number": "535",
  "pr_number": null,
  "branch": "fix/535-no-pr-stop",
  "exact_head": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "protected_base": {
    "branch": "main",
    "sha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  },
  "policy": {
    "path": "docs/mission-control/mission-control-guide.md",
    "policy_id": "bemoat-mission-control",
    "version": "1.4.0",
    "source_sha": "cccccccccccccccccccccccccccccccccccccccc"
  },
  "source_stop_handoff": {
    "comment_id": "9005",
    "url": "https://github.com/owner/repository/issues/535#issuecomment-9005"
  },
  "blocker_id": "missing-founder-decision",
  "authority": {
    "role": "FOUNDER",
    "login": "founder-login"
  }
}
```

For a STOP HANDOFF with explicit `verified_evidence` entries of kind
`stop-blocker`, each entry's `value` is one blocker ID. Every ID needs exactly
one valid resolution. An older STOP HANDOFF without these entries has one
legacy blocker ID: `legacy-stop:<HANDOFF comment ID>:<SHA-256 of the trimmed
next_action.description UTF-8 bytes>`. Its `stop_conditions` are guardrails,
not separate blockers. This compatibility applies only to schema-v2 STOPs
whose Issue, native comment ID, exact head, and description digest appear in
`legacy_stop_handoffs` in merged protected-base policy. Unlisted schema-v2
STOPs stay blocked. New schema-v3 STOPs require unique explicit `stop-blocker`
IDs and cannot derive blockers from prose. The source HANDOFF remains unchanged.

Missing, malformed, stale, wrong, duplicate, competing, or ambiguous
resolution evidence keeps Context at STOP. A valid record removes only its
named blocker. For no-PR Context, all blockers on an applicable schema-v3 STOP
must have one valid schema-v2 resolution before Context recomputes from current
evidence. The resolved STOP remains immutable history.

No-PR terminal folding permits one unique applicable `COMPLETE` HANDOFF to
coexist only with prior `objective_mode: read_only` `IMPLEMENT` HANDOFFs and
schema-v3 STOP HANDOFFs whose blockers are all uniquely resolved. Multiple
COMPLETE records, unresolved or conflicting STOPs, malformed resolution
evidence, mutation-capable nonterminal HANDOFFs, incompatible FIX/REVIEW/
FOUNDER_GATE evidence, and identity conflicts remain STOP. Timestamps and
comment order do not select authority. A terminal COMPLETE must bind the live
protected-base SHA, and all coexisting historical HANDOFFs must agree on one
protected-base SHA among themselves. When no COMPLETE exists, recomputable
current-head HANDOFFs must likewise agree on one protected-base SHA. A
resolution grants no implementation, review, merge, deployment, migration, or
terminal-completion authority.

Without a `COMPLETE`, exactly one uniquely applicable exact-current-head
read-only `FOUNDER_GATE` may reconstruct to the human decision boundary. Its
protected-base branch must still match the live protected branch, while its
SHA remains the immutable snapshot recorded when the HANDOFF was canonically
published; later advancement of protected main does not stale that snapshot.
The gate may coexist only with recomputable read-only `IMPLEMENT` and fully
resolved schema-v3 STOP history, and the gate plus all such history must agree
on exactly one recorded protected-base SHA. Malformed, stale, wrong-identity,
duplicate, mutation-capable, or otherwise ambiguous gate evidence remains
STOP. The gate records a human decision boundary only and grants no mutation
authority; after the decision is consumed, fresh Context against current
merged authority is required before a mutation-capable objective. An
unconsumed competing gate keeps a `COMPLETE` at STOP. A no-PR `COMPLETE` must
still bind the current live protected-base SHA. Context never selects by
timestamp or comment order.

One strict schema-v1 `FOUNDER_DECISION` may consume one exact no-PR gate. It
binds the exact source-gate comment ID and URL, repository, Issue, null PR,
branch, exact head, current protected-base branch and SHA, current merged
policy identity, and the trusted Founder. The native comment author and
declared `FOUNDER` login must both match the merged policy; `OWNER` association
does not grant authority. Only `PROCEED` is supported. Malformed, duplicate,
conflicting, stale, wrong-gate, wrong-identity, or wrong-author evidence keeps
Context at STOP. A valid decision filters only its exact gate, then Context
recomputes all remaining STOP, HANDOFF, and COMPLETE rules. No timestamp or
comment order is consulted, and the decision grants no generic mutation or
blocker-resolution authority. Active-PR Founder gates are unchanged.

Current policy frontmatter explicitly controls historical carry-forward with
`allow_historical_no_pr_founder_gate_replay: true`; the default is false. When
enabled, Context may exclude one already-consumed immutable gate at historical
head A only after replaying its exact decision or canonical repair under the
historical policy/protected-base snapshot, binding the same repository, Issue,
and canonical branch, and proving durable strict A-to-B ancestry plus
compatible historical-to-current protected-base ancestry. Missing, divergent,
rewritten, ambiguous, malformed, duplicate, conflicting, wrong-author,
wrong-identity, or unconsumed evidence remains STOP. Other current gates and
STOP/HANDOFF/COMPLETE conflicts remain in ordinary routing. This narrow
exclusion neither satisfies a current human gate nor grants authority at B;
Context recomputes from all remaining current evidence. Timestamp and comment
order are never used.

Before an authorized Founder publishes one, use the canonical
[FOUNDER_DECISION template](founder-decision-template.md). Replace every
sample value with exact current evidence and preserve the strict body format.

## Immutable malformed Founder-decision recovery

For exactly one syntactically malformed ordinary no-PR `FOUNDER_DECISION`, the
trusted Founder may append one strict schema-v1 `FOUNDER_DECISION_REPAIR`.
Use the [canonical repair template](founder-decision-repair-template.md). The
repair carries a complete current `PROCEED` decision, exact source gate, and
exact predecessor native comment ID/URL plus SHA-256 of its unchanged UTF-8
body. Both native authors and the repair's declared Founder must match merged
trusted-Founder policy. The repair, gate, and predecessor are distinct comments.

This is not a second ordinary decision. The malformed predecessor grants no
authority; Context never normalizes it into a valid record. Valid ordinary
decisions cannot be repaired, even when stale or wrong-identity. Orphan,
malformed, duplicate, competing, wrong-binding, wrong-author, or changed-body
evidence stays STOP. Every remaining STOP, historical-base, HANDOFF, and
COMPLETE rule still applies after consuming only the exact gate. Context is
read-only; repair evidence grants no generic implementation, merge,
blocker-resolution, deployment, migration, or terminal authority and cannot
consume an active-PR gate.

Run registered CLI Discovery, then the public syntax validator before publication:

    pnpm run bemoat:founder-decision-repair:validate -- --help --json
    pnpm run bemoat:founder-decision-repair:validate -- --body-file ./founder-decision-repair.md --json

PASS checks only the exact strict repair body. It does not verify the digest
against live predecessor content, authority, identity, policy, evidence,
publication, or a Context route. It performs no mutation. FAIL returns
`INVALID_INVOCATION`. After authorized Founder publication, rerun CLI Discovery
and fresh Context to reconstruct from current merged authority.

Before an authorized Founder publishes one, use the canonical
[BLOCKER_RESOLUTION template](blocker-resolution-template.md). The example is
validated against the production parser; replace its sample values only with
the exact bound live evidence described above.

Use the read-only public syntax validator for a complete candidate body:

    pnpm run bemoat:blocker-resolution:validate -- --body-file ./blocker-resolution.md --json

It reports PASS only when the exact body matches the production schema-v1
active-PR or schema-v2 no-PR parser. PASS establishes syntax only. The
validator does not inspect identity, authority, or live evidence; it does not
publish a comment or create a Context route. Invalid bodies return FAIL with
`INVALID_INVOCATION`.

## REVIEW_VERDICT syntax validation

Use the read-only public validator for a complete candidate body:

    pnpm run bemoat:review-verdict:validate -- --body-file ./review-verdict.md --json

It validates the canonical REVIEW_VERDICT heading, exact identity fields, full reviewed and approved-base commit IDs, supported verdict, optional parser-supported Supersedes field, and the immutable finding contract for CORRECTION REQUIRED. PASS establishes syntax and shape only. It does not verify reviewer independence, live freshness, ancestry, semantic correctness, submission, routing, Founder authority, or merge eligibility; it does not publish a review or create a Context route. Invalid bodies return FAIL with `INVALID_INVOCATION`.

## Handoff

    pnpm run bemoat:handoff <issue-number> --body-file <strict-handoff.json>

The body file must contain exactly one strict JSON HANDOFF object. The command
validates scope, authority, evidence, acceptance criteria, required checks,
stop conditions, and next permitted action, then appends and verifies one
durable record.

## Semantic review evidence

HANDOFF remains the append-only cross-agent transport. Its single
`verified_evidence` entry of kind `review-verdict` may reference a native PR
review at `https://github.com/<repository>/pull/<pr>#pullrequestreview-<database-id>`.
Context reads the existing structured `## REVIEW_VERDICT` review body from
native PR evidence; agents need not publish a legacy Issue comment. The body
must bind repository, Issue, PR, approved base branch, and exact reviewed head.
The native commit must agree with that head, the database ID must resolve
uniquely, and the review must be submitted (`COMMENTED`, `APPROVED`, or
`CHANGES_REQUESTED`). Dismissed or pending reviews cannot satisfy lineage.

`CORRECTION REQUIRED` native evidence also requires the existing immutable
finding disposition: schema version 1, the same reviewed head, nonempty
findings with unique IDs, canonical summaries, source threads, and required
evidence. HANDOFF prose cannot replace this finding contract. Historical
Issue-comment REVIEW_VERDICT lineage remains readable for migration.

Before a reviewer submits native `## REVIEW_VERDICT` evidence, use the
[canonical REVIEW_VERDICT template](review-verdict-template.md) and validate
the completed body with the production parser. Do not hand-author or extend
identity fields with descriptive prose.

The publication-era native-review compatibility path is limited to
`bemoat:context:sync-base` evaluating otherwise-valid stale-base evidence. A
unique, durable FIX HANDOFF must bind the repository, Issue, PR, branch, old
protected-base SHA, and exact current PR head; its sole `review-verdict`
reference must identify one submitted native review attached to that same
head. The older review may omit structured identity and immutable-finding
fields, but it must state that exact reviewed head, one `CORRECTION REQUIRED`
verdict, and a nonempty blocking finding. Any structured repository, Issue,
PR, base, branch, protected-base SHA, or reviewed-head identity present in
that review must be well formed, unique, and agree exactly with the HANDOFF
and active PR; an absent field may be supplied only by that uniquely bound
HANDOFF. A same-head Issue summary, when present, only
corroborates the native review: it must match the same repository, Issue, PR,
base, and head and name that exact native review under `Source semantic
review`. Missing, malformed, wrong-identity, duplicate, or competing evidence
remains `STOP`.

This compatibility cannot satisfy ordinary Context, current-format #503 native
review validation, or review requirements after the PR head changes. It does
not use timestamps or comment order, rewrite HANDOFF history, or add a review
transport. Existing sync-base ancestry, merge-tree, source identity,
protected-base identity, and local durability gates remain required.

A REVIEW HANDOFF and its identity-bound FIX or FOUNDER_GATE outcome can coexist;
Context resolves their evidence without rewriting either record or using
comment order or timestamps. Missing or stale referenced FIX evidence,
malformed current evidence, and conflicting exact-head verdicts route STOP.
An absent semantic review routes REVIEW. A correction head requires its own
exact-head Delta Review before FOUNDER_GATE; old-head review cannot satisfy it.

## Protected-base synchronization

    pnpm run bemoat:context:sync-base

This is a separately bounded synchronization utility. It does not authorize
implementation, review, approval, or merge.

## Stop conditions

Stop and return STOP when repository/base/head/CI/policy evidence is ambiguous,
unavailable, conflicting, noncanonical, or not durable. Use BLOCKED_EXTERNAL,
STATE_CONFLICT, or CLI_DISCOVERY_DEFECT when that classification is supported
by the command contract. FOUNDER_GATE remains a human authorization boundary.
No agent may autonomously merge or repair conflicting Issue state.

Historical RESULT and REVIEW_VERDICT comments may be read by Context as
bounded migration evidence only. They do not expose a writer, create a review
route, or grant authority.
