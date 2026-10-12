#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const skillDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(skillDir, '../../..')
const oraclePath = resolve(repoRoot, 'tests/fixtures/verify-harness-flow/oracle.json')
const observationPath = resolve(skillDir, 'fixtures/synthetic-observation.json')
const oracle = JSON.parse(readFileSync(oraclePath, 'utf8'))
const observation = JSON.parse(readFileSync(observationPath, 'utf8'))
const evidenceRoot = realpathSync(mkdtempSync(join(tmpdir(), 'bemoat-643-flow-evidence-')))
const workspace = join(evidenceRoot, 'owned-workspace')
const runToken = `verify-harness-flow:${basename(evidenceRoot)}`
const ownerMarker = '.verify-harness-flow-owner'
const checks = []
let workspaceCreated = false
let cleanupVerified = false
let overall = 'PASS'

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function record(name, status, detail) {
  checks.push({ name, status, detail })
  if (status === 'DEFECT') overall = 'DEFECT'
}

function publicHelp(label, args, expected) {
  const output = execFileSync('pnpm', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const envelope = JSON.parse(output)
  const matches = Object.entries(expected).every(([key, value]) => JSON.stringify(envelope[key]) === JSON.stringify(value))
  record(label, matches ? 'PASS' : 'DEFECT', matches ? 'registered public help contract matched' : 'registered public help contract mismatch')
}

try {
  publicHelp('public-context-help', ['--silent', 'run', 'bemoat:context', '--', '--help', '--json'], {
    command: 'bemoat:context', mode: 'help', classification: 'HELP', writes: [],
  })
  publicHelp('public-handoff-help-only', ['--silent', 'run', 'bemoat:handoff', '--', '--help', '--json'], {
    command: 'bemoat:handoff', mode: 'help', classification: 'HELP',
    writes: ['exactly one top-level Issue HANDOFF comment; no other protocol mutation'],
  })

  if (observation.evidence_class !== 'SYNTHETIC' || observation.context_input !== false) {
    throw new Error('synthetic fixture boundary mismatch')
  }
  mkdirSync(workspace)
  workspaceCreated = true
  writeFileSync(join(workspace, ownerMarker), runToken, { flag: 'wx' })
  const remote = join(workspace, 'origin.git')
  const source = join(workspace, 'source')
  const clone = join(workspace, 'clone')
  git(['init', '--bare', '--initial-branch=main', remote], workspace)
  git(['init', '--initial-branch=main', source], workspace)
  git(['config', 'user.name', 'Bemoat Synthetic Tester'], source)
  git(['config', 'user.email', 'synthetic-tester@example.invalid'], source)
  writeFileSync(join(source, 'observation.json'), JSON.stringify(observation, null, 2))
  git(['add', 'observation.json'], source)
  git(['commit', '-m', 'synthetic harness-flow observation'], source)
  const commit = git(['rev-parse', 'HEAD'], source)
  git(['remote', 'add', 'origin', remote], source)
  git(['push', '--set-upstream', 'origin', 'main'], source)
  git(['clone', remote, clone], workspace)
  const clonedCommit = git(['rev-parse', 'HEAD'], clone)
  record(
    'disposable-local-git-roundtrip',
    commit === clonedCommit ? 'PASS' : 'DEFECT',
    commit === clonedCommit ? 'owned commit round-tripped through a local bare remote' : 'local clone did not match owned commit',
  )

  const gapRecords = oracle.failure_labels.map(({ id, status, expected_route, expected_action }) => ({
    id, status, expected_route, expected_action,
  }))
  const gapPreserved = gapRecords.length === 6 && gapRecords.every((item, index) =>
    item.id === `F0${index + 1}` && item.status === 'SPEC_GAP' && item.expected_route === null && item.expected_action === null)
  record('independent-oracle-f01-f06', gapPreserved ? 'PASS' : 'DEFECT', 'oracle classifications and null outcomes preserved')

  const hostBoundary = oracle.capability_boundary
  record(
    'native-spawned-host',
    hostBoundary.status === 'UNREACHABLE' && hostBoundary.expected_route === null && hostBoundary.expected_action === null
      ? 'UNREACHABLE'
      : 'DEFECT',
    'synthetic CLI/Git evidence does not establish native spawned-host continuity',
  )
} catch {
  record('runner-execution', 'DEFECT', 'a bounded check failed; see exit status and inspect the sanitized trace')
} finally {
  try {
    if (workspaceCreated) {
      const marker = join(workspace, ownerMarker)
      if (!existsSync(marker) || readFileSync(marker, 'utf8') !== runToken) {
        throw new Error('ownership marker mismatch')
      }
      rmSync(workspace, { recursive: true })
      if (existsSync(workspace)) throw new Error('owned workspace still exists')
    }
    cleanupVerified = true
    record('owned-workspace-cleanup', 'PASS', 'ownership verified; workspace absent after cleanup')
  } catch {
    cleanupVerified = false
    record('owned-workspace-cleanup', 'DEFECT', 'cleanup ownership or absence readback failed')
  }

  if (!cleanupVerified && overall === 'PASS') overall = 'DEFECT'
  const trace = {
    record_type: 'verify_harness_flow_trace',
    issue_number: 643,
    overall,
    evidence_classes: {
      synthetic_cli_and_git: 'SYNTHETIC',
      native_spawned_host: 'UNREACHABLE',
    },
    oracle: {
      f01_f06: oracle.failure_labels.map(({ id, status, expected_route, expected_action }) => ({
        id, status, expected_route, expected_action,
      })),
      spawned_host: {
        id: oracle.capability_boundary.id,
        status: oracle.capability_boundary.status,
        expected_route: oracle.capability_boundary.expected_route,
        expected_action: oracle.capability_boundary.expected_action,
      },
    },
    checks,
    cleanup: { verified: cleanupVerified, owned_workspace_absent: !existsSync(workspace), trace_retained: true },
  }
  const tracePath = join(evidenceRoot, 'trace.json')
  writeFileSync(tracePath, `${JSON.stringify(trace, null, 2)}\n`, { flag: 'wx' })
  if (!existsSync(tracePath) || !existsSync(evidenceRoot)) {
    overall = 'DEFECT'
    process.exitCode = 1
  }
  process.stdout.write(`${JSON.stringify({ ...trace, overall, trace_path: tracePath }, null, 2)}\n`)
  if (overall !== 'PASS') process.exitCode = 1
}
