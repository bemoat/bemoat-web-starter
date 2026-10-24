import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

type StaleDependencyEvidence = {
  repositoryIssueBranchBaseHeadExact: boolean
  supportedRuntimeAndLock: boolean
  trackedAndUntrackedClean: boolean
  ignoredArtifactsKnownAndNonSecret: boolean
  staleInstalledTreeAgainstCommittedLock: boolean
  installedArtifactsCompleteAndFingerprinted: boolean
  p1DependenciesValid: boolean
  existingStoreUniqueAndBounded: boolean
  dependencyRootsHaveNoAmbiguousSymlinks: boolean
  writerOwnershipProven: boolean
  processListDenied: boolean
  enforceableExclusiveLease: boolean
  noCompetingWriter: boolean
  hostWriteScopeProven: boolean
  noDriftSinceEvidenceCapture: boolean
  noPriorRecoveryAttempt: boolean
  quarantinePreservesOriginalTreeAndStore: boolean
  installSucceeded: boolean
  installInterrupted: boolean
  p1EquivalentPostInstallProof: boolean
}

const decideStaleDependencySetup = (evidence: StaleDependencyEvidence) => {
  if (evidence.p1DependenciesValid) {
    return {
      outcome: 'P1_REUSE',
      next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT',
      writes: 0,
      setupEmitsCommand: false,
    } as const
  }

  const writerExclusion = evidence.writerOwnershipProven
    && evidence.noCompetingWriter
    && (!evidence.processListDenied || evidence.enforceableExclusiveLease)

  const eligible = evidence.repositoryIssueBranchBaseHeadExact
    && evidence.supportedRuntimeAndLock
    && evidence.trackedAndUntrackedClean
    && evidence.ignoredArtifactsKnownAndNonSecret
    && evidence.staleInstalledTreeAgainstCommittedLock
    && evidence.existingStoreUniqueAndBounded
    && evidence.dependencyRootsHaveNoAmbiguousSymlinks
    && writerExclusion
    && evidence.hostWriteScopeProven
    && evidence.noDriftSinceEvidenceCapture
    && evidence.noPriorRecoveryAttempt
    && evidence.quarantinePreservesOriginalTreeAndStore

  if (!eligible || !evidence.installSucceeded || evidence.installInterrupted || !evidence.p1EquivalentPostInstallProof) {
    return { outcome: 'STOP', next: 'STOP', setupEmitsCommand: false } as const
  }

  return {
    outcome: 'SETUP_COMPLETE',
    next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT',
    setupEmitsCommand: false,
  } as const
}

const staleDependencyEvidence = (): StaleDependencyEvidence => ({
  repositoryIssueBranchBaseHeadExact: true,
  supportedRuntimeAndLock: true,
  trackedAndUntrackedClean: true,
  ignoredArtifactsKnownAndNonSecret: true,
  staleInstalledTreeAgainstCommittedLock: true,
  installedArtifactsCompleteAndFingerprinted: true,
  p1DependenciesValid: false,
  existingStoreUniqueAndBounded: true,
  dependencyRootsHaveNoAmbiguousSymlinks: true,
  writerOwnershipProven: true,
  processListDenied: false,
  enforceableExclusiveLease: false,
  noCompetingWriter: true,
  hostWriteScopeProven: true,
  noDriftSinceEvidenceCapture: true,
  noPriorRecoveryAttempt: true,
  quarantinePreservesOriginalTreeAndStore: true,
  installSucceeded: true,
  installInterrupted: false,
  p1EquivalentPostInstallProof: true,
})

describe('Issue #675 one-shot stale installed-dependency recovery stories', () => {
  const recoveryAuthority = preparation
    .split('**One-shot stale installed-dependency recovery — Issue #675.')[1]
    ?.split('No in-place retry of `pnpm install` in the failed checkout is permitted;')[0] ?? ''

  // Authority: #675's approved bounded objective and §12's P1/P2/P3 gates
  // define a single clean same-Issue stale-tree recovery; it must preserve old
  // artifacts, prove P1-equivalent dependencies, and route only to Discovery
  // then fresh Context. Setup never emits objective COMMAND.
  it('allows one exact stale-tree recovery only after post-install P1 proof', () => {
    const result = decideStaleDependencySetup(staleDependencyEvidence())

    expect(result).toEqual({
      outcome: 'SETUP_COMPLETE',
      next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT',
      setupEmitsCommand: false,
    })
    expect(recoveryAuthority).toMatch(/same-Issue.*exact live head.*approved-base/i)
    expect(recoveryAuthority).toMatch(/quarantine.*preserve.*byte-for-byte/i)
    expect(recoveryAuthority).toMatch(/one exact frozen\/ignore-scripts install/i)
    expect(recoveryAuthority).toMatch(/P1-equivalent.*proof/i)
    expect(recoveryAuthority).toMatch(/registered CLI Discovery.*fresh Context/i)
    expect(recoveryAuthority).toMatch(/never.*`COMMAND`|no `COMMAND`/i)
  })

  // Authority: canonical §12 P1 remains read-only reuse when its full proof
  // succeeds. This fixture ensures that valid dependencies do not enter the
  // recovery install path.
  it('retains P1 reuse without writes when installed dependencies already match', () => {
    const evidence = staleDependencyEvidence()
    evidence.p1DependenciesValid = true
    const result = decideStaleDependencySetup(evidence)
    expect(result).toEqual({
      outcome: 'P1_REUSE',
      next: 'REGISTERED_CLI_DISCOVERY_THEN_FRESH_CONTEXT',
      writes: 0,
      setupEmitsCommand: false,
    })
    expect(preparation).toMatch(/\*\*P1 — read-only reuse\.\*\*/)
  })

  // Authority: #675 explicitly keeps dirty state, unknown artifacts, weak
  // writer ownership, ambiguous dependency paths, drift, and replay fail
  // closed. If process enumeration is denied, only an enforceable exclusive
  // lease can substitute; otherwise the authority does not select a fallback.
  it('stops on every unresolved identity, preservation, ownership, or retry gate', () => {
    const blocked: Array<keyof StaleDependencyEvidence> = [
      'repositoryIssueBranchBaseHeadExact',
      'trackedAndUntrackedClean',
      'ignoredArtifactsKnownAndNonSecret',
      'installedArtifactsCompleteAndFingerprinted',
      'existingStoreUniqueAndBounded',
      'dependencyRootsHaveNoAmbiguousSymlinks',
      'writerOwnershipProven',
      'noCompetingWriter',
      'hostWriteScopeProven',
      'noDriftSinceEvidenceCapture',
      'noPriorRecoveryAttempt',
      'quarantinePreservesOriginalTreeAndStore',
      'installSucceeded',
      'installInterrupted',
      'p1EquivalentPostInstallProof',
    ]

    for (const key of blocked) {
      const evidence = staleDependencyEvidence()
      evidence[key] = key === 'installInterrupted'
      expect(decideStaleDependencySetup(evidence), key).toEqual({
        outcome: 'STOP',
        next: 'STOP',
        setupEmitsCommand: false,
      })
    }
  })

  // Authority: §12 makes denied process enumeration a STOP unless another
  // mechanism actually enforces exclusive writer ownership. An advisory
  // assertion or lease that competing writers may ignore is not proof.
  it('requires enforced writer exclusion when process listing is unavailable', () => {
    const evidence = staleDependencyEvidence()
    evidence.processListDenied = true
    evidence.enforceableExclusiveLease = false
    expect(decideStaleDependencySetup(evidence).outcome).toBe('STOP')

    evidence.enforceableExclusiveLease = true
    expect(decideStaleDependencySetup(evidence).outcome).toBe('SETUP_COMPLETE')
  })
})
