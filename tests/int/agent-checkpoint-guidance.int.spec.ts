import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8')

describe('durable semantic checkpoint guidance', () => {
  it('defines normal-path checkpoints at coherent, proven semantic boundaries', () => {
    const checklist = read('docs/agent-loop/checklist.md')
    const guidance = `${checklist} ${read('.agents/skills/development-agent.md')}`.replace(/\s+/g, ' ')

    expect(guidance).toMatch(/coherent.*(?:independently understandable|self-contained).*semantic unit/i)
    expect(guidance).toMatch(/directly coupled.*(?:test|proof)/i)
    expect(guidance).toMatch(/not.*(?:per file|per function|arbitrary line|line count)/i)
    expect(guidance).toMatch(/(?:characterization|test).*implementation.*(?:same|together).*commit/i)
    expect(guidance).toMatch(/(?:documentation|specification|contract).*checkpoint/i)
    expect(guidance).toMatch(/(?:refactor|integration|registration|forward.fix|WIP recovery)/i)
    expect(guidance).toMatch(/final.*(?:exact.head|PR head).*CI.*review/i)
    expect(guidance).not.toMatch(/Keep checkpoint commits local and do not push them by default/i)
    expect(guidance).not.toMatch(/Squash all local checkpoints into one focused final commit/i)
  })

  it('requires remote SHA readback after checkpoints and preserves the #261 recovery contract', () => {
    const checklist = read('docs/agent-loop/checklist.md')
    const execution = read('docs/mission-control/execution-handoff-contract.md')
    const guide = read('docs/mission-control/mission-control-guide.md')
    const handoff = read('.agents/skills/handoff.md')
    const guidance = `${checklist} ${execution} ${guide} ${handoff}`.replace(/\s+/g, ' ')

    expect(guidance).toMatch(/after every semantic.*checkpoint.*push/i)
    expect(guidance).toMatch(/remote.*(?:readback|verify).*exact.*(?:SHA|commit)/i)
    expect(guidance).toMatch(/before.*(?:handoff|STOP|BLOCKED|RESULT|shutdown)/i)
    expect(guidance).toMatch(/push fails.*checkpoint is not yet durable/i)
    expect(guidance).toMatch(/local SHA.*blocker/i)
    expect(guidance).toMatch(/WIP recovery commit.*durable evidence rather than completed delivery, review eligibility, or merge authority/i)
    expect(guidance).toMatch(/Handoff exit.hygiene gate/i)
    expect(guidance).toMatch(/no second WIP protocol/i)
  })
})
