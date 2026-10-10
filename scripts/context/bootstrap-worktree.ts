import { realpathSync, statSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

import type { NormalizedContextEvidence } from './model.ts'
import { isFullSha, normalizeOriginRepository, output, runContextCommand, type ContextCommandRunner } from './runtime.ts'
import { verifyContextSyncSource, ContextSyncWorktreeError } from './sync-worktree.ts'

export interface ContextBootstrapRoots {
  sourceCwd: string
  targetCwd: string
  bootstrap: boolean
}

function canonicalDirectory(path: string, label: string, realpath: (path: string) => string, stat: (path: string) => { isDirectory(): boolean }): string {
  let canonical: string
  try {
    canonical = realpath(path)
    if (!stat(canonical).isDirectory()) throw new Error('not a directory')
  } catch {
    throw new ContextSyncWorktreeError(`${label} cannot be canonicalized to an existing directory`)
  }
  return canonical
}

export function resolveContextBootstrapRoots({
  sourceCwd,
  targetWorktree,
  entrypointPath,
  realpath = realpathSync,
  stat = statSync,
}: {
  sourceCwd: string
  targetWorktree?: string | null
  entrypointPath?: string
  realpath?: (path: string) => string
  stat?: (path: string) => { isDirectory(): boolean }
}): ContextBootstrapRoots {
  const source = canonicalDirectory(resolve(sourceCwd), 'command source worktree', realpath, stat)
  if (targetWorktree == null) return { sourceCwd: source, targetCwd: source, bootstrap: false }
  if (!entrypointPath) {
    throw new ContextSyncWorktreeError('command entrypoint is required for explicit target bootstrap')
  }
  let actualEntrypoint: string
  try {
    actualEntrypoint = realpath(entrypointPath)
  } catch {
    throw new ContextSyncWorktreeError('command entrypoint cannot be canonicalized inside the protected source worktree')
  }
  const expectedEntrypoint = resolve(source, 'scripts/agent-context.ts')
  if (actualEntrypoint !== expectedEntrypoint) {
    throw new ContextSyncWorktreeError('command entrypoint must resolve to scripts/agent-context.ts inside the protected source worktree')
  }
  if (!isAbsolute(targetWorktree)) throw new ContextSyncWorktreeError('--target-worktree must be an absolute path')
  const target = canonicalDirectory(targetWorktree, 'target worktree', realpath, stat)
  if (target === source) throw new ContextSyncWorktreeError('--target-worktree must be distinct from the command source worktree; omit the flag for same-worktree mode')
  return { sourceCwd: source, targetCwd: target, bootstrap: true }
}

/** Validate independently collected local source and target facts before routing. */
export function verifyContextBootstrap({
  roots,
  evidence,
  run = runContextCommand,
}: {
  roots: ContextBootstrapRoots
  evidence: NormalizedContextEvidence
  run?: ContextCommandRunner
}): string[] {
  const reasons = [...verifyContextSyncSource({ sourceCwd: roots.sourceCwd, evidence, run })]
  const sourceBranch = output(run('git', ['branch', '--show-current'], { cwd: roots.sourceCwd }))
  if (sourceBranch !== evidence.protectedBase.branch && sourceBranch !== '') {
    reasons.push('EVIDENCE_CONFLICT: protected-main command source must use the live protected branch or a detached exact-live-base checkout')
  }
  const target = roots.targetCwd
  const topLevel = output(run('git', ['rev-parse', '--show-toplevel'], { cwd: target }))
  const head = output(run('git', ['rev-parse', 'HEAD'], { cwd: target }))
  const branch = output(run('git', ['branch', '--show-current'], { cwd: target }))
  const status = output(run('git', ['status', '--short'], { cwd: target }))
  const upstream = output(run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'], { cwd: target }))
  const origin = output(run('git', ['remote', 'get-url', 'origin'], { cwd: target }))
  const upstreamRemote = upstream?.split('/', 1)[0]
  const upstreamRemoteUrl = upstreamRemote
    ? output(run('git', ['remote', 'get-url', upstreamRemote], { cwd: target }))
    : null
  const remoteHeadResult = upstreamRemote && branch
    ? run('git', ['ls-remote', '--heads', upstreamRemote, branch], { cwd: target })
    : null
  const remoteLines = remoteHeadResult?.status === 0 && !remoteHeadResult.error && remoteHeadResult.stdout.trim()
    ? remoteHeadResult.stdout.trim().split(/\r?\n/)
    : []
  const remoteRecords = remoteLines.map((line) => {
    const match = line.match(/^([0-9a-f]{40})\s+(refs\/heads\/[^\s]+)$/i)
    return match ? { sha: match[1]!, ref: match[2]! } : null
  })
  const expectedRemoteRef = `refs/heads/${branch}`
  const remoteHead = remoteRecords.length === 1 && remoteRecords[0]?.ref === expectedRemoteRef
    ? remoteRecords[0].sha
    : null
  if (topLevel !== target) reasons.push('EVIDENCE_CONFLICT: target path is not the canonical root of its Git worktree')
  if (!isFullSha(head) || head.toLowerCase() !== evidence.localGit.head?.toLowerCase()) reasons.push('EVIDENCE_CONFLICT: target HEAD differs from independently collected Context evidence')
  if (!branch || branch !== evidence.localGit.branch || branch === '<detached>') reasons.push('EVIDENCE_CONFLICT: target branch differs from independently collected Context evidence or is detached')
  if (status === null || status !== '') reasons.push('LOCAL_STATE_NOT_DURABLE: target worktree is dirty or unavailable')
  if (!upstream || upstream !== evidence.localGit.upstream || upstream.replace(/^[^/]+\//, '') !== branch) reasons.push('LOCAL_STATE_NOT_DURABLE: target upstream is missing or does not match its branch')
  if (!remoteHead || !isFullSha(head) || remoteHead.toLowerCase() !== head.toLowerCase()) reasons.push('LOCAL_STATE_NOT_DURABLE: target HEAD is not proven pushed to its live upstream')
  if (normalizeOriginRepository(origin) !== evidence.repository.nameWithOwner || normalizeOriginRepository(origin) !== evidence.localGit.originRepository) reasons.push('EVIDENCE_CONFLICT: target origin does not match the canonical repository')
  if (normalizeOriginRepository(upstreamRemoteUrl) !== evidence.repository.nameWithOwner) reasons.push('EVIDENCE_CONFLICT: target upstream remote URL does not match the canonical repository')
  const issueBranch = branch?.match(/^[^/]+\/([1-9]\d*)-[^/]+$/)
  if (!issueBranch || issueBranch[1] !== evidence.issue.number) reasons.push(`EVIDENCE_CONFLICT: target branch is not a numbered topic branch bound to Issue ${evidence.issue.number}`)
  const activePrs = Array.isArray(evidence.activePr) ? evidence.activePr : evidence.activePr ? [evidence.activePr] : []
  if (activePrs.length === 1) {
    const activePr = activePrs[0]!
    if (activePr.headBranch !== branch || activePr.headSha.toLowerCase() !== (head ?? '').toLowerCase()) {
      reasons.push('EVIDENCE_CONFLICT: active PR target branch and head do not match the independently verified target branch and head')
    }
  }

  return [...new Set(reasons)]
}
