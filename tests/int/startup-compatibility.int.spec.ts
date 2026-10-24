import { readFileSync } from 'node:fs'
import { posix, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const packageJSON = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  engines: { node: string; pnpm: string }
}
const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8').replace(/\s+/g, ' ')
const handoff = readFileSync(resolve(root, 'docs/mission-control/execution-handoff-contract.md'), 'utf8')
const normalizedHandoff = handoff.replace(/\s+/g, ' ')
const preparation = normalizedHandoff
  .split('### Pre-Context dependency preparation')[1]
  ?.split('### Bridge B: stale target predates recovery emission')[0] ?? ''
const stopConditions = normalizedHandoff
  .split('## 13. Stop conditions')[1]
  ?.split('## 14. Founder decision status')[0] ?? ''
const issueWorkflow = readFileSync(resolve(root, 'docs/agent-loop/issue-driven-branch-workflow.md'), 'utf8').replace(/\s+/g, ' ')
const storyMatrix = readFileSync(resolve(root, 'docs/agent-loop/context-story-matrix.md'), 'utf8').replace(/\s+/g, ' ')
const p3MatrixStory = storyMatrix
  .split('| Failed setup has exact incident identity')[1]
  ?.split('| Exact P3 incident first receives')[0] ?? ''
const recordedIncidentClause = preparation
  .split('The #562 exception is limited to its preserved evidence in comment 6285952179:')[1]
  ?.split('Arbitrary pnpm failures are excluded.')[0] ?? ''
const p3IncidentClause = preparation
  .split('Only the exact `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` failure,')[1]
  ?.split('Once separately merged §12/§13 authority and fresh exact recovery predicates permit recovery,')[0] ?? ''
const r2Clause = preparation
  .split('2. **R2 — isolated checkout only when R1 cannot prove reuse.**')[1]
  ?.split('No in-place retry of `pnpm install` in the failed checkout is permitted;')[0] ?? ''
const r2SafetyClause = preparation
  .split('The replacement must be clean and empty, with no prior `node_modules` or virtual-store metadata;')[1]
  ?.split('The one exact frozen/ignore-scripts install is permitted in that new checkout only,')[0] ?? ''

const assertRecordedIncidentEvidence = (source: string) => {
  expect(source).toContain(
    'the literal command `pnpm install --frozen-lockfile --ignore-scripts --store-dir /private/tmp/bemoat-web-starter-562-pnpm-store`; Node `24.18.0`; pnpm `10.34.5`; manifest SHA-256 `ddb7a26567c403fd79d412251c57ff86f027e574d56477af53bb994a21f8f227`; and root lock SHA-256 `12c28ec205e322baf2ab838ca69f169685141916abe4fa11e375d70a3070c630`.',
  )
  expect(source).toContain(
    'Recorded pnpm progress was 1,005 resolved; 1,004 packages downloaded and 1,004 packages added before Ctrl-C/SIGINT exit 130.',
  )
  expect(source).toContain(
    'The partial state had about 1,005 virtual-store directories and 2,397 symlinks, with a roughly 1.1 GB store containing 68,159 content files and 1,004 indices; `.modules.yaml` and virtual-store `lock.yaml` were absent.',
  )
}

const assertExit130Denied = (source: string) => {
  expect(source).toContain(
    'Exit 130 alone, a new or unbound SIGINT, or inferred/healthy status from those fingerprints is not eligible.',
  )
}

const assertR2SafetyDenied = (source: string) => {
  expect(source).toContain(
    'Any drift or identity, runtime, command, or store mismatch; dirty, nonempty replacement; missing or uncertain Host write scope; or destructive cleanup requirement is `STOP`.',
  )
}

const expectClauseMutationToFail = (
  source: string,
  assertion: (value: string) => void,
  mutate: (value: string) => string,
) => {
  const mutated = mutate(source)
  expect(mutated).not.toBe(source)
  expect(() => assertion(mutated)).toThrow()
}

describe('Issue #655 pre-Context startup compatibility oracle', () => {
  // Authority: #655 acceptance criterion 1 and Founder-approved P1 require
  // manifest-compatible Node patch versions while retaining CI's own pin and
  // rejecting versions below engines.node or outside the supported major.
  it('accepts an engines-compatible Node patch independently of the CI pin', () => {
    expect(packageJSON.engines.node).toEqual(expect.any(String))
    expect(packageJSON.engines.node.trim()).not.toBe('')
    expect(ci).toMatch(/node-version: 24\.15\.0/)
    expect(preparation).toMatch(/Node version.*satisfies `package\.json`'s `engines\.node`/i)
    expect(preparation).toMatch(/supported Node (?:runtime )?major/i)
    expect(preparation).toMatch(/24\.18\.0.*(?:accepted|compatible)|(?:accepted|compatible).*24\.18\.0/i)
    expect(preparation).toMatch(/below.minimum.*(?:reject|unsupported|STOP)|(?:reject|unsupported|STOP).*below.minimum/i)
    expect(preparation).not.toMatch(/matches the checked.in CI Node version/i)
  })

  // Authority: #655 acceptance criterion 2 and Founder-approved P1 require
  // manifest engines.pnpm, the CI-supported pnpm major, and lockfile format
  // compatibility together; no single version string overrides those checks.
  it('requires pnpm engines, CI-major, and lockfile-format compatibility', () => {
    expect(packageJSON.engines.pnpm).toEqual(expect.any(String))
    expect(packageJSON.engines.pnpm.trim()).not.toBe('')
    expect(ci).toMatch(/version: 10/)
    expect(preparation).toMatch(/pnpm.*`engines\.pnpm`/i)
    expect(preparation).toMatch(/CI.supported pnpm major/i)
    expect(preparation).toMatch(/lockfile format/i)
    expect(preparation).toMatch(/10\.34\.5.*(?:accepted|compatible)|(?:accepted|compatible).*10\.34\.5/i)
    expect(preparation).toMatch(/unsupported pnpm.*(?:fail.closed|STOP)|unsupported lockfile.*(?:fail.closed|STOP)/i)
  })

  // Authority: Founder-approved P1 says reuse is allowed only after the full
  // positive proof. Each listed artifact and resolution predicate is required;
  // missing, stale, partial, divergent, or drifting evidence denies reuse.
  it('permits reuse only with exact identity, lock, store, link, and resolution proof', () => {
    for (const predicate of [
      /canonical repo.*Issue.*branch.*upstream.*live HEAD.*base identity/i,
      /locked manifest.*`pnpm-lock\.yaml` identities/i,
      /root `pnpm-lock\.yaml`.*virtual.store lockfile.*semantically equivalent/i,
      /`node_modules\/.modules\.yaml`.*virtual.store location.*linker.*pnpm metadata/i,
      /resolved actual `storeDir`/i,
      /no switch to a conflicting store/i,
      /symlink.*realpaths.*explicitly approved read.only dependency locations/i,
      /registered CLI entrypoint dependencies.*non.mutating Node module resolution/i,
      /missing.*stale.*partially populated.*divergent.*broken links/i,
      /hash drift|fingerprint drift|store drift/i,
      /reuse denied/i,
    ]) expect(preparation).toMatch(predicate)
    expect(preparation).toMatch(/node_modules existence.*clean `git status`.*lockfile match.*pnpm metadata alone.*(?:not|insufficient)/i)
  })

  // Authority: Founder-approved P2 permits one bounded exact install only for
  // fresh development setup, and forbids changing/reconciling an existing
  // modules tree whose metadata binds another store.
  it('uses one fresh task-local store and never switches or reconciles an existing store', () => {
    expect(preparation).toMatch(/only when the eligible development checkout has no prior `node_modules` or virtual-store metadata/i)
    expect(preparation).toMatch(/initially empty.*uniquely Issue\/checkout.owned.*task.local.*store/i)
    expect(preparation).toMatch(/pnpm install --frozen-lockfile --ignore-scripts --store-dir <task-local-store>/i)
    expect(preparation).toMatch(/existing store.*do not silently select a different `--store-dir`/i)
    expect(preparation).toMatch(/(?:do not|never).*(?:re.home|reconcile|remove|rebuild).*installed tree/i)
    expect(preparation).toMatch(/store selection.*deterministic.*Host write scope/i)
    expect(preparation).toMatch(/non.TTY.*(?:detect|STOP|fail.closed)/i)
  })

  // Authority: Founder-approved P3 requires every incident identity field,
  // exact captured failure, before/after artifact fingerprints, and unique
  // ownership. Missing, stale, or conflicting evidence denies recovery.
  it('binds recovery to the complete exact failed-setup incident', () => {
    for (const binding of [
      /repository ID.*Issue number.*canonical remote topic branch.*exact failed head/i,
      /protected.base identity.*physical checkout absolute path/i,
      /Node\/pnpm identities.*`package\.json`.*root lockfile fingerprints/i,
      /literal attempted install command\/flags and store path/i,
      /failure class\/exit\/stderr/i,
      /before\/after.*`node_modules`.*virtual.store.*pnpm.store.*side.effect fingerprints/i,
      /ownership\/no.concurrent.writer/i,
      /`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`/i,
      /store.mismatch before meaningful install/i,
      /missing\/stale\/conflicting.*recovery.*denied/i,
    ]) expect(preparation).toMatch(binding)
    expect(preparation).toMatch(/arbitrary pnpm failures.*(?:excluded|not eligible|denied)/i)
  })

  // Authority: Founder-approved P3 uniquely orders R1 before R2. R1 allows
  // only read-only reuse then Discovery/Context; R2 preserves the failed
  // checkout and uses one isolated same-Issue checkout. In-place retry is
  // explicitly forbidden; a repeated failure is STOP.
  it('orders read-only R1 before isolated R2 and forbids in-place retry', () => {
    expect(preparation).toMatch(/once separately merged §12\/§13 authority and fresh exact recovery predicates permit recovery, apply the two outcomes in this order and at most once.*R1.*R2/i)
    const r1 = preparation.indexOf('R1')
    const r2 = preparation.indexOf('R2')
    expect(r1).toBeGreaterThanOrEqual(0)
    expect(r2).toBeGreaterThan(r1)
    const recovery = preparation.slice(r1)
    expect(recovery).toMatch(/R1.*read.only reuse.*no installation or write.*registered CLI Discovery.*fresh Context/i)
    expect(recovery).toMatch(/R2.*preserve.*failed physical checkout byte.for.byte/i)
    expect(recovery).toMatch(/new isolated same.Issue checkout.*one existing canonical remote topic branch.*exact live head/i)
    expect(recovery).toMatch(/clean\/empty target `node_modules`.*task.local store/i)
    expect(recovery).toMatch(/new checkout only/i)
    expect(recovery).toMatch(/second failed setup.*STOP/i)
    expect(recovery).toMatch(/no in.place retry|forbidden.*retry `pnpm install` in the failed checkout/i)
    expect(recovery).toMatch(/old `STOP`.*not.*resolved retroactively/i)
  })

  // Authority: #655 Must Not Break preserves Source D and the original STOP /
  // first-edit / Context / HANDOFF order. Founder-approved R2's byte-for-byte
  // source preservation protects the stopped checkout too, including #651's
  // ignored artifacts; this test does not create authority for that old STOP.
  it('preserves no-install, STOP, first-edit, Context, and HANDOFF boundaries', () => {
    expect(normalizedHandoff).toMatch(/Source D.*no.install\/no.`node_modules`/i)
    expect(normalizedHandoff).toMatch(/no unconditional `CI=true`.*`--force`.*`--yes`.*`rm -rf`/i)
    expect(normalizedHandoff).toMatch(/fresh Context.*`COMMAND`.*separately required first.edit trigger/i)
    expect(normalizedHandoff).toMatch(/registered CLI Discovery.*fresh Context/i)
    expect(normalizedHandoff).toMatch(/HANDOFF.*readback.*fresh Context/i)
    expect(issueWorkflow).toMatch(/Source D remains under its existing no.install\/no.`node_modules` contract/i)
    expect(storyMatrix).toMatch(/Source D.*no.install/i)
    expect(storyMatrix).toMatch(/STOP/i)
  })

  // Authority: §12's Founder-approved P3 defines the sole bounded recovery
  // after a setup STOP. §13 must keep ordinary preparation unavailable after
  // Discovery/STOP, admit only a complete fresh incident into ordered R1/R2
  // once, and preserve every fail-closed and no-objective-authority boundary.
  it('limits the post-STOP exception to one complete fresh P3 R1/R2 recovery', () => {
    expect(stopConditions).toMatch(/ordinary pre.Context dependency preparation.*unavailable after Discovery or a fresh `STOP`/i)
    expect(stopConditions).toMatch(/sole post-`STOP` exception for this dependency setup is a complete, fresh, non-conflicting P3 incident record from §12/i)
    expect(stopConditions).toMatch(/That record may enter §12's R1 read-only recheck first; only if R1 cannot prove reuse may it proceed to §12's R2 isolated-checkout recovery, exactly once/i)
    expect(stopConditions).toMatch(/never grants? objective.work authority/i)
    expect(stopConditions).toMatch(/incomplete, stale, or conflicting P3.*every other `STOP`.*second failure.*remain `STOP`/i)
  })

  // Authority: Issue #655 P3 preserves the two original eligible failure
  // classes; Issue #659 adds only its exact recorded #562 incident after the
  // §12/§13 amendment is merged and fresh evidence is proven.
  it('keeps the story matrix P3 failure classes aligned with the canonical exception', () => {
    expect(p3MatrixStory).toMatch(/Only `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` or fully characterized store mismatch before meaningful installation is eligible/i)
    expect(p3MatrixStory).toMatch(/Issue #562 comment 6285952179 is the sole additional failure class, eligible only after merged §12\/§13 policy and fresh exact evidence/i)
  })

  // Authority: Issue #659 criteria 1–4 plus the exact #562 readback
  // (comment 6285952179) permit only one post-merge clean replacement for
  // this recorded exit-130-after-meaningful-install incident. They exclude
  // incomplete identity, drift, competing writers, unsafe targets/cleanup,
  // and replay. This authority does not permit recovery before merge.
  it('permits one exact #562 SIGINT recovery only through a clean replacement checkout', () => {
    expect(p3IncidentClause).toContain('or the single already-recorded Issue #562 incident is eligible for this recovery.')
    // Authority: #562 comment 6285952179 is the sole recorded incident
    // identity. These facts distinguish that event from a generic exit 130
    // or another SIGINT after a meaningful install.
    expect(p3IncidentClause).toContain(
      'The #562 exception is limited to its preserved evidence in comment 6285952179:',
    )
    assertRecordedIncidentEvidence(recordedIncidentClause)
    assertExit130Denied(recordedIncidentClause)
    expect(recordedIncidentClause).toContain(
      'This exception applies only to SIGINT after meaningful installation for the already-recorded #562 incident.',
    )
    expect(p3IncidentClause).toContain(
      'It becomes usable only after this §12/§13 policy is separately merged and a fresh read-only check proves every P3 identity field, no prior replacement/recovery attempt, no drift in the original checkout/store or incident evidence, one canonical Issue branch/upstream at the exact live head and approved base, the exact runtime/manifest/lock/command/store identities, no competing writer, and verified Host capability.',
    )
    expect(p3IncidentClause).toContain(
      'incomplete incident identity remains `STOP`; stale, conflicting, terminal, dirty, unsupported, or changed state remains `STOP`.',
    )

    expect(r2Clause).toContain(
      'Preserve the failed physical checkout byte-for-byte, including ignored setup artifacts.',
    )
    expect(r2Clause).toContain(
      'Acquire at most one new isolated same-Issue checkout (one replacement physical checkout) bound to the one existing canonical remote topic branch and its exact live head.',
    )
    expect(r2Clause).toContain(
      'Prove unique ownership, absence of any competing writer/workspace, and Host capability.',
    )
    expect(r2Clause).toContain(
      'The replacement must be clean and empty, with no prior `node_modules` or virtual-store metadata;',
    )
    assertR2SafetyDenied(r2SafetyClause)
    expect(r2Clause).toContain(
      'A second failed setup or any second replacement attempt is `STOP`; there is no loop.',
    )
    expect(r2Clause).toContain(
      'The one exact frozen/ignore-scripts install is permitted in that new checkout only,',
    )
  })

  // These are in-memory document mutations, not recovery operations. Each
  // mutation must be rejected by the clause-local authority assertion rather
  // than succeeding because an unrelated later STOP remains in preparation.
  it('fails closed when exact #562 evidence or R2 safety predicates are reversed', () => {
    expectClauseMutationToFail(
      recordedIncidentClause,
      assertRecordedIncidentEvidence,
      (source) => source.replace(
        '`.modules.yaml` and virtual-store `lock.yaml` were absent.',
        '`.modules.yaml` and virtual-store `lock.yaml` were present.',
      ),
    )

    for (const [recorded, changed] of [
      ['1,005 virtual-store directories', '1,004 virtual-store directories'],
      ['2,397 symlinks', '2,396 symlinks'],
      ['68,159 content files', '68,158 content files'],
      ['1,004 indices', '1,003 indices'],
    ]) {
      expectClauseMutationToFail(
        recordedIncidentClause,
        assertRecordedIncidentEvidence,
        (source) => source.replace(recorded, changed),
      )
    }

    expectClauseMutationToFail(
      recordedIncidentClause,
      assertExit130Denied,
      (source) => source.replace(
        'Exit 130 alone, a new or unbound SIGINT, or inferred/healthy status from those fingerprints is not eligible.',
        'Exit 130 alone, a new or unbound SIGINT, or inferred/healthy status from those fingerprints is eligible.',
      ),
    )
    expectClauseMutationToFail(
      r2SafetyClause,
      assertR2SafetyDenied,
      (source) => source.replace(
        'missing or uncertain Host write scope; or destructive cleanup requirement is `STOP`.',
        'verified Host write scope; or destructive cleanup requirement is `STOP`.',
      ),
    )
    expectClauseMutationToFail(
      r2SafetyClause,
      assertR2SafetyDenied,
      (source) => source.replace(
        'destructive cleanup requirement is `STOP`.',
        'destructive cleanup requirement is permitted.',
      ),
    )
  })
})


type FixtureIdentity = {
  repository: string
  issue: number
  branch: string
  upstream: string
  approvedBaseSha: string
  headSha: string
  liveRemoteHeadSha: string
  origin: string
  attached: boolean
  durable: boolean
}

type FixtureSymlink = {
  path: string
  realpath: string
  approvedRoot: string
  exists: boolean
  ambiguous: boolean
}

type FixtureStore = {
  path: string
  // Independently modeled resolved identity; this is in-memory evidence, not a filesystem read.
  realpath: string | null
  realpathUnambiguous: boolean
  ownerIssue: number
  ownerCheckout: string
  unique: boolean
  bytesHex: string
  fingerprint: string
  initiallyEmpty: boolean
  insideWriteScope: boolean
}

type FixtureDependencyTree = {
  ownerIssue: number
  ownerCheckout: string
  unique: boolean
  complete: boolean
  manifestSha: string
  installedNextVersion: string
  lockSemanticId: string
  bytesHex: string
  modulesYamlBytesHex: string
  virtualStoreLockBytesHex: string
  virtualStoreLockSemanticId: string
  virtualStorePath: string
  storeDir: string
  storeRealpath: string | null
  linkerCompatible: boolean
  pnpmMetadataCompatible: boolean
  storeFingerprint: string
  artifactFingerprint: string
  cliEntrypointResolved: boolean
  symlinks: FixtureSymlink[]
}

type RecoveryFixture = {
  expectedIdentity: FixtureIdentity
  observedIdentity: FixtureIdentity
  approvedDependencyRoots: string[]
  approvedTaskStoreWriteRoots: string[]
  committed: {
    manifestSha: string
    nextVersion: string
    lockSha: string
    lockSemanticId: string
    upgradeFromVersion: string
    legitimateUpgradeCommitted: boolean
  }
  installedTree: FixtureDependencyTree | null
  originalStore: FixtureStore
  taskLocalStore: FixtureStore
  trackedClean: boolean
  indexClean: boolean
  untrackedClean: boolean
  ignoredInventoryComplete: boolean
  ignoredArtifacts: Array<{
    path: string
    ownerIssue: number
    ownerCheckout: string
    ignored: boolean
    known: boolean
    secret: boolean
  }>
  runtimeAndLockSupported: boolean
  writeScopeProven: boolean
  driftDetected: boolean
  writer: {
    ownershipProven: boolean
    processList: 'available' | 'denied'
    activeCompetingWriters: number | null
    lease: {
      held: boolean
      hostEnforced: boolean
      preventsAllCompetingWriters: boolean
      repository: string
      issue: number
      branch: string
    }
  }
  installResult: 'success' | 'failure' | 'interrupted'
  // Optional independently observed command target; null uses the selected store path.
  actualInstallStorePath: string | null
  postInstallStorePathDrift: string | null
  postInstallStoreRealpathDrift: string | null
  postInstallProofTampered: boolean
  postInstallSymlinkScopeTampered: boolean
  attemptCount: number
  recoveryConsumed: boolean
  installCommands: string[]
  writeCount: number
  p1VerificationCount: number
  quarantinedTree: FixtureDependencyTree | null
  quarantineSnapshot: null | {
    treeSnapshot: FixtureDependencyTree
    storeSnapshot: FixtureStore
  }
  partialNewArtifacts: null | { treeBytesHex: string; storeBytesHex: string }
  lastP1Proof: null | { passed: boolean; failures: string[] }
}

const isWithinApprovedDependencyRoots = (candidatePath: string, approvedRoots: string[]) => {
  const candidate = posix.normalize(candidatePath)
  if (!posix.isAbsolute(candidate)) return false
  return approvedRoots.some((rootPath) => {
    const root = posix.normalize(rootPath)
    if (!posix.isAbsolute(root)) return false
    const boundary = root === '/' ? '/' : `${root}/`
    return candidate === root || candidate.startsWith(boundary)
  })
}

// The raw candidate must be canonical before containment; normalizing traversal
// first would hide the unsafe input that the Host must reject.
const isCanonicalAbsolutePath = (candidate: string) =>
  posix.isAbsolute(candidate)
  && !candidate.split('/').includes('..')
  && posix.normalize(candidate) === candidate

const isWithinPathRoot = (candidate: string, root: string) =>
  candidate === root || candidate.startsWith(`${root === '/' ? '' : root}/`)

const selectedTaskStoreIdentity = (fixture: RecoveryFixture) => {
  const store = fixture.taskLocalStore
  const old = fixture.originalStore
  if (!store.realpath || !old.realpath
    || !store.realpathUnambiguous || !old.realpathUnambiguous
    || !isCanonicalAbsolutePath(store.path) || !isCanonicalAbsolutePath(store.realpath)
    || !isCanonicalAbsolutePath(old.realpath)
    || !fixture.writeScopeProven || !store.insideWriteScope
    || !store.initiallyEmpty || store.bytesHex !== ''
    || !store.unique || store.ownerIssue !== fixture.expectedIdentity.issue
    || store.ownerCheckout !== '/checkout') return null

  const roots = fixture.approvedTaskStoreWriteRoots
  if (roots.length === 0 || !roots.every(isCanonicalAbsolutePath)) return null
  const matchingRoots = roots.filter((root) =>
    store.path !== root && store.realpath !== root
      && isWithinPathRoot(store.path, root)
      && isWithinPathRoot(store.realpath, root))
  if (matchingRoots.length !== 1
    || !isWithinPathRoot(store.path, '/checkout')
    || !isWithinPathRoot(store.realpath, '/checkout')
    || store.realpath === old.realpath
    || store.path === old.path || store.path === old.realpath
    || store.realpath === old.path) return null
  return { path: store.path, realpath: store.realpath }
}

const fixtureIdentity = (): FixtureIdentity => ({
  repository: 'bemoat/bemoat-web-starter',
  issue: 675,
  branch: 'fix/675-preflight-recovery',
  upstream: 'origin/fix/675-preflight-recovery',
  approvedBaseSha: 'd7362350faf61664f08f5e6e0dd6b53869252c99',
  headSha: '0123456789abcdef0123456789abcdef01234567',
  liveRemoteHeadSha: '0123456789abcdef0123456789abcdef01234567',
  origin: 'https://github.com/bemoat/bemoat-web-starter.git',
  attached: true,
  durable: true,
})

const fixtureSymlinks = (): FixtureSymlink[] => [{
  path: '/checkout/node_modules/next',
  realpath: '/checkout/node_modules/.pnpm/next@16.4.2/node_modules/next',
  approvedRoot: '/checkout/node_modules/.pnpm',
  exists: true,
  ambiguous: false,
}]

const createRecoveryFixture = (stale = true): RecoveryFixture => {
  const expectedIdentity = fixtureIdentity()
  const committed = {
    manifestSha: 'sha256:manifest-675-v2',
    nextVersion: '16.4.2',
    lockSha: 'sha256:lock-675-v2',
    lockSemanticId: 'pnpm-lock-semantic-v2',
    upgradeFromVersion: '15.4.11',
    legitimateUpgradeCommitted: true,
  }
  const originalStore: FixtureStore = {
    path: '/checkout/node_modules/.pnpm-store',
    realpath: '/checkout/node_modules/.pnpm-store',
    realpathUnambiguous: true,
    ownerIssue: 675,
    ownerCheckout: '/checkout',
    unique: true,
    bytesHex: '0x73746f72652d6f6c642d6279746573',
    fingerprint: 'sha256:old-store',
    initiallyEmpty: false,
    insideWriteScope: true,
  }
  const installedTree: FixtureDependencyTree = {
    ownerIssue: 675,
    ownerCheckout: '/checkout',
    unique: true,
    complete: true,
    manifestSha: stale ? 'sha256:manifest-675-v1' : committed.manifestSha,
    installedNextVersion: stale ? '15.4.11' : committed.nextVersion,
    lockSemanticId: stale ? 'pnpm-lock-semantic-v1' : committed.lockSemanticId,
    bytesHex: stale ? '0x6e6f64656d6f64756c65732d6f6c642d6279746573' : '0x6e6f64656d6f64756c65732d76322d6279746573',
    modulesYamlBytesHex: stale ? '0x6d6f64756c65732d6f6c64' : '0x6d6f64756c65732d7632',
    virtualStoreLockBytesHex: stale ? '0x6c6f636b2d6f6c64' : '0x6c6f636b2d7632',
    virtualStoreLockSemanticId: stale ? 'pnpm-lock-semantic-v1' : committed.lockSemanticId,
    virtualStorePath: '/checkout/node_modules/.pnpm',
    storeDir: originalStore.path,
    storeRealpath: originalStore.realpath,
    linkerCompatible: true,
    pnpmMetadataCompatible: true,
    storeFingerprint: originalStore.fingerprint,
    artifactFingerprint: stale ? 'sha256:artifacts-v1' : 'sha256:artifacts-v2',
    cliEntrypointResolved: true,
    symlinks: fixtureSymlinks(),
  }
  return {
    expectedIdentity,
    observedIdentity: { ...expectedIdentity },
    approvedDependencyRoots: ['/checkout/node_modules/.pnpm'],
    // Fixed Host-approved scope evidence; it is not constructed from taskLocalStore.path.
    approvedTaskStoreWriteRoots: ['/checkout/.bemoat'],
    committed,
    installedTree,
    originalStore,
    taskLocalStore: {
      path: '/checkout/.bemoat/issue-675-pnpm-store',
      realpath: '/checkout/.bemoat/issue-675-pnpm-store',
      realpathUnambiguous: true,
      ownerIssue: 675,
      ownerCheckout: '/checkout',
      unique: true,
      bytesHex: '',
      fingerprint: '',
      initiallyEmpty: true,
      insideWriteScope: true,
    },
    trackedClean: true,
    indexClean: true,
    untrackedClean: true,
    ignoredInventoryComplete: true,
    ignoredArtifacts: [
      { path: '/checkout/node_modules', ownerIssue: 675, ownerCheckout: '/checkout', ignored: true, known: true, secret: false },
      { path: '/checkout/.bemoat/issue-675-pnpm-store', ownerIssue: 675, ownerCheckout: '/checkout', ignored: true, known: true, secret: false },
    ],
    runtimeAndLockSupported: true,
    writeScopeProven: true,
    driftDetected: false,
    writer: {
      ownershipProven: true,
      processList: 'available',
      activeCompetingWriters: 0,
      lease: {
        held: true,
        hostEnforced: true,
        preventsAllCompetingWriters: true,
        repository: expectedIdentity.repository,
        issue: expectedIdentity.issue,
        branch: expectedIdentity.branch,
      },
    },
    installResult: 'success',
    actualInstallStorePath: null,
    postInstallStorePathDrift: null,
    postInstallStoreRealpathDrift: null,
    postInstallProofTampered: false,
    postInstallSymlinkScopeTampered: false,
    attemptCount: 0,
    recoveryConsumed: false,
    installCommands: [],
    writeCount: 0,
    p1VerificationCount: 0,
    quarantinedTree: null,
    quarantineSnapshot: null,
    partialNewArtifacts: null,
    lastP1Proof: null,
  }
}

const identityMatches = (fixture: RecoveryFixture) => {
  const expected = fixture.expectedIdentity
  const observed = fixture.observedIdentity
  return observed.repository === expected.repository
    && observed.issue === expected.issue
    && observed.branch === expected.branch
    && observed.upstream === expected.upstream
    && observed.approvedBaseSha === expected.approvedBaseSha
    && observed.headSha === expected.headSha
    && observed.liveRemoteHeadSha === expected.headSha
    && observed.origin === expected.origin
    && observed.attached
    && observed.durable
}

const writerExclusionProven = (fixture: RecoveryFixture) => {
  const writer = fixture.writer
  if (!writer.ownershipProven) return false
  if (writer.processList === 'available') {
    return writer.activeCompetingWriters === 0
  }
  return writer.lease.held
    && writer.lease.hostEnforced
    && writer.lease.preventsAllCompetingWriters
    && writer.lease.repository === fixture.expectedIdentity.repository
    && writer.lease.issue === fixture.expectedIdentity.issue
    && writer.lease.branch === fixture.expectedIdentity.branch
}

const safeDependencyInputs = (fixture: RecoveryFixture) => {
  const tree = fixture.installedTree
  if (!identityMatches(fixture)) return false
  if (!fixture.trackedClean || !fixture.indexClean || !fixture.untrackedClean) return false
  if (!fixture.ignoredInventoryComplete || fixture.ignoredArtifacts.length === 0) return false
  if (new Set(fixture.ignoredArtifacts.map((artifact) => artifact.path)).size !== fixture.ignoredArtifacts.length) return false
  if (!fixture.ignoredArtifacts.every((artifact) =>
    artifact.ignored && artifact.known && !artifact.secret
      && artifact.ownerIssue === fixture.expectedIdentity.issue
      && artifact.ownerCheckout === '/checkout'
      && artifact.path.startsWith('/checkout/'))) return false
  if (!fixture.runtimeAndLockSupported || !fixture.writeScopeProven || fixture.driftDetected) return false
  if (tree && (!tree.complete || !tree.unique || tree.ownerIssue !== fixture.expectedIdentity.issue
    || tree.ownerCheckout !== '/checkout')) return false
  if (!fixture.originalStore.unique
    || fixture.originalStore.ownerIssue !== fixture.expectedIdentity.issue
    || fixture.originalStore.ownerCheckout !== '/checkout'
    || !fixture.originalStore.realpath || !fixture.originalStore.realpathUnambiguous
    || !isCanonicalAbsolutePath(fixture.originalStore.path)
    || !isCanonicalAbsolutePath(fixture.originalStore.realpath)
    || !isWithinPathRoot(fixture.originalStore.path, '/checkout')
    || !isWithinPathRoot(fixture.originalStore.realpath, '/checkout')) return false
  if (tree && !tree.symlinks.every((link) =>
    link.exists && !link.ambiguous
      && isWithinApprovedDependencyRoots(link.realpath, fixture.approvedDependencyRoots))) return false
  if (!writerExclusionProven(fixture)) return false
  return true
}

const verifyP1InMemory = (
  fixture: RecoveryFixture,
  tree: FixtureDependencyTree,
  store: FixtureStore,
  expectedStoreIdentity = { path: store.path, realpath: store.realpath },
) => {
  fixture.p1VerificationCount += 1
  const failures: string[] = []
  if (tree.manifestSha !== fixture.committed.manifestSha) failures.push('manifest-mismatch')
  if (tree.lockSemanticId !== fixture.committed.lockSemanticId) failures.push('root-lock-mismatch')
  if (tree.virtualStoreLockSemanticId !== fixture.committed.lockSemanticId) failures.push('virtual-store-lock-mismatch')
  if (tree.installedNextVersion !== fixture.committed.nextVersion) failures.push('dependency-version-mismatch')
  if (!tree.linkerCompatible || !tree.pnpmMetadataCompatible) failures.push('incompatible-module-metadata')
  if (tree.virtualStorePath !== '/checkout/node_modules/.pnpm') failures.push('virtual-store-path-mismatch')
  if (store.path !== expectedStoreIdentity.path || tree.storeDir !== expectedStoreIdentity.path) failures.push('store-path-mismatch')
  if (!expectedStoreIdentity.realpath || !store.realpathUnambiguous
    || store.realpath !== expectedStoreIdentity.realpath
    || tree.storeRealpath !== expectedStoreIdentity.realpath) failures.push('store-realpath-mismatch')
  if (!store.unique || store.ownerIssue !== fixture.expectedIdentity.issue
    || store.ownerCheckout !== '/checkout') failures.push('ambiguous-store-ownership')
  if (!store.bytesHex || !store.fingerprint || tree.storeFingerprint !== store.fingerprint) failures.push('store-fingerprint-mismatch')
  if (tree.artifactFingerprint !== `sha256:artifacts-v2`) failures.push('artifact-fingerprint-mismatch')
  if (!tree.complete || !tree.cliEntrypointResolved) failures.push('required-artifact-or-cli-resolution-failed')
  if (!tree.symlinks.every((link) =>
    link.exists && !link.ambiguous
      && isWithinApprovedDependencyRoots(link.realpath, fixture.approvedDependencyRoots))) failures.push('symlink-proof-failed')
  return { passed: failures.length === 0, failures }
}

const quarantinePreservedByteForByte = (fixture: RecoveryFixture) => {
  const snapshot = fixture.quarantineSnapshot
  const tree = fixture.quarantinedTree
  return Boolean(snapshot && tree
    && JSON.stringify(snapshot.treeSnapshot) === JSON.stringify(tree)
    && JSON.stringify(snapshot.storeSnapshot) === JSON.stringify(fixture.originalStore))
}

const stopFixture = (reason: string, fixture: RecoveryFixture) => ({
  outcome: 'STOP' as const,
  reason,
  next: 'STOP' as const,
  setupEmitsCommand: false,
  writes: fixture.writeCount,
  attempts: fixture.attemptCount,
})

const runDependencyTransition = (fixture: RecoveryFixture) => {
  // Identity, clean state, provenance, dependency ownership, and writer gates
  // precede P1. A matching tree in the wrong checkout is never reusable.
  if (!identityMatches(fixture)) return stopFixture('IDENTITY_MISMATCH', fixture)
  if (!safeDependencyInputs(fixture)) return stopFixture('PREPARATION_GATE_FAILED', fixture)
  if (fixture.recoveryConsumed || fixture.attemptCount !== 0) return stopFixture('RECOVERY_ALREADY_USED', fixture)

  const oldTree = fixture.installedTree
  if (!oldTree) return stopFixture('DEPENDENCY_TREE_MISSING', fixture)
  const oldP1 = verifyP1InMemory(fixture, oldTree, fixture.originalStore)
  if (oldP1.passed) {
    return {
      outcome: 'P1_REUSE' as const,
      reason: 'EXACT_P1_PROOF',
      next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT' as const,
      setupEmitsCommand: false,
      writes: 0,
      attempts: 0,
    }
  }

  const staleMismatchKinds = new Set<string>([
    'manifest-mismatch',
    'root-lock-mismatch',
    'virtual-store-lock-mismatch',
    'dependency-version-mismatch',
    'artifact-fingerprint-mismatch',
  ])
  const staleOnlyForCommittedUpgrade = fixture.committed.legitimateUpgradeCommitted
    && fixture.committed.upgradeFromVersion === oldTree.installedNextVersion
    && oldTree.manifestSha !== fixture.committed.manifestSha
    && oldTree.lockSemanticId !== fixture.committed.lockSemanticId
    && oldP1.failures.length > 0
    && oldP1.failures.every((failure) => staleMismatchKinds.has(failure))
  const taskStoreIdentity = selectedTaskStoreIdentity(fixture)
  if (!staleOnlyForCommittedUpgrade || !taskStoreIdentity) {
    return stopFixture('NOT_EXACT_STALE_UPGRADE_OR_UNSAFE_TASK_STORE', fixture)
  }
  // Compare separately modeled actual command evidence before quarantine or any write.
  if (fixture.actualInstallStorePath !== null
    && fixture.actualInstallStorePath !== taskStoreIdentity.path) {
    return stopFixture('INSTALL_TARGET_MISMATCH', fixture)
  }

  fixture.quarantinedTree = oldTree
  fixture.quarantineSnapshot = {
    treeSnapshot: { ...oldTree, symlinks: oldTree.symlinks.map((link) => ({ ...link })) },
    storeSnapshot: { ...fixture.originalStore },
  }
  fixture.installedTree = null
  fixture.recoveryConsumed = true
  fixture.attemptCount += 1
  fixture.writeCount += 1
  const installCommand = `pnpm install --frozen-lockfile --ignore-scripts --store-dir ${taskStoreIdentity.path}`
  fixture.installCommands.push(installCommand)
  fixture.writeCount += 1

  if (fixture.installResult !== 'success') {
    fixture.partialNewArtifacts = {
      treeBytesHex: '0x7061727469616c2d696e7374616c6c',
      storeBytesHex: '0x7061727469616c2d73746f7265',
    }
    fixture.taskLocalStore.bytesHex = fixture.partialNewArtifacts.storeBytesHex
    return stopFixture(fixture.installResult === 'interrupted' ? 'INSTALL_INTERRUPTED' : 'INSTALL_FAILED', fixture)
  }

  fixture.taskLocalStore.bytesHex = '0x66726573682d7461736b2d73746f7265'
  fixture.taskLocalStore.fingerprint = 'sha256:fresh-task-store'
  fixture.taskLocalStore.initiallyEmpty = false
  if (fixture.postInstallStorePathDrift) fixture.taskLocalStore.path = fixture.postInstallStorePathDrift
  if (fixture.postInstallStoreRealpathDrift) fixture.taskLocalStore.realpath = fixture.postInstallStoreRealpathDrift
  const installedTree: FixtureDependencyTree = {
    ownerIssue: 675,
    ownerCheckout: '/checkout',
    unique: true,
    complete: true,
    manifestSha: fixture.committed.manifestSha,
    installedNextVersion: fixture.committed.nextVersion,
    lockSemanticId: fixture.committed.lockSemanticId,
    bytesHex: '0x6e65772d646570656e64656e63792d74726565',
    modulesYamlBytesHex: '0x6d6f64756c65732d7632',
    virtualStoreLockBytesHex: '0x6c6f636b2d7632',
    virtualStoreLockSemanticId: fixture.committed.lockSemanticId,
    virtualStorePath: '/checkout/node_modules/.pnpm',
    storeDir: fixture.taskLocalStore.path,
    storeRealpath: fixture.taskLocalStore.realpath,
    linkerCompatible: true,
    pnpmMetadataCompatible: true,
    storeFingerprint: fixture.taskLocalStore.fingerprint,
    artifactFingerprint: 'sha256:artifacts-v2',
    cliEntrypointResolved: !fixture.postInstallProofTampered,
    symlinks: fixtureSymlinks(),
  }
  if (fixture.postInstallSymlinkScopeTampered) {
    installedTree.symlinks[0].realpath = '/outside/store/next'
    installedTree.symlinks[0].approvedRoot = '/outside/store'
  }
  fixture.installedTree = installedTree
  const postInstallProof = verifyP1InMemory(fixture, installedTree, fixture.taskLocalStore, taskStoreIdentity)
  fixture.lastP1Proof = postInstallProof
  if (!postInstallProof.passed || !quarantinePreservedByteForByte(fixture)) {
    return stopFixture('POST_INSTALL_P1_OR_PRESERVATION_PROOF_FAILED', fixture)
  }

  return {
    outcome: 'SETUP_COMPLETE' as const,
    reason: 'ONE_STALE_TREE_RECOVERY_PROVED',
    next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT' as const,
    setupEmitsCommand: false,
    writes: fixture.writeCount,
    attempts: fixture.attemptCount,
  }
}

describe('Issue #675 one-shot stale installed-dependency recovery stories', () => {
  const recoveryAuthority = preparation
    .split('**One-shot stale installed-dependency recovery — Issue #675.')[1]
    ?.split('No in-place retry of `pnpm install` in the failed checkout is permitted;')[0] ?? ''

  // Authority: §12 P1 permits only positive read-only proof after exact
  // repository/Issue/branch/base/head, clean-state, artifact-provenance,
  // ownership, and writer gates. A matching tree cannot bypass identity.
  it.each([
    ['repository', (f: RecoveryFixture) => { f.observedIdentity.repository = 'bemoat/other' }],
    ['Issue', (f: RecoveryFixture) => { f.observedIdentity.issue = 674 }],
    ['branch', (f: RecoveryFixture) => { f.observedIdentity.branch = 'fix/other' }],
    ['upstream', (f: RecoveryFixture) => { f.observedIdentity.upstream = 'origin/fix/other' }],
    ['approved base', (f: RecoveryFixture) => { f.observedIdentity.approvedBaseSha = 'ffffffffffffffffffffffffffffffffffffffff' }],
    ['head', (f: RecoveryFixture) => { f.observedIdentity.headSha = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }],
    ['live remote head', (f: RecoveryFixture) => { f.observedIdentity.liveRemoteHeadSha = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }],
    ['origin', (f: RecoveryFixture) => { f.observedIdentity.origin = 'https://github.com/other/repo.git' }],
    ['detached checkout', (f: RecoveryFixture) => { f.observedIdentity.attached = false }],
    ['non-durable branch', (f: RecoveryFixture) => { f.observedIdentity.durable = false }],
  ] as const)('checks exact %s identity before permitting matching dependencies through P1', (_name, corruptIdentity) => {
    const fixture = createRecoveryFixture(false)
    corruptIdentity(fixture)

    const result = runDependencyTransition(fixture)

    expect(result).toMatchObject({
      outcome: 'STOP',
      reason: 'IDENTITY_MISMATCH',
      writes: 0,
      attempts: 0,
    })
    expect(fixture.p1VerificationCount).toBe(0)
    expect(fixture.installCommands).toEqual([])
  })

  // Authority: §12 P1 is read-only reuse only after every positive artifact
  // and identity proof succeeds. It performs no install or setup write.
  it('uses P1 for exact matching dependencies with exact identity and no writes', () => {
    const fixture = createRecoveryFixture(false)

    const result = runDependencyTransition(fixture)

    expect(result).toMatchObject({
      outcome: 'P1_REUSE',
      next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT',
      setupEmitsCommand: false,
      writes: 0,
      attempts: 0,
    })
    expect(fixture.installCommands).toEqual([])
    expect(fixture.p1VerificationCount).toBe(1)
  })

  // Authority: #675 permits only the proven stale committed-lock upgrade
  // class. The old installed tree and bound store remain byte-for-byte
  // preserved; one frozen install must pass independent P1-equivalent proof.
  it('quarantines the stale tree, installs once into a fresh task store, and routes only after P1-equivalent proof', () => {
    const fixture = createRecoveryFixture(true)
    const oldTree = fixture.installedTree
    const oldTreeBytes = oldTree?.bytesHex
    const oldModulesBytes = oldTree?.modulesYamlBytesHex
    const oldVirtualLockBytes = oldTree?.virtualStoreLockBytesHex
    const oldStoreBytes = fixture.originalStore.bytesHex
    const oldStoreFingerprint = fixture.originalStore.fingerprint

    const result = runDependencyTransition(fixture)

    expect(result).toMatchObject({
      outcome: 'SETUP_COMPLETE',
      next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT',
      setupEmitsCommand: false,
      attempts: 1,
    })
    expect(fixture.installCommands).toEqual([
      'pnpm install --frozen-lockfile --ignore-scripts --store-dir /checkout/.bemoat/issue-675-pnpm-store',
    ])
    expect(fixture.quarantinedTree?.bytesHex).toBe(oldTreeBytes)
    expect(fixture.quarantinedTree?.modulesYamlBytesHex).toBe(oldModulesBytes)
    expect(fixture.quarantinedTree?.virtualStoreLockBytesHex).toBe(oldVirtualLockBytes)
    expect(fixture.originalStore.bytesHex).toBe(oldStoreBytes)
    expect(fixture.originalStore.fingerprint).toBe(oldStoreFingerprint)
    expect(quarantinePreservedByteForByte(fixture)).toBe(true)
    expect(fixture.taskLocalStore.bytesHex).not.toBe('')
    expect(fixture.lastP1Proof).toEqual({ passed: true, failures: [] })
    expect(fixture.p1VerificationCount).toBe(2)
  })

  // Authority: §12 one-shot #675 requires the single frozen install and
  // independent P1 proof to use the separately validated task-store identity.
  // This is a deterministic in-memory fixture; no live filesystem is inspected.
  it('binds an alternate approved Issue-owned task store through command and post-install P1 proof', () => {
    const fixture = createRecoveryFixture(true)
    const alternate = '/checkout/.bemoat/issue-675-alternate-pnpm-store'
    fixture.taskLocalStore.path = alternate
    fixture.taskLocalStore.realpath = alternate
    fixture.ignoredArtifacts[1].path = alternate

    const result = runDependencyTransition(fixture)

    expect(result).toMatchObject({
      outcome: 'SETUP_COMPLETE',
      next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT',
      setupEmitsCommand: false,
      attempts: 1,
    })
    expect(fixture.installCommands).toEqual([
      'pnpm install --frozen-lockfile --ignore-scripts --store-dir /checkout/.bemoat/issue-675-alternate-pnpm-store',
    ])
    expect(fixture.installedTree?.storeDir).toBe(alternate)
    expect(fixture.installedTree?.storeRealpath).toBe(alternate)
    expect(fixture.lastP1Proof).toEqual({ passed: true, failures: [] })
    expect(quarantinePreservedByteForByte(fixture)).toBe(true)
  })

  // Authority: §12 and Founder comment 6386356029 require lexical traversal,
  // canonical-boundary, realpath, scope, ownership, and old-store identity
  // rejection before quarantine or install. Each case reaches task-store
  // selection after the old tree's stale-lock P1 denial.
  it.each([
    ['parent traversal', (f: RecoveryFixture) => { f.taskLocalStore.path = '/checkout/../shared/store' }],
    ['nested parent traversal', (f: RecoveryFixture) => { f.taskLocalStore.path = '/checkout/.bemoat/../shared/store' }],
    ['sibling-prefix escape', (f: RecoveryFixture) => {
      f.taskLocalStore.path = '/checkout2/store'
      f.taskLocalStore.realpath = '/checkout2/store'
    }],
    ['realpath escape', (f: RecoveryFixture) => { f.taskLocalStore.realpath = '/outside/store' }],
    ['unknown realpath', (f: RecoveryFixture) => { f.taskLocalStore.realpath = null }],
    ['ambiguous realpath', (f: RecoveryFixture) => { f.taskLocalStore.realpathUnambiguous = false }],
    ['unknown approved write scope', (f: RecoveryFixture) => { f.approvedTaskStoreWriteRoots = [] }],
    ['ambiguous approved write scope', (f: RecoveryFixture) => {
      f.approvedTaskStoreWriteRoots = ['/checkout/.bemoat', '/checkout']
    }],
    ['unowned task store', (f: RecoveryFixture) => { f.taskLocalStore.ownerIssue = 674 }],
    ['old-store canonical alias', (f: RecoveryFixture) => {
      f.originalStore.realpath = '/checkout/.bemoat/issue-675-pnpm-store'
      f.installedTree!.storeRealpath = f.originalStore.realpath
    }],
  ] as const)('stops before any write for %s', (_name, corruptStore) => {
    const fixture = createRecoveryFixture(true)
    const oldTreeBytes = fixture.installedTree?.bytesHex
    const oldStoreBytes = fixture.originalStore.bytesHex
    corruptStore(fixture)

    const result = runDependencyTransition(fixture)

    expect(result).toMatchObject({ outcome: 'STOP', writes: 0, attempts: 0 })
    expect(fixture.p1VerificationCount).toBe(1)
    expect(fixture.quarantineSnapshot).toBeNull()
    expect(fixture.installCommands).toEqual([])
    expect(fixture.installedTree?.bytesHex).toBe(oldTreeBytes)
    expect(fixture.originalStore.bytesHex).toBe(oldStoreBytes)
  })

  // Authority: §12 permits no setup write when the proposed command target
  // differs from the validated task store, even if both paths are in scope.
  it('stops before quarantine when the independently modeled command target differs', () => {
    const fixture = createRecoveryFixture(true)
    fixture.actualInstallStorePath = '/checkout/.bemoat/issue-675-other-pnpm-store'
    const oldTreeBytes = fixture.installedTree?.bytesHex
    const oldStoreBytes = fixture.originalStore.bytesHex

    const result = runDependencyTransition(fixture)

    expect(result).toMatchObject({
      outcome: 'STOP',
      reason: 'INSTALL_TARGET_MISMATCH',
      writes: 0,
      attempts: 0,
    })
    expect(fixture.p1VerificationCount).toBe(1)
    expect(fixture.quarantineSnapshot).toBeNull()
    expect(fixture.installCommands).toEqual([])
    expect(fixture.installedTree?.bytesHex).toBe(oldTreeBytes)
    expect(fixture.originalStore.bytesHex).toBe(oldStoreBytes)
  })

  // Authority: §12 makes any post-install store identity drift terminal. The
  // P1-equivalent check must compare against the pre-write validated identity.
  it.each([
    ['path', (f: RecoveryFixture) => {
      f.postInstallStorePathDrift = '/checkout/.bemoat/issue-675-drifted-store'
    }, 'store-path-mismatch'],
    ['realpath', (f: RecoveryFixture) => {
      f.postInstallStoreRealpathDrift = '/checkout/.bemoat/issue-675-drifted-store'
    }, 'store-realpath-mismatch'],
  ] as const)('stops terminally on post-install store %s drift', (_name, tamper, expectedFailure) => {
    const fixture = createRecoveryFixture(true)
    const oldTreeBytes = fixture.installedTree?.bytesHex
    const oldStoreBytes = fixture.originalStore.bytesHex
    tamper(fixture)

    const first = runDependencyTransition(fixture)

    expect(first).toMatchObject({
      outcome: 'STOP',
      reason: 'POST_INSTALL_P1_OR_PRESERVATION_PROOF_FAILED',
      attempts: 1,
      setupEmitsCommand: false,
    })
    expect(fixture.lastP1Proof?.failures).toContain(expectedFailure)
    expect(fixture.p1VerificationCount).toBe(2)
    expect(fixture.quarantinedTree?.bytesHex).toBe(oldTreeBytes)
    expect(fixture.originalStore.bytesHex).toBe(oldStoreBytes)
    expect(quarantinePreservedByteForByte(fixture)).toBe(true)
    const writesAfterFirst = fixture.writeCount
    expect(runDependencyTransition(fixture)).toMatchObject({ outcome: 'STOP', reason: 'RECOVERY_ALREADY_USED' })
    expect(fixture.attemptCount).toBe(1)
    expect(fixture.writeCount).toBe(writesAfterFirst)
    expect(fixture.installCommands).toHaveLength(1)
  })

  // Authority: §12 fails closed before mutation for dirty state, uncertain
  // provenance, unowned stores/links, unsupported runtime, drift, or missing
  // writer enforcement. Each story preserves all original in-memory bytes.
  it('stops before mutation for dirty, unknown, ambiguous, drifting, or competing-writer evidence', () => {
    const cases: Array<[string, (fixture: RecoveryFixture) => void]> = [
      ['tracked dirty', (f) => { f.trackedClean = false }],
      ['index dirty', (f) => { f.indexClean = false }],
      ['untracked dirty', (f) => { f.untrackedClean = false }],
      ['unknown ignored artifact', (f) => { f.ignoredArtifacts[0].known = false }],
      ['secret ignored artifact', (f) => { f.ignoredArtifacts[0].secret = true }],
      ['incomplete ignored inventory', (f) => { f.ignoredInventoryComplete = false }],
      ['ambiguous symlink', (f) => { f.installedTree!.symlinks[0].ambiguous = true }],
      ['escaping symlink realpath', (f) => { f.installedTree!.symlinks[0].realpath = '/outside/store/next' }],
      ['forged realpath and descriptive approved root', (f) => {
        f.installedTree!.symlinks[0].realpath = '/outside/store/next'
        f.installedTree!.symlinks[0].approvedRoot = '/outside/store'
      }],
      ['normalized sibling-prefix escape', (f) => {
        f.installedTree!.symlinks[0].realpath = '/checkout/node_modules/.pnpm/../.pnpm-escape/next'
        f.installedTree!.symlinks[0].approvedRoot = '/checkout/node_modules/.pnpm-escape'
      }],
      ['ambiguous original store', (f) => { f.originalStore.unique = false }],
      ['task store already populated', (f) => { f.taskLocalStore.bytesHex = '0xexisting' }],
      ['task store not unique', (f) => { f.taskLocalStore.unique = false }],
      ['task store outside write scope', (f) => { f.taskLocalStore.insideWriteScope = false }],
      ['task store outside checkout', (f) => { f.taskLocalStore.path = '/shared/task-store' }],
      ['active competing writer', (f) => { f.writer.activeCompetingWriters = 1 }],
      ['unproven writer owner', (f) => { f.writer.ownershipProven = false }],
      ['process list denied without lease', (f) => { f.writer.processList = 'denied'; f.writer.lease.hostEnforced = false }],
      ['lease not held', (f) => { f.writer.processList = 'denied'; f.writer.lease.held = false }],
      ['lease does not block other writers', (f) => { f.writer.processList = 'denied'; f.writer.lease.preventsAllCompetingWriters = false }],
      ['lease bound to another repository', (f) => { f.writer.processList = 'denied'; f.writer.lease.repository = 'bemoat/other' }],
      ['lease bound to another branch', (f) => { f.writer.processList = 'denied'; f.writer.lease.branch = 'fix/other' }],
      ['runtime or lock unsupported', (f) => { f.runtimeAndLockSupported = false }],
      ['write scope unknown', (f) => { f.writeScopeProven = false }],
      ['evidence drift', (f) => { f.driftDetected = true }],
    ]

    for (const [name, mutate] of cases) {
      const fixture = createRecoveryFixture(true)
      const oldTreeBytes = fixture.installedTree?.bytesHex
      const oldStoreBytes = fixture.originalStore.bytesHex
      mutate(fixture)

      const result = runDependencyTransition(fixture)

      expect(result, name).toMatchObject({ outcome: 'STOP', writes: 0, attempts: 0 })
      expect(fixture.installedTree?.bytesHex).toBe(oldTreeBytes)
      expect(fixture.originalStore.bytesHex).toBe(oldStoreBytes)
      expect(fixture.quarantineSnapshot).toBeNull()
      expect(fixture.installCommands).toEqual([])
    }
  })

  // Authority: recovery applies only to the exact authorized committed
  // upgrade. P1 denial for another cause does not select a fallback outcome.
  it('stops without installation when P1 failure is not solely the committed stale-lock upgrade', () => {
    const fixture = createRecoveryFixture(true)
    fixture.committed.legitimateUpgradeCommitted = false

    const result = runDependencyTransition(fixture)

    expect(result).toMatchObject({ outcome: 'STOP', writes: 0, attempts: 0 })
    expect(fixture.installCommands).toEqual([])
  })

  it('rejects forged symlink roots before P1 or recovery writes', () => {
    const fixture = createRecoveryFixture(true)
    const symlink = fixture.installedTree!.symlinks[0]
    symlink.realpath = '/outside/store/next'
    symlink.approvedRoot = '/outside/store'
    const oldTreeBytes = fixture.installedTree?.bytesHex
    const oldStoreBytes = fixture.originalStore.bytesHex

    const result = runDependencyTransition(fixture)

    expect(result).toMatchObject({ outcome: 'STOP', writes: 0, attempts: 0 })
    expect(fixture.p1VerificationCount).toBe(0)
    expect(fixture.installCommands).toEqual([])
    expect(fixture.installedTree?.bytesHex).toBe(oldTreeBytes)
    expect(fixture.originalStore.bytesHex).toBe(oldStoreBytes)
  })

  // Authority: §12 makes recovery terminal after one attempt. Install failure,
  // interruption, post-install proof failure, or replay cannot start again;
  // the quarantined original tree and old store remain byte-for-byte intact.
  it.each([
    ['failed install', 'failure', false, 'INSTALL_FAILED'],
    ['interrupted install', 'interrupted', false, 'INSTALL_INTERRUPTED'],
    ['failed post-install proof', 'success', true, 'POST_INSTALL_P1_OR_PRESERVATION_PROOF_FAILED'],
  ] as const)('%s is terminal and preserves the original artifacts', (_name, installResult, tamperedProof, expectedReason) => {
    const fixture = createRecoveryFixture(true)
    fixture.installResult = installResult
    fixture.postInstallProofTampered = tamperedProof
    const oldTreeBytes = fixture.installedTree?.bytesHex
    const oldStoreBytes = fixture.originalStore.bytesHex

    const first = runDependencyTransition(fixture)

    expect(first).toMatchObject({ outcome: 'STOP', reason: expectedReason, attempts: 1 })
    expect(quarantinePreservedByteForByte(fixture)).toBe(true)
    expect(fixture.quarantinedTree?.bytesHex).toBe(oldTreeBytes)
    expect(fixture.originalStore.bytesHex).toBe(oldStoreBytes)
    const attemptsAfterFirst = fixture.attemptCount
    const writesAfterFirst = fixture.writeCount

    const replay = runDependencyTransition(fixture)

    expect(replay).toMatchObject({ outcome: 'STOP', reason: 'RECOVERY_ALREADY_USED' })
    expect(fixture.attemptCount).toBe(attemptsAfterFirst)
    expect(fixture.writeCount).toBe(writesAfterFirst)
    expect(fixture.installCommands).toHaveLength(1)
  })

  it('rejects a forged post-install symlink scope during independent P1 proof', () => {
    const fixture = createRecoveryFixture(true)
    fixture.postInstallSymlinkScopeTampered = true
    const oldTreeBytes = fixture.installedTree?.bytesHex
    const oldStoreBytes = fixture.originalStore.bytesHex

    const first = runDependencyTransition(fixture)

    expect(first).toMatchObject({
      outcome: 'STOP',
      reason: 'POST_INSTALL_P1_OR_PRESERVATION_PROOF_FAILED',
      attempts: 1,
      setupEmitsCommand: false,
    })
    expect(fixture.lastP1Proof?.failures).toContain('symlink-proof-failed')
    expect(fixture.p1VerificationCount).toBe(2)
    expect(quarantinePreservedByteForByte(fixture)).toBe(true)
    expect(fixture.quarantinedTree?.bytesHex).toBe(oldTreeBytes)
    expect(fixture.originalStore.bytesHex).toBe(oldStoreBytes)

    const attemptsAfterFirst = fixture.attemptCount
    const replay = runDependencyTransition(fixture)

    expect(replay.outcome).toBe('STOP')
    expect(fixture.attemptCount).toBe(attemptsAfterFirst)
    expect(fixture.installCommands).toHaveLength(1)
  })

  // Authority: §12 requires a real Host-enforced exclusive lease when process
  // enumeration is denied; advisory state cannot admit recovery.
  it('allows denied process listing only with a scoped enforced lease', () => {
    const blocked = createRecoveryFixture(true)
    blocked.writer.processList = 'denied'
    blocked.writer.lease.hostEnforced = false
    expect(runDependencyTransition(blocked)).toMatchObject({ outcome: 'STOP', writes: 0, attempts: 0 })

    const enforced = createRecoveryFixture(true)
    enforced.writer.processList = 'denied'
    expect(runDependencyTransition(enforced)).toMatchObject({
      outcome: 'SETUP_COMPLETE',
      attempts: 1,
      setupEmitsCommand: false,
    })
  })

  // Supplemental policy guard. Behavioral transition assertions above are the
  // primary oracle; these checks retain the exact §12 command and route terms.
  it('keeps setup-only command and route wording aligned with §12', () => {
    expect(recoveryAuthority).toMatch(/same-Issue.*exact live head.*approved-base/i)
    expect(recoveryAuthority).toMatch(/quarantine.*preserve.*byte-for-byte/i)
    expect(recoveryAuthority).toMatch(/one exact frozen\/ignore-scripts install/i)
    expect(recoveryAuthority).toMatch(/P1-equivalent.*proof/i)
    expect(recoveryAuthority).toMatch(/registered CLI Discovery.*fresh Context/i)
    expect(recoveryAuthority).toMatch(/never.*COMMAND|no COMMAND/i)
  })
})
