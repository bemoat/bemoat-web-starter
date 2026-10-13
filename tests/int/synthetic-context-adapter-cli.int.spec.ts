import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

type CampaignTrace = {
  overall: string
  capability: { status: string; owner: string }
  oracle: {
    provenance_verified: boolean
    canonical_source_path: string
    normalized_source_path: string
    negative_entries: Array<{
      id: string
      status: string
      expected_route: null
      expected_action: null
      canonical_expected_exclusions: string[]
      canonical_prohibited_effects: string[]
      normalized_exclusions: string[]
      canonical_exclusion_refs: string[]
      canonical_exclusion_values: string[]
    }>
    tier2: {
      id: string
      status: string
      expected_route: null
      expected_action: null
      canonical_exclusion_refs: string[]
      canonical_exclusion_values: string[]
    }
  }
  transitions: Array<{
    id: string
    oracle_profile: string
    expected_route: string
    expected_action: null
    observed_route: string | null
    observed_action: string | null
    context_status: string
    handoff_status: string
    pre_authorization: {
      oracle_profile: string | null
      expected_route: string | null
      observed_route: string
      observed_action: string | null
      exact_head: string
      stage_advance_authorized_before_commit: boolean
      oracle_backed: boolean
    } | null
    handoff: {
      record_route: string
      record_exact_head: string
      record_pr: { number: string; url: string; base: string; head: string; head_sha: string } | null
    }
    fixture_readback: {
      profile_switch_only: boolean
      prior_comment_ids: string[]
      after_handoff_comment_ids: string[]
    }
    identity: {
      repository: string
      issue_number: string
      branch: string
      exact_head: string
      protected_base: { branch: string; sha: string }
      pr: { number: string; url: string; base: string; head: string; head_sha: string } | null
    }
  }>
  negatives: Array<{
    id: string
    status: string
    expected_route: null
    expected_action: null
    observed_route: string | null
    observed_action: string | null
    side_effect_proof: {
      fixture_before: { sha256: string; comment_ids: string[]; next_comment_id: number }
      fixture_after: { sha256: string; comment_ids: string[]; next_comment_id: number }
      context_mutation_performed: boolean
      fixture_unchanged: boolean
      original_checkout_unchanged: boolean
      poison_gh_delta: string[]
      poison_gh_delta_empty: boolean
      observed_forbidden_effects: string[]
    }
    allowed_harness_effects: string[]
    enforced_exclusions: string[]
    dirty_file_cleanup: {
      required: boolean
      existed_before_context: boolean
      existed_after_context: boolean
      cleanup_verified: boolean
    }
  }>
  tier2: { id: string; status: string; expected_route: null; expected_action: null; blocker: string; owner: string }
  bindings: {
    repository: string
    issue_number: string
    branch: string
    exact_head: string
    protected_base: { branch: string; sha: string }
    fixture: { relative_path: string; owner_marker: string }
  }
  allowed_effects: string[]
  forbidden_effects: string[]
  trace_retained: boolean
  isolation: { original_checkout_unchanged: boolean; poison_gh_invocations: string[]; cleanup_verified: boolean; cleanup_target: { relative_path: string; owner_marker: string } }
  trace_path: string
}

describe('Issue 648 registered CLI synthetic campaign', () => {
  it('runs route-backed A→B→C→D and preserves oracle-backed SPEC_GAP negatives', () => {
    const root = process.cwd()
    const canonicalOracle = JSON.parse(readFileSync(resolve(root, 'docs/mission-control/flow-oracle.json'), 'utf8'))
    const normalizedOracle = JSON.parse(readFileSync(resolve(root, 'tests/fixtures/verify-harness-flow/oracle.json'), 'utf8'))
    const happyPathExpectations = Object.fromEntries(['HP-01', 'HP-02', 'HP-03', 'HP-04'].map((id) => {
      const scenario = canonicalOracle.scenarios.find((candidate: { id: string }) => candidate.id === id)
      return [id, {
        route: scenario.expected_observation.native_route,
        action: scenario.expected_observation.native_next_action_type,
      }]
    }))
    const runnerPath = resolve(root, '.agents/skills/verify-harness-flow/run-synthetic-context.mjs')
    const result = JSON.parse(execFileSync(process.execPath, [runnerPath], { cwd: root, encoding: 'utf8' })) as CampaignTrace

    expect(result.overall).toBe('SUPPORTED')
    expect(result.capability).toEqual({
      status: 'SUPPORTED',
      owner: 'bemoat:context CLI adapter owner',
    })
    expect(result.oracle).toMatchObject({
      provenance_verified: true,
      canonical_source_path: 'docs/mission-control/flow-oracle.json',
      normalized_source_path: 'tests/fixtures/verify-harness-flow/oracle.json',
    })
    expect(result.oracle.negative_entries).toEqual(normalizedOracle.failure_labels.map((entry: {
      id: string
      status: string
      expected_route: null
      expected_action: null
      exclude: string[]
      canonical_exclusion_refs: string[]
      canonical_exclusion_values: string[]
    }) => {
      const canonical = canonicalOracle.scenarios.find((scenario: { id: string }) => scenario.id === entry.id)
      if (!canonical) throw new Error(`missing canonical scenario ${entry.id}`)
      return {
        id: entry.id,
        status: entry.status,
        expected_route: entry.expected_route,
        expected_action: entry.expected_action,
        canonical_expected_exclusions: canonical.expected_exclusions,
        canonical_prohibited_effects: canonical.prohibited_effects,
        normalized_exclusions: entry.exclude,
        canonical_exclusion_refs: entry.canonical_exclusion_refs,
        canonical_exclusion_values: entry.canonical_exclusion_values,
      }
    }))
    expect(result.oracle.tier2).toEqual({
      id: normalizedOracle.capability_boundary.id,
      status: normalizedOracle.capability_boundary.status,
      expected_route: normalizedOracle.capability_boundary.expected_route,
      expected_action: normalizedOracle.capability_boundary.expected_action,
      canonical_exclusion_refs: normalizedOracle.capability_boundary.canonical_exclusion_refs,
      canonical_exclusion_values: normalizedOracle.capability_boundary.canonical_exclusion_values,
    })
    expect([result.oracle.canonical_source_path, result.oracle.normalized_source_path]
      .every((path) => !path.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(path))).toBe(true)
    expect(result.transitions.map(({ id }) => id)).toEqual(['A', 'B', 'C', 'D'])
    expect(result.transitions.map(({ oracle_profile }) => oracle_profile)).toEqual(['HP-01', 'HP-02', 'HP-03', 'HP-04'])
    expect(result.transitions.map(({ oracle_profile }) => happyPathExpectations[oracle_profile].route))
      .toEqual(result.transitions.map(({ expected_route }) => expected_route))
    expect(result.transitions.map(({ oracle_profile }) => happyPathExpectations[oracle_profile].action))
      .toEqual(result.transitions.map(({ expected_action }) => expected_action))
    expect(result.transitions.every(({ context_status, handoff_status }) => context_status === 'PASS' && handoff_status === 'PASS')).toBe(true)
    expect(result.transitions.map(({ pre_authorization }) => pre_authorization?.oracle_profile ?? null))
      .toEqual([null, 'HP-02', 'HP-03', null])
    // Router contract: VERIFY/COMMAND verifies exact-head checks; only FIX/COMMAND
    // authorizes a bounded correction commit. HP-02 and HP-03 are independent oracle routes.
    expect(result.transitions[1]?.pre_authorization).toMatchObject({
      observed_route: 'VERIFY', observed_action: 'COMMAND',
      stage_advance_authorized_before_commit: false, oracle_backed: true,
    })
    expect(result.transitions.slice(2).every(({ pre_authorization }) =>
      pre_authorization?.stage_advance_authorized_before_commit === true &&
      pre_authorization.observed_route === 'FIX' &&
      pre_authorization.observed_action === 'COMMAND' &&
      pre_authorization.exact_head.length === 40)).toBe(true)
    expect(result.transitions[3]?.pre_authorization).toMatchObject({
      oracle_backed: false,
      oracle_profile: null,
      expected_route: null,
      observed_route: 'FIX',
    })
    expect(result.transitions.every(({ observed_action }) => typeof observed_action === 'string')).toBe(true)
    expect(result.transitions.map(({ fixture_readback }) => fixture_readback.prior_comment_ids.length)).toEqual([0, 1, 2, 3])
    expect(result.transitions.map(({ fixture_readback }) => fixture_readback.after_handoff_comment_ids.length)).toEqual([1, 2, 3, 4])
    expect(result.transitions.map(({ fixture_readback }) => fixture_readback.prior_comment_ids)).toEqual([[], ['1'], ['1', '2'], ['1', '2', '3']])
    expect(result.transitions.map(({ fixture_readback }) => fixture_readback.after_handoff_comment_ids)).toEqual([['1'], ['1', '2'], ['1', '2', '3'], ['1', '2', '3', '4']])
    expect(result.transitions.every(({ fixture_readback }) => fixture_readback.profile_switch_only)).toBe(true)
    expect(result.transitions[1]?.identity.exact_head).toBe(result.transitions[0]?.identity.exact_head)
    expect(new Set(result.transitions.map(({ identity }) => identity.exact_head)).size).toBe(3)
    expect(result.transitions.every(({ handoff, observed_route, identity }) =>
      handoff.record_route === observed_route &&
      handoff.record_exact_head === identity.exact_head &&
      (handoff.record_pr === null || handoff.record_pr.head_sha === identity.exact_head))).toBe(true)
    expect(result.transitions.slice(1).every(({ identity }) => identity.pr?.head_sha === identity.exact_head)).toBe(true)
    expect(result.transitions.every(({ identity }) =>
      identity.repository === 'synthetic/fixture-648' && identity.issue_number === '648' &&
      identity.branch === 'test/648-synthetic-context-adapter' && identity.exact_head.length === 40 &&
      identity.protected_base.branch === 'main' && identity.protected_base.sha.length === 40)).toBe(true)

    expect(result.negatives.map(({ id }) => id)).toEqual(['F01', 'F02', 'F03', 'F04', 'F05', 'F06'])
    const negativeExpectations = Object.fromEntries(normalizedOracle.failure_labels.map((entry: { id: string; status: string; expected_route: null; expected_action: null }) => [entry.id, entry]))
    expect(result.negatives.every(({ id, status, expected_route, expected_action }) =>
      status === negativeExpectations[id].status && expected_route === negativeExpectations[id].expected_route && expected_action === negativeExpectations[id].expected_action)).toBe(true)
    expect(result.negatives.every(({ observed_route, observed_action }) =>
      observed_route !== undefined && observed_action !== undefined)).toBe(true)
    // The canonical oracle forbids only these specific advancements; the
    // SPEC_GAP/null route/action fields remain intentionally unconstrained.
    expect(result.negatives.find(({ id }) => id === 'F01')?.observed_action).not.toBe('COMMAND')
    expect(result.negatives.find(({ id }) => id === 'F05')?.observed_route).not.toBe('COMPLETE')
    expect(result.negatives.find(({ id }) => id === 'F05')?.observed_action).not.toBe('COMPLETE')
    expect(result.negatives.find(({ id }) => id === 'F06')?.observed_action).not.toBe('COMMAND')
    expect(result.negatives.every(({ expected_route, expected_action, side_effect_proof }) =>
      expected_route === null && expected_action === null &&
      side_effect_proof.context_mutation_performed === false &&
      side_effect_proof.fixture_unchanged &&
      side_effect_proof.original_checkout_unchanged &&
      side_effect_proof.poison_gh_delta_empty &&
      side_effect_proof.observed_forbidden_effects.length === 0 &&
      side_effect_proof.fixture_before.sha256 === side_effect_proof.fixture_after.sha256 &&
      side_effect_proof.fixture_before.comment_ids.join(',') === side_effect_proof.fixture_after.comment_ids.join(',') &&
      side_effect_proof.fixture_before.next_comment_id === side_effect_proof.fixture_after.next_comment_id)).toBe(true)
    expect(result.negatives.map(({ side_effect_proof }) => side_effect_proof.poison_gh_delta)).toEqual([[], [], [], [], [], []])
    expect(result.negatives.filter(({ id }) => id !== 'F02')
      .every(({ allowed_harness_effects, dirty_file_cleanup }) =>
        allowed_harness_effects.length === 0 &&
        dirty_file_cleanup.required === false &&
        dirty_file_cleanup.existed_before_context === false &&
        dirty_file_cleanup.existed_after_context === false &&
        dirty_file_cleanup.cleanup_verified === true)).toBe(true)
    const negativeF02 = result.negatives.find(({ id }) => id === 'F02')
    expect(negativeF02?.allowed_harness_effects).toEqual(['runner-owned F02 dirty file cleanup'])
    expect(negativeF02?.dirty_file_cleanup).toEqual({
      required: true,
      existed_before_context: true,
      existed_after_context: true,
      cleanup_verified: true,
    })
    expect(result.negatives.map(({ id, enforced_exclusions }) => [
      id,
      enforced_exclusions,
    ])).toEqual(normalizedOracle.failure_labels.map((entry: { id: string; exclude: string[] }) => [
      entry.id,
      entry.exclude,
    ]))

    expect(result.tier2).toEqual({
      id: normalizedOracle.capability_boundary.id,
      status: normalizedOracle.capability_boundary.status,
      expected_route: normalizedOracle.capability_boundary.expected_route,
      expected_action: normalizedOracle.capability_boundary.expected_action,
      blocker: normalizedOracle.capability_boundary.exclude.join('; '),
      owner: 'native spawned-host capability owner',
    })
    expect(result.bindings.fixture.relative_path).toBe('github-evidence.json')
    expect(result.bindings.fixture.owner_marker).toMatch(/^verify-harness-flow:bemoat-648-synthetic-evidence-/)
    expect(result.allowed_effects.join(' ')).toMatch(/run-owned synthetic GitHub evidence fixture/)
    expect(result.forbidden_effects.join(' ')).toMatch(/production GitHub mutation/)
    expect(result.isolation.original_checkout_unchanged).toBe(true)
    expect(result.isolation.poison_gh_invocations).toEqual([])
    expect(result.isolation.cleanup_verified).toBe(true)

    const trace = JSON.parse(readFileSync(result.trace_path, 'utf8')) as CampaignTrace
    expect(trace.overall).toBe('SUPPORTED')
    expect(trace.trace_retained).toBe(true)
    expect(JSON.stringify(trace)).not.toMatch(/Users\/|\.codex\/worktrees|BEMOAT_TEST_EVIDENCE_FIXTURE/)
  }, 60_000)
})
