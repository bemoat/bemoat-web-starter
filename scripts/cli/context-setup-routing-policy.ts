/** Routing metadata for the narrow protected-base setup recovery command. */
type ContextSetupRoute = {
  route_key: string
  observed_state: string
  evidence_case: string
  required_evidence_condition: string
  forbidden_evidence_condition: string
  permitted_operation: string
  canonical_command: string
  required_review_type: null
  expected_post_state_or_gate: string
  prohibited_commands: string[]
  decision: 'COMMAND'
  stop_condition: string
}

export function contextSetupRoutes(): ContextSetupRoute[] {
  return [{
    route_key: 'context_recover_clean_stale_protected_base',
    observed_state: 'NOT_STATEFUL',
    evidence_case: 'One open Issue without an active PR in a clean canonical checkout of the approved protected branch, strictly behind its exact live base.',
    required_evidence_condition: 'Context binds canonical repository, Issue, protected-base branch/SHA, local branch/HEAD/upstream, clean state, and unique matching live GitHub/origin ref; local HEAD equals its tracking ref; known non-ancestor history is excluded. After exact fetch, the command proves strict ancestry and absence of local-only commits against the immutable bound SHA.',
    forbidden_evidence_condition: 'Dirty or detached state, wrong origin/branch/upstream, non-open Issue, active or ambiguous PR, conflicting evidence, known divergence, local tracking mismatch, missing/ambiguous/moved base, fetch failure, or post-fetch ancestry/readback mismatch.',
    permitted_operation: 'Recollect and bind evidence; exact --no-tags fetch of origin refs/heads/<base> into FETCH_HEAD only with --refmap=; prove strict ancestry and recheck live GitHub/origin before git merge --ff-only <exact-bound-base-sha>; then compare-and-swap the tracking ref from its original SHA to the exact bound base SHA.',
    canonical_command: 'bemoat:context:recover-setup',
    required_review_type: null,
    expected_post_state_or_gate: 'Clean same protected branch and canonical origin/<base> upstream with local HEAD, upstream tracking ref, exact origin base, and live GitHub base all equal; recommend only fresh CLI Discovery and Context, with no objective-edit authority.',
    prohibited_commands: ['bemoat:context:sync-base', 'bemoat:boilerplate:sync', 'bemoat:handoff'],
    decision: 'COMMAND',
    stop_condition: 'STOP on every missing, ambiguous, conflicting, drifted, dirty, divergent, local-only, failed-command, or mismatched-readback condition; never fall back to destructive recovery.',
  }]
}
