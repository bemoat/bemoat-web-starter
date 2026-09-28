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

# Issue #498 — Fail Closed on Malformed Current HANDOFF Identity

## Goal and scope

Context must fail closed when a HANDOFF plausibly describes the active
repository, Issue, PR, protected base, branch, and head but its required
identity evidence is absent or malformed. The change is limited to identity
classification in `scripts/context/**` and focused Context router regression
stories. Existing HANDOFF format, route precedence, and read-only behavior stay
in place.

## Identity classification

Classify each required identity field as a valid match, a valid mismatch, or
malformed/absent. A field is a valid mismatch only when it satisfies that
field's existing structural shape and its value differs from the live
identity. SHA values must be full SHAs; Issue and PR numbers must be canonical
positive integer strings; repository identity, branch names, and PR URL must
have their expected non-empty shapes.

Apply these rules in order:

1. If any required identity field is a structurally valid mismatch, treat the
   HANDOFF as stale and non-applicable, even if a different identity field is
   malformed or missing. Historical wrong repository, Issue, PR, base, branch,
   and head records remain available for current evidence re-evaluation.
2. If there is no valid mismatch, at least one field matches the live identity,
   and any required field/container is malformed or absent, classify the
   HANDOFF as malformed current evidence. Add it to the existing
   `malformedCurrent` conflict path so Context returns `STOP` before review
   evidence can authorize a less restrictive route.
3. A complete identity with all fields matching remains current and retains
   existing `FIX`, `FOUNDER_GATE`, and supersession behavior.
4. A non-record payload with no recognizable identity remains unknown and
   non-applicable. A complete current identity with malformed HANDOFF schema
   continues to use the existing fail-closed parse path.

The invariant is that evidence matching any live identity anchor cannot be
silently discarded as stale or unknown while the remaining required identity
is incomplete, unless a separate valid mismatch establishes that it is
historical or unrelated.

## Design boundary

Preserve the existing `handoffIdentityStatus(payload, evidence, activePr)`
inputs and the `resolveApplicableHandoffs` / `malformedCurrent` flow in
`scripts/context/runtime.ts`. Make only the classifier distinguish valid
mismatch from malformed/absent identity, then pass `malformed-current` into the
existing conflict collection. Keep the runtime file within its 400-line
structural ceiling; if the focused classifier cannot fit, extract only that
pure classifier to a small sibling module with no import cycle.

Tests use the existing production-shaped `routeContext` fixtures and canonical
HANDOFF JSON envelope, including case-variant spellings of the same repository
and PR URL plus distinct case-variant identities paired with another malformed
field. They cover malformed current identities, a malformed
field paired with a valid wrong identity, and existing current FIX,
FOUNDER_GATE, and historical re-evaluation behavior. No timestamps, comment
ordering, counters, state, new route, or alternate protocol are introduced.
