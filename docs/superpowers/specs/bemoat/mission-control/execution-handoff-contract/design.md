# Execution handoff contract — minimum structured design

<!-- bemoat-task-identity:start -->
```yaml
schema_version: 1
main_issue: null
task_key: "deterministic execution handoffs"
task_issue_strategy: "existing_dedicated_issue"
active_task_issue: "#512"
branch_template: "fix/512-preflight-handoff"
transition_target: "FOUNDER_GATE"
planning_base_sha: "20be184cf47b6a1f7af66670110d761f77fef05c"
execution_base_rule: "resolve_live_protected_base_at_dispatch"
paired_spec: null
paired_plan: null
```
<!-- bemoat-task-identity:end -->

**Status:** Proposed for design review. No runtime change is authorized by this
document.

## Decision

Define a compact, evidence-backed input record and a deterministic projection
into the existing Global Mission Control operator summary and the canonical
15-section Ready-to-paste Execution handoff. Keep the current written policy
as the authority for workflow semantics. The structured record carries current
facts and identifies their sources; it does not become a second policy engine.

The minimum useful control surface is one record for one current bounded
objective, one applicability rule, one fixed section mapping, and one
fail-closed rule. Do not add independent route selection, gate logic, model
selection authority, or future-work scheduling.

## Contract boundary

The contract prepares an Execution handoff from live repository, GitHub,
protected-base policy, Issue, and Context evidence. It can report that the
handoff is ready, preflight-only, or withheld due to a gate or unresolved
evidence. Only Context supplies the workflow route and `next_action`; this
contract cannot turn one disposition into another or authorize execution.

The existing [Execution handoff contract](../../../../../mission-control/execution-handoff-contract.md)
continues to define the exact 15 section headings, their order, and their
workflow instructions. This design proposes the minimum structured data needed
to fill those sections without manually maintaining duplicate facts. It does
not replace or silently rewrite the canonical artifact contract.

## Proposed structured inputs

Collect each fact once, with its evidence source. The record may omit
conditional values only when their applicability rule below is satisfied.
Values are resolved evidence, not free-form instructions that can override
policy.

| Input group | Required content | Conditional content |
| --- | --- | --- |
| `identity` | Canonical repository; Issue number and live URL/state; protected base ref and resolved commit; merged policy source commit and guide version; merged Global MC loader identity/source commit | PR identity/state, branch, exact head, and upstream when present or required by the current route. If absent, use `NOT_APPLICABLE` with the live-state reason. |
| `objective` | Exactly one objective selected by fresh Context; its Issue acceptance-criteria references; the bounded permitted and prohibited scope | A preflight candidate may be named only when Global MC has verified the repository, protected base, merged loader and policy, Issue, and relevant live GitHub identity/state but cannot run repository-local CLI. It is pending Context authorization and permits no objective mutation. |
| `authority` | Fresh Context route and the complete `next_action` object (`type`, `command`, and `reason`), with evidence identifying the Context run; applicable current policy source | Route may be unresolved only for the documented Global MC local-CLI limitation after verifying the repository, protected base, merged loader and policy, Issue, and relevant GitHub identity/state. Then the disposition is preflight-only and Execution must run registered CLI Discovery and fresh Context before mutation. Do not infer a command, route, or recovery. |
| `execution` | The operator-provided actual controller selection and its source, when explicitly selected; otherwise the profile controller value remains a recommendation and is not asserted as an explicit selection. State the mutation owner and permitted delegation effect when applicable. | Applicable advisory role recommendations, each resolved from Model Routing Profile v1 with its five declared output fields. An unused role is `NOT_APPLICABLE` with a route/objective-based reason. Reviewer identity is required only when an independent review is applicable; mutation ownership is `NOT_APPLICABLE` with a reason when no mutation is authorized. |
| `completion` | Applicable validation basis; whether HANDOFF/readback is required; fresh-Context-after-result requirement; return fields from current policy | PR, CI, review, and durable-result identities when applicable. When an item does not apply, use `NOT_APPLICABLE` with a reason grounded in live route/state or policy. |

The input record must not accept caller-selected alternatives for Context
route, gate status, protected base, required validation, or HANDOFF policy.
Those values are read from their owning live authority. An input may carry
evidence and provenance for rendering or checking, but it cannot make that
evidence authoritative by assertion.

### Applicability and `NOT_APPLICABLE`

`NOT_APPLICABLE` is a resolved applicability result, not a blank, unknown, or
convenient omission. It has a concise reason tied to the current route,
objective, workflow profile, or verified repository state. For example, an
absent PR is `NOT_APPLICABLE` only when live state verifies there is no PR and
the current step does not require one. A review role is not applicable only
when current authority does not require that role for this objective.

Do not invent worker roles or future target recommendations. If a role is
applicable, include its resolved advisory recommendation; if not, record the
reason. An unresolved required field is not `NOT_APPLICABLE`.

## Outputs

1. **Operator summary**, with the existing six fields and ordering: Current
   objective; Current route/status; Suggested model; Next action; Founder
   decision; Live identity. The summary names the actual explicitly selected
   controller first when one was selected and labels any different profile
   value as advisory baseline/reference only. `Next action` must faithfully
   reflect the complete authoritative Context `next_action` and the canonical
   loader; if Context supplies no command, do not invent one.
2. **Ready-to-paste Execution artifact**, containing the existing complete 15
   sections in canonical order. Each section is populated from the structured
   record and current policy. Repeated facts are projections of one resolved
   value, not separately authored values.
3. **Withheld/preflight result**, when a usable artifact cannot be emitted.
   Report the exact gate or unresolved/conflicting input and the evidence
   needed to resolve it. The only route exception remains the existing
   preflight-only case where Global MC cannot run repository-local CLI and
   all other required live authority has been verified.

The output uses the existing route vocabulary only. This contract introduces
no route, gate, recovery, or completion state of its own.

## Canonical section and order relationship

The operator summary stays before the artifact. The artifact retains the
existing headings and order, Sections 1 through 15. Structured inputs map to
those sections as follows:

| Sections | Source groups |
| --- | --- |
| 1–3: identity, objective, verified authority/route | `identity`, `objective`, `authority` |
| 4–6: startup, permitted scope, prohibited scope | `identity`, `authority`, `objective`, and current policy |
| 7–8: model routing, execution/delegation | `execution` and current policy |
| 9–11: validation, durable result/HANDOFF, fresh Context | `completion` and current policy |
| 12–15: continuation, stops, Founder decision, required return | `authority`, `completion`, and current policy |

Do not create a second configurable section-order list or copy policy text into
input fields. The mapping above is explanatory; the canonical contract remains
the sole source for exact headings, detailed instructions, and ordering.

## Invariants

- **Context authority:** Fresh Context and protected-base policy determine the
  route, next action, objective authority, gates, and required workflow. The
  handoff record only communicates evidence and those determinations.
- **Controller and advisory profile are distinct:** An explicit controller
  selection is the actual controller for this execution. A different Sol
  Medium profile value is advisory baseline/reference only. Profile
  recommendations cannot override, downgrade, bind, or replace explicit
  selection. Model/provider identity grants no workflow authority.
- **No workflow-semantic change:** Controller selection and profile output do
  not change Context route, gate, first-edit trigger, validation, independent
  review, HANDOFF/readback, merge, production, destructive, migration, or
  secret semantics.
- **Gate preservation:** `STOP` remains fail-closed for objective mutation and
  delegation, except for an exact bounded recovery explicitly prescribed by
  fresh Context under Section 12 of the canonical contract. `FOUNDER_GATE`
  still requires the Founder decision and cannot produce mutation-capable
  instructions or delegation. A contract result does not satisfy a gate.
- **One objective:** The record and artifact authorize at most the one bounded
  objective selected by current Context. They do not pre-authorize future
  objectives; each next objective requires durable-result processing and fresh
  Context.
- **HANDOFF remains distinct:** The Ready-to-paste Execution artifact does not
  publish or satisfy the later durable HANDOFF. When required, that single
  record, exact readback, and subsequent fresh Context remain governed by
  current workflow policy.
- **Independent review:** If required, the semantic reviewer remains separate
  from the actual controller and implementer.
- **No autonomous merge:** The contract cannot authorize or perform merge.
- **#508 remains advisory:** Consume the existing model profile only for
  recommendations and applicability. Do not duplicate its routing rules or
  change its defaults in this objective.

## Unresolved or contradictory inputs

Withhold the usable artifact if any required live fact is missing, stale,
unsupported, or contradictory; if two authorities disagree; or if canonical
policy does not uniquely determine a required result. Report the exact field,
conflicting evidence, and what must be resolved. Do not select a fallback,
guess, relabel uncertainty as `NOT_APPLICABLE`, or ask model identity to
resolve a workflow question.

Apply the existing narrow preflight exception only when the sole unresolved
fact is Context route because Global MC cannot execute repository-local CLI,
and the live repository, protected base, merged loader, merged policy, Issue,
and relevant GitHub identity/state evidence are verified. The result must
direct Execution to registered CLI Discovery and fresh Context and must
prohibit objective mutation until that Context returns
`next_action.type: COMMAND`. A `STOP` may permit only the exact bounded
recovery fresh Context explicitly prescribes under Section 12 of the canonical
contract; do not infer or broaden recovery authority. `FOUNDER_GATE`, an
unsupported result, or an evidence conflict follows its existing Context and
policy behavior without reinterpretation here.

## Runtime surface decision

Do not assume that a builder, validator, or renderer is useful merely because
the output is structured. The currently documented integration is a Global
MC prompt/Project loader that fetches repository policy; it does not establish
a callable repository-local integration point for Global MC to invoke. A
repository-only runtime would create another contract surface without
preventing omissions in the live Global MC session. The existing static tests
characterize the written artifact contract, but do not prove live use.

Therefore this design does **not** justify a runtime builder, validator,
renderer, scheduler, or provider adapter yet. AC1 is a design boundary. Any
later runtime proposal must first identify a real caller and show that the
smallest callable component reduces duplicate policy or omission risk. If such
a caller is established, begin with one pure projection/check at that boundary;
do not build a standalone workflow engine. Otherwise retain the written
contract and its bounded static characterization. AC3 remains a separate,
unmet acceptance question and is not waived by this design.

## Deliberately out of scope

- Runtime schema package, builder, validator, renderer, scheduler, or provider
  integration.
- Changes to the canonical 15-section contract or Global MC loader.
- Changes to Context routing, gates, first-edit authorization, workflow
  transitions, HANDOFF schema, or merge behavior.
- Changes to #508 profile defaults, routing, or execution.
- Implementation of any subsequent Issue #512 objective.

## Acceptance boundary and next slice

This document supplies the proposed AC1 minimum input groups, conditional
applicability semantics, outputs, invariants, canonical order mapping, and
unresolved-input behavior for review. Approval would settle this design only;
it would not authorize runtime work or any future objective.

There is no justified runtime implementation slice until an actual callable
Global MC integration point is established. If AC3 still requires runtime
machinery after this design is approved, the smallest next bounded step is to
prove that integration boundary and choose one projection/check it can call;
then return for a separate objective authorization before implementing it.
