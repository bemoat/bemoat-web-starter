# Stateless command reference

Run repository-defined CLI Discovery before invoking a retained command. Use
the registry-declared inputs, safe help invocation, and live evidence returned
by the command.

## Context

    pnpm run bemoat:context <issue-number> --json

This command is read-only. It binds the Issue to the repository, protected
base, policy path/SHA, PR, exact-head CI, review, and local durability
evidence, then returns one route. Help must not create or modify any state.

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

Before an authorized Founder publishes one, use the canonical
[BLOCKER_RESOLUTION template](blocker-resolution-template.md). The example is
validated against the production parser; replace its sample values only with
the exact bound live evidence described above.

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
