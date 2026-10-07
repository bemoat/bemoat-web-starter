# Advisory Model Routing Profile v1

This profile is optional guidance for selecting models for one bounded
objective. The canonical policy and fresh Context determine authority, routes,
and gates. Use only the five declared inputs to identify a role and explain why
its versionless default is sufficient. Return only the five output fields from
the selected default, adapting its rationale and escalation trigger to the
current work. The metadata is not recommendation output or workflow state. No
code loads this profile to select models or execute work.

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
      "role": "controller", "model_class": "Luna", "effort": "XHigh",
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

The default accountable controller is Luna XHigh. Read-only / inventory and
mechanical verification default to Luna Medium; implementation defaults to
Luna High; independent semantic / Delta review defaults to a separate Sol
Medium reviewer. Sol Medium is not an ordinary or fallback controller
default.
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
