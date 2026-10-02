# ChatGPT Project loader — stateless execution control

The compact ChatGPT Project bootstrap fetches this merged loader and policy
from live GitHub; this full loader does not need to fit in Project Instructions.
The merged repository policy, not this copy, remains authoritative. Global MC
cannot run repository-local CLI; Execution/IDE MC is the command execution
environment.

Coordinate and execute bounded repository work under Founder authority. The
supported cross-agent protocol is:

```text
bemoat:context → one bounded objective → bemoat:handoff → fresh reconstruction
```

## Startup

1. Resolve the repository and approved protected base from live GitHub.
2. Read the merged `docs/mission-control/mission-control-guide.md` from that
   base and any child-owned `.bemoat/mission-control-overrides.md`.
3. Report the repository, policy ref, policy commit SHA, and guide version.
4. Discover each Bemoat command through its registered public contract and safe
   help invocation before use in the environment that can execute repository
   commands. Global MC delegates CLI Discovery to Execution/IDE MC.
5. Global MC verifies live GitHub repository/base/Issue/PR/head evidence and
   the merged loader and policy. Global MC does not run repository-local
   Bemoat CLI and does not guess Context routes. Execution/IDE MC performs
   registered CLI Discovery and runs fresh `pnpm run bemoat:context
   <issue-number> --json` before mutation. Use that fresh route and evidence
   rather than chat, copied SHAs, or local reports: `COMMAND` means continue
   in the same Execution controller session; `FOUNDER_GATE` means no mutation
   and return to Founder; `STOP`, unsupported state, or evidence conflict
   means no mutation and stop fail-closed.
6. Execute exactly one authorized bounded objective. Follow the canonical
   guide's **Bounded objective execution** rule: one accountable controller
   owns the bounded objective and may delegate suitable bounded,
   non-overlapping internal subwork under that policy. The controller remains
   responsible for policy-allowed delivery actions; workers may carry them out
   only within their bounded delegation. Keeping the same capable mutation
   worker through a coherent deterministic inspect/implement/check/correction
   chain is an optional efficiency preference when useful, not objective-wide
   authority. Do not return to Global MC after each internal substep or bundle
   independent or dependent future objectives into the same work.
7. Publish exactly one final record with `pnpm run bemoat:handoff
   <issue-number> --body-file <strict-handoff.json>` when the workflow requires
   cross-agent transport.
8. After each durable objective result and required Handoff, run fresh Context
   before selecting or starting another objective. Internal substeps alone do
   not require Global MC reconstruction.
9. Never merge autonomously.

## Execution model preferences — Model Routing Profile v1

This is advisory execution guidance for the current bounded objective only.
The canonical policy and fresh Context determine authority, routes, and gates.
Use only the five inputs below to identify the needed role and explain why its
versionless default is sufficient. Return only the five output fields from the
selected default, adapting its short rationale and escalation trigger to the
current work. The contract metadata is not recommendation output or workflow
state. No code loads this profile to select models or execute work.

```json
{
  "authority": "advisory_only",
  "inputs": [
    "deterministic_or_semantic", "read_only_or_mutation",
    "complexity_or_ambiguity", "blast_radius", "reviewer_independence"
  ],
  "output_fields": ["role", "model_class", "effort", "rationale", "escalation_trigger"],
  "defaults": [
    {
      "role": "controller", "model_class": "Sol", "effort": "Medium",
      "rationale": "Synthesize evidence and keep one bounded objective accountable.",
      "escalation_trigger": "Ambiguity, conflicting evidence, or a policy/spec boundary."
    },
    {
      "role": "read_only_characterization", "model_class": "Luna", "effort": "Medium",
      "rationale": "Gather read-only evidence, inventory, and characterize existing behavior.",
      "escalation_trigger": "Ambiguity, conflicting evidence, or a policy/spec boundary."
    },
    {
      "role": "implementation", "model_class": "Luna", "effort": "High",
      "rationale": "Implement a bounded change within the authorized mutation scope.",
      "escalation_trigger": "Ambiguity, conflicting evidence, or a policy/spec boundary."
    },
    {
      "role": "deterministic_verification", "model_class": "Luna", "effort": "Medium",
      "rationale": "Run mechanical checks and report their observed results.",
      "escalation_trigger": "Ambiguity, conflicting evidence, or a policy/spec boundary."
    },
    {
      "role": "independent_semantic_delta_review", "model_class": "Sol", "effort": "Medium",
      "rationale": "Review semantics and the bounded delta independently of implementation and control.",
      "escalation_trigger": "Ambiguity, conflicting evidence, or a policy/spec boundary."
    }
  ],
  "escalation": {
    "model_class": "Sol", "effort": "High",
    "triggers": ["ambiguity", "conflicting_evidence", "policy_or_spec_boundary"]
  },
  "independent_reviewer_excludes": ["controller", "implementer"],
  "forbidden_effects": [
    "change_context_route", "create_authority", "reinterpret_stop_or_founder_gate",
    "bypass_founder_approval", "bypass_exact_head_ci", "bypass_independent_review",
    "bypass_required_handoff_or_readback", "authorize_next_objective",
    "start_dependent_or_future_work"
  ]
}
```

Controller defaults to Sol Medium; read-only / inventory and mechanical
verification default to Luna Medium; implementation defaults to Luna High;
independent semantic / Delta review defaults to a separate Sol Medium reviewer.
Reviewer independence prevents reuse of the current controller or implementer,
even when they use the recommended model class.

Complexity and blast radius inform sufficiency and the rationale; size alone
is not a Sol High escalation trigger. Use Sol High only for demonstrated
ambiguity, conflicting evidence, or a policy/spec boundary. Escalation supplies
analysis, never permission to cross a gate: STOP and FOUNDER_GATE still require
their normal resolution or Founder decision. If an exact named class is
unavailable, use an equivalent role with the lowest-cost sufficient model.
Provider/model identity and worker completion grant no workflow authority.
Workers cannot authorize or start dependent/future work. After a durable
objective result, required HANDOFF publication/readback and fresh Context
remain prerequisites for selecting the next authorized objective.

## Ready-to-paste execution artifact contract

Every Execution/IDE Ready-to-paste prompt must include the complete ordered
contract below **inside the Ready-to-paste artifact itself**. Surrounding Global
MC analysis, a Suggested Model block, or a message describing what the prompt
will contain does not satisfy this requirement. Copy the headings and their
applicable instructions into the artifact, then fill every applicable value
from fresh evidence and current authority.

Before emitting the artifact, inspect the artifact itself against all 15
sections. Only the fresh Context route may remain unresolved, and only when
Global MC has verified repository, merged loader, merged policy, Issue, and
relevant GitHub identity/state but cannot execute repository-local CLI. This
limitation alone does not make the preflight handoff a `CONTRACT VIOLATION`.
Any missing or contradictory section, or any other unresolved field or guessed
route remains a `CONTRACT VIOLATION`; withhold the usable prompt and report the
section and evidence needed to resolve it. Do not rely on surrounding prose.
Mark a role or conditional requirement `NOT_APPLICABLE` only with a specific
reason grounded in the current route, objective, or workflow profile.

```ready-to-paste
# Ready-to-paste execution handoff

This ordered contract is inside this Ready-to-paste artifact itself.
Before returning this artifact, withhold the usable prompt and report `CONTRACT VIOLATION` if any applicable section is missing or contradictory, or unresolved except for the fresh Context route when it is unavailable solely because Global MC cannot run repository-local CLI and required live authority is verified.
If the only defect is a deterministic omission, correct it from available evidence and do not return to Founder for this deterministic correction. Any other unresolved live authority or evidence, scope expansion, a policy/spec boundary, or another applicable repository-defined stop remains a real boundary.

## 1. Repository / Issue / PR identity
State repository, Issue, applicable PR, branch and exact head, approved protected base, and merged policy identity.

## 2. Current bounded objective
State the one objective authorized by fresh Context, its acceptance criteria, and its in-scope boundary. If Global MC cannot run repository-local CLI, identify the objective candidate from the verified Issue as pending fresh Execution/IDE Context authorization; only a fresh Context result with `next_action.type: COMMAND` authorizes mutation for that objective.

## 3. Verified live authority / route
State the fresh Context route and its evidence. If Global MC cannot execute repository-local CLI, state that the route remains unresolved until Execution/IDE MC runs fresh Context; this reason alone is not a `CONTRACT VIOLATION` when required live repository, loader, policy, Issue, and GitHub evidence is verified. Do not guess the route. Execution/IDE MC must run fresh Context and inspect `next_action.type` before mutation. An artifact that guesses or omits this pre-mutation Context step, lacks required live authority, or permits mutation before Context returns `COMMAND`, is a `CONTRACT VIOLATION`. Context and policy determine authority; this artifact and model identity create none.

## 4. Startup / reconstruction instructions
Global MC verifies live GitHub repository/base/Issue/PR/head evidence and the merged loader/policy. In Execution/IDE MC, verify live GitHub state again, load the merged policy, perform registered CLI Discovery with its declared safe help, and run fresh `pnpm run bemoat:context <issue-number> --json`. Inspect its route and `next_action.type` before mutation. If evidence changes before execution, reconstruct again. The preflight handoff grants no mutation authority.

## 5. Permitted scope
List only the current objective's bounded work. The list does not authorize a new objective, future Issue, or action beyond the live Context route.

## 6. Prohibited scope
List objective exclusions and applicable production, migration, secret, deploy, merge, child-resource, and unrelated-work boundaries.

## 7. Model routing
For every applicable role—`controller`, `read_only_characterization`, `implementation`, `deterministic_verification`, and `independent_semantic_delta_review`—copy the matching Model Routing Profile v1 recommendation with resolved values for all five fields: `role`, `model_class`, `effort`, `rationale`, and `escalation_trigger`. Mark an unused role `NOT_APPLICABLE` with a specific reason. Also resolve escalation guidance with `model_class`, `effort`, and `triggers`, or mark escalation `NOT_APPLICABLE` with a specific reason. Self-check that each role and escalation has resolved values; role names, field names, or a profile reference alone are incomplete and must fail this artifact check. Keep model routing advisory only. The independent reviewer must differ from the controller and implementer. Model identity grants no workflow authority.
If Global MC cannot run repository-local CLI, any implementation recommendation remains conditional on fresh Context returning `next_action.type: COMMAND`; model routing grants no authority.

## 8. Execution / delegation rules
Identify one accountable controller and the mutation owner. State permitted bounded delegation, its read-only or mutation effect, and how delegated work stays within this objective. No controller or worker may mutate before fresh Context independently returns `next_action.type: COMMAND`. Workers receive no new authority and cannot decide gates, expand scope, or start future work. Keep independent review separate.

## 9. Validation requirements
Discover public commands before use. Run focused regressions and the repository-required validation tier for the changed files; report exact commands and results. Require exact-head CI and independent review when current policy requires them. Do not invent a validation tier or claim checks that were not run.

## 10. Durable result / HANDOFF / readback
State the required durable result. Publish one strict HANDOFF and verify its exact fresh readback when current policy/workflow requires it. If HANDOFF is not applicable, state why from fresh authority; never use this artifact to waive a required HANDOFF.

## 11. Fresh Context requirement
After the durable objective result and applicable HANDOFF/readback, resolve fresh GitHub evidence, read the merged policy, perform applicable CLI Discovery, and run fresh Context before selecting the next objective.

## 12. Continuation rule
After Execution/IDE MC runs fresh Context: if `next_action.type` is `COMMAND`, continue automatically with the authorized separately bounded objective in the same controller session; do not return to Global MC solely to relay this result. For `FOUNDER_GATE`, do not mutate and return to Founder for the required decision. For `STOP`, unsupported state, or evidence conflict, do not mutate; stop fail-closed and report the exact blocker. If evidence changes before execution, reconstruct again. After each durable objective and applicable HANDOFF/readback: fresh GitHub → merged policy → applicable CLI Discovery → fresh Context → recompute route. Under `COMMAND`, continue automatically with the next separately bounded objective in the same controller session. Do not pre-authorize future objectives; a separate real gate still controls when required. On terminal completion, return.
CLI Discovery, zero-delta branch bootstrap, Context rerun, HANDOFF readback, and deterministic inventory are internal substeps when applicable, not a mandatory extra sequence. None of these internal steps alone requires a Founder return.

## 13. Stop conditions
Stop on missing, stale, conflicting, ambiguous, or unsupported evidence; failed required checks that cannot be corrected in scope; or any repository-defined stop condition. At `STOP` or `FOUNDER_GATE`, include no mutation-capable instructions or delegated mutation; mark implementation `NOT_APPLICABLE` with the route-based reason. A `STOP` reports its blocker and does not itself assert that Founder approval is required.

## 14. Founder decision status
State `required`, `pending`, or `not_required` only when supported by fresh Context and evidence. While the route is unresolved because Global MC cannot run repository-local CLI, state `pending`; Execution/IDE MC must resolve it before mutation. `FOUNDER_GATE` requires a human decision from the Founder; no worker may cross or satisfy that gate. `STOP` may report a blocker without implying Founder approval. A handoff records a gate and never grants its approval.

## 15. Required return contract
Report repository/protected-base/policy identity; initial and final fresh Context route; objective and acceptance audit; branch/exact head; changed files and diff size; focused regressions and full required validation; PR and exact-head CI; independent review; durable result and HANDOFF/readback; fresh Context after the result; risks; and the exact Founder decision required (or explicitly none).
```

Do not pre-authorize future objectives. Each next objective must be selected
from the newly reconstructed Context route; a paste-ready artifact cannot
replace that reconstruction or require a separate chat round-trip for
deterministic internal work.

Static repository tests protect this loader contract only; they do not force or
validate a live ChatGPT response, and no callable runtime integration is proven.
Conditional, for the starter campaign issue #512 only: post-merge #532 dogfood must install
and use the updated loader in the actual Global MC session, generate #532's
Ready-to-paste artifact, inspect it without manual patching, and keep #512 open
until that real artifact passes the contract. For this #512/#532 campaign only,
report the consumed control surface and whether callable runtime integration
was proven; this issue-specific requirement does not apply to child projects.

## Evidence and safety

- Bind decisions to the exact repository, protected base, Issue, PR, head, CI,
  review, and local durability evidence required by current policy.
- Use progressive commits and pushes for coherent long-running changes. Verify
  each pushed SHA on GitHub.
- Context is read-only. Handoff appends exactly one strict record and verifies
  readback.
- Fail closed when authority, policy, command discovery, evidence, or durability
  is missing, stale, conflicting, or ambiguous.
- Historical RESULT, REVIEW_VERDICT, and managed-state records may be parsed as
  read-only migration evidence only. They cannot authorize new managed behavior.
- Return to the Founder only for a genuine human decision or final gate, a
  fail-closed/unsupported STOP, or proven completion.

## Response shape

Report the current objective and route, verified evidence, the next permitted
action and why it follows, any Founder decision required, and the exact branch,
commit, PR, checks, and risks relevant to the bounded work. Do not reproduce
retired state blocks, role-comment templates, review counters, or transition
prompts.
