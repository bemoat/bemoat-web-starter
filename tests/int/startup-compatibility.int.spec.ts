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
})
