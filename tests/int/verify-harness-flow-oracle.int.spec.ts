import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

type Oracle = {
  public_cli: {
    discovery: { invocation: string; expected: Record<string, unknown> }
    context_help: { invocation: string; expected: Record<string, unknown> }
    handoff_help: { invocation: string; expected: Record<string, unknown> }
    help_side_effects: string[]
  }
  objective_lifecycle: { sequence: string[]; authorization_per_objective: string[]; prohibited: string[] }
  failure_labels: Array<{ id: string; status: string; expected_route: string | null; expected_action: string | null; exclude: string[] }>
  capability_boundary: { id: string; status: string; expected_route: string | null; expected_action: string | null; exclude: string[] }
  isolation_and_cleanup: { required: string[]; prohibited: string[] }
}

const root = process.cwd()
const oracle = JSON.parse(
  readFileSync(resolve(root, 'tests/fixtures/verify-harness-flow/oracle.json'), 'utf8'),
) as Oracle

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function runPublicHelp(invocation: string) {
  const [command, ...args] = invocation.split(' ')
  return execFileSync(command, args, { cwd: root, encoding: 'utf8' })
}

function runVerification() {
  const runnerPath = resolve(root, '.agents/skills/verify-harness-flow/run-verification.mjs')
  return JSON.parse(execFileSync(process.execPath, [runnerPath], { cwd: root, encoding: 'utf8' })) as {
    overall: string
    context_adapter_boundary: {
      status: string
      expected_route: string | null
      expected_action: string | null
      blocker: string
      owner: string
      supported_adapter: Record<string, unknown> | null
    }
    trials: Array<{ id: string; status: string; expected_route: string | null; expected_action: string | null; blocker: string; owner: string }>
    criteria: Array<{ id: string; status: string; expected_route: string | null; expected_action: string | null; blocker: string; owner: string }>
    original_checkout: { before: Record<string, unknown>; after: Record<string, unknown>; comparison: { unchanged: boolean } }
    oracle: {
      f01_f06: Array<{ id: string; status: string; expected_route: string | null; expected_action: string | null; exclude: string[] }>
      spawned_host: { id: string; status: string; expected_route: string | null; expected_action: string | null; exclude: string[] }
    }
    cleanup: { verified: boolean; owned_workspace_absent: boolean; trace_retained: boolean }
    trace_path: string
  }
}

describe('Issue 643 independent harness-flow oracle', () => {
  it('uses the public registered CLI help contract and leaves local workflow state unchanged', () => {
    const before = { head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), status: git('status', '--porcelain=v1') }
    const discovery = JSON.parse(runPublicHelp(oracle.public_cli.discovery.invocation))
    const context = JSON.parse(runPublicHelp(oracle.public_cli.context_help.invocation))
    const handoff = JSON.parse(runPublicHelp(oracle.public_cli.handoff_help.invocation))
    const after = { head: git('rev-parse', 'HEAD'), branch: git('branch', '--show-current'), status: git('status', '--porcelain=v1') }

    expect(discovery).toMatchObject(oracle.public_cli.discovery.expected)
    expect(context).toMatchObject(oracle.public_cli.context_help.expected)
    expect(handoff).toMatchObject(oracle.public_cli.handoff_help.expected)
    expect(oracle.public_cli.help_side_effects).toEqual([])
    expect(after).toEqual(before)
  })

  it('keeps A→B→C→D authorization separate at each objective boundary', () => {
    expect(oracle.objective_lifecycle.sequence).toEqual(['A', 'B', 'C', 'D'])
    expect(oracle.objective_lifecycle.authorization_per_objective).toHaveLength(4)
    for (const boundary of ['HANDOFF', 'fresh Context']) {
      expect(oracle.objective_lifecycle.authorization_per_objective.join(' ')).toContain(boundary)
    }
    expect(oracle.objective_lifecycle.prohibited).toContain('pre-authorize a future objective')
    expect(oracle.objective_lifecycle.prohibited).toContain('treat HANDOFF as permission or approval')
    expect(oracle.objective_lifecycle.prohibited).toContain('continue through STOP or FOUNDER_GATE without the separately required authority')
  })

  it('classifies F01–F06 as SPEC_GAP without manufacturing routes or actions', () => {
    expect(oracle.failure_labels.map(({ id }) => id)).toEqual(['F01', 'F02', 'F03', 'F04', 'F05', 'F06'])
    for (const failure of oracle.failure_labels) {
      expect(failure.status, failure.id).toBe('SPEC_GAP')
      expect(failure.expected_route, failure.id).toBeNull()
      expect(failure.expected_action, failure.id).toBeNull()
      expect(failure.exclude.length, failure.id).toBeGreaterThan(0)
    }
    expect(oracle.failure_labels[0]?.exclude).toContain('assumed recovery')
    expect(oracle.failure_labels[1]?.exclude).toContain('WIP loss')
    expect(oracle.failure_labels[2]?.exclude).toContain('timestamp-based selection')
    expect(oracle.failure_labels[3]?.exclude).toContain('assume STOP or FOUNDER_GATE from label alone')
    expect(oracle.failure_labels[4]?.exclude).toContain('stale proof reuse')
    expect(oracle.failure_labels[5]?.exclude).toContain('dynamic scheduling')
  })

  it('records the native spawned-host seam as UNREACHABLE unless host evidence exists', () => {
    expect(oracle.capability_boundary.id).toBe('UNREACHABLE-TIER2-SPAWNED-HOST')
    expect(oracle.capability_boundary.status).toBe('UNREACHABLE')
    expect(oracle.capability_boundary.expected_route).toBeNull()
    expect(oracle.capability_boundary.expected_action).toBeNull()
    expect(oracle.capability_boundary.exclude).toContain('claim spawned-host PASS without native continuity evidence')
    expect(oracle.capability_boundary.exclude).toContain('simulate spawning with prose')
  })

  it('requires owned-resource isolation, bounded cleanup, and retained sanitized evidence', () => {
    expect(oracle.isolation_and_cleanup.required).toContain('preserve original checkout and unrelated refs/WIP')
    expect(oracle.isolation_and_cleanup.required).toContain('no production GitHub mutation or writes outside the owned sandbox')
    expect(oracle.isolation_and_cleanup.required).toContain('cleanup removes only resources created and owned by this run')
    expect(oracle.isolation_and_cleanup.required).toContain('retain sanitized trace evidence after cleanup')
    expect(oracle.isolation_and_cleanup.required).toContain('verify ownership and post-cleanup absence before reporting cleanup success')
    expect(oracle.isolation_and_cleanup.prohibited).toContain('delete outside-owned paths')
    expect(oracle.isolation_and_cleanup.prohibited).toContain('erase original WIP')
    expect(oracle.isolation_and_cleanup.prohibited).toContain('report cleanup success without readback')
  })

  it('requires a discoverable Skill and isolated runner to implement the oracle', () => {
    const skillPath = resolve(root, '.agents/skills/verify-harness-flow/SKILL.md')
    const runnerPath = resolve(root, '.agents/skills/verify-harness-flow/run-verification.mjs')

    expect(existsSync(skillPath), 'the verification Skill must be discoverable').toBe(true)
    expect(existsSync(runnerPath), 'the bounded verification runner must exist').toBe(true)

    const skill = readFileSync(skillPath, 'utf8')
    expect(skill).toMatch(/Doctor[\s\S]*Drive[\s\S]*Capture[\s\S]*Cleanup/i)
    expect(skill).toMatch(/UNREACHABLE/i)
    expect(skill).toMatch(/SPEC_GAP/i)
    expect(skill).toMatch(/flow-oracle\.json/i)
    expect(skill).toMatch(/spawned[ -]host/i)
  })

  it('records the real Context adapter boundary and compares runner evidence with the independent oracle', () => {
    const result = runVerification()
    const expectedOracle = oracle.failure_labels.map(({ id, status, expected_route, expected_action, exclude }) => ({
      id, status, expected_route, expected_action, exclude,
    }))

    expect(result.overall).toBe('UNREACHABLE')
    expect(result.context_adapter_boundary).toMatchObject({
      status: 'UNREACHABLE',
      expected_route: null,
      expected_action: null,
    })
    expect(result.context_adapter_boundary.blocker).toMatch(/no controlled synthetic GitHub evidence adapter/i)
    expect(result.context_adapter_boundary.owner).toMatch(/CLI adapter owner/i)
    expect(result.context_adapter_boundary.supported_adapter).toEqual({
      command: 'bemoat:context',
      target_worktree: '--target-worktree <absolute-path>',
      live_github_reads: true,
      controlled_synthetic_github_evidence: false,
    })

    expect(result.trials.map(({ id }) => id)).toEqual(['A', 'B', 'C', 'D'])
    for (const trial of result.trials) {
      expect(trial).toMatchObject({
        status: 'UNREACHABLE',
        expected_route: null,
        expected_action: null,
      })
      expect(trial.blocker).toMatch(/no controlled synthetic GitHub evidence adapter/i)
      expect(trial.owner).toMatch(/CLI adapter owner/i)
    }
    expect(result.criteria.map(({ id }) => id)).toEqual(['C02', 'C03', 'C04', 'C05'])
    expect(result.criteria.map(({ status }) => status)).toEqual(['UNREACHABLE', 'UNREACHABLE', 'UNREACHABLE', 'UNREACHABLE'])
    for (const criterion of result.criteria) {
      expect(criterion.expected_route).toBeNull()
      expect(criterion.expected_action).toBeNull()
      expect(criterion.blocker).toMatch(/no controlled synthetic GitHub evidence adapter/i)
      expect(criterion.owner).toMatch(/CLI adapter owner/i)
    }

    expect(result.oracle.f01_f06).toEqual(expectedOracle)
    expect(result.oracle.spawned_host).toEqual({
      id: oracle.capability_boundary.id,
      status: oracle.capability_boundary.status,
      expected_route: oracle.capability_boundary.expected_route,
      expected_action: oracle.capability_boundary.expected_action,
      exclude: oracle.capability_boundary.exclude,
    })
    expect(result.original_checkout.comparison.unchanged).toBe(true)
    expect(result.original_checkout.after).toEqual(result.original_checkout.before)
    expect(result.cleanup).toMatchObject({ verified: true, owned_workspace_absent: true, trace_retained: true })
    const persistedTrace = JSON.parse(readFileSync(result.trace_path, 'utf8'))
    expect(persistedTrace.overall).toBe('UNREACHABLE')
    expect(persistedTrace.cleanup.trace_retained).toBe(true)
    expect(persistedTrace.oracle.f01_f06).toEqual(expectedOracle)
  })
})
