import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = process.cwd()
const loaderPath = 'prompts/mission-control/chatgpt-project-loader.md'
const loader = readFileSync(resolve(root, loaderPath), 'utf8')
const normalizedLoader = loader.replace(/\s+/g, ' ')

describe('Global Mission Control progressive-disclosure router', () => {
  it('keeps only the always-required authority and routing in the loader', () => {
    expect(loader.length).toBeLessThanOrEqual(5000)

    for (const invariant of [
      /authoritative protected-base policy/i,
      /live GitHub/i,
      /report the repository.*protected base.*policy ref.*policy source commit SHA.*guide version/i,
      /Global MC does not run repository-local Bemoat CLI/i,
      /Context.*canonical routing authority/i,
      /one bounded objective/i,
      /`COMMAND`.*continue.*same.*session/i,
      /`FOUNDER_GATE`.*return to Founder/i,
      /`STOP`.*fail.closed/i,
      /do not pre.authorize future objectives/i,
      /independent review/i,
      /never merge autonomously/i,
    ]) expect(normalizedLoader).toMatch(invariant)
  })

  it('keeps a concise operator summary in the always-loaded response contract', () => {
    expect(normalizedLoader).toMatch(/ordinary Global MC responses.*concise operator-facing summary.*before.*long artifact/i)
    expect(normalizedLoader).toMatch(/current objective/i)
    expect(normalizedLoader).toMatch(/current route\/status/i)
    expect(normalizedLoader).toMatch(/suggested model.*execution routing/i)
    expect(normalizedLoader).toMatch(/next permitted action.*why/i)
    expect(normalizedLoader).toMatch(/Founder decision status/i)
    expect(normalizedLoader).toMatch(/branch.*PR.*head/i)
  })

  it('routes each phase trigger to a real canonical contract and loads it only when triggered', () => {
    const routes = [
      ['Execution handoff', 'docs/mission-control/execution-handoff-contract.md'],
      ['model recommendations', 'docs/mission-control/model-routing-profile.md'],
      ['REVIEW_VERDICT', 'docs/mission-control/review-verdict-template.md'],
      ['BLOCKER_RESOLUTION', 'docs/mission-control/blocker-resolution-template.md'],
      ['Issue intake', 'docs/agent-loop/issue-intake-contract.md'],
      ['HANDOFF', 'docs/mission-control/handoff-template.md'],
      ['Context and command semantics', 'docs/mission-control/command-reference.md'],
    ] as const

    for (const [trigger, contract] of routes) {
      expect(loader).toContain(trigger)
      expect(loader).toContain(contract)
      expect(existsSync(resolve(root, contract)), `${trigger} contract exists: ${contract}`).toBe(true)
      expect(normalizedLoader).toMatch(new RegExp(`when .*${trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*load`, 'i'))
    }
  })

  it('does not keep campaign instructions or the full execution artifact always loaded', () => {
    expect(loader).not.toMatch(/#512|#532/)
    expect(loader).not.toMatch(/^## \d+\. (Repository \/ Issue \/ PR identity|Current bounded objective|Verified live authority \/ route)/m)
    expect(loader).not.toMatch(/```ready-to-paste/)
  })

  it('does not load unrelated phase contracts just because they are available', () => {
    expect(normalizedLoader).toMatch(/load a phase contract only when triggered/i)
    expect(normalizedLoader).toMatch(/contract's existence alone does not trigger loading/i)
  })

  it('includes new canonical contracts and router regressions in child-sync inventory', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, '.bemoat/boilerplate-sync-manifest.json'), 'utf8')) as {
      managedPaths: string[]
    }
    const inventory = readFileSync(resolve(root, 'scripts/boilerplate/inventory.ts'), 'utf8')

    for (const path of [
      'docs/mission-control/execution-handoff-contract.md',
      'docs/mission-control/model-routing-profile.md',
      'tests/int/mission-control-loader-router.int.spec.ts',
    ]) {
      expect(manifest.managedPaths).toContain(path)
      expect(inventory).toContain(path)
    }
  })
})
