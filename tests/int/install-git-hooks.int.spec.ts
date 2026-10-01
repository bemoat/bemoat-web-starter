import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

import { stringifyCapturedGitOutput } from '../../scripts/install-git-hooks.ts'

function getFixtureDiagnostics(fixtureNames: string[]) {
  const root = resolve(process.cwd(), 'tests/fixtures/node-api-buffer')
  const program = ts.createProgram({
    rootNames: fixtureNames.map((name) => resolve(root, name)),
    options: {
      allowJs: true,
      checkJs: false,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      incremental: false,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      strictNullChecks: true,
      target: ts.ScriptTarget.ES2022,
      types: ['node'],
    },
  })

  return ts.getPreEmitDiagnostics(program)
}

describe('install-git-hooks captured output typing boundary', () => {
  it('formats output inferred from the real execFileSync API', () => {
    const output = execFileSync(process.execPath, ['--version'], { encoding: 'utf8' })

    expect(stringifyCapturedGitOutput(output)).toMatch(/^v\d/)
  })

  it('captures the generated-JavaScript Buffer narrowing failure with the pinned Node types', () => {
    const packageJSON = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      devDependencies: { '@types/node': string; typescript: string }
    }

    expect(packageJSON.devDependencies['@types/node']).toBe('24.13.1')
    expect(packageJSON.devDependencies.typescript).toBe('6.0.3')
    expect(ts.version).toBe('6.0.3')

    const unsafeDiagnostics = getFixtureDiagnostics([
      'generated-buffer-assignment.mjs',
      'unsafe-exec-file-sync.ts',
    ])
    const safeDiagnostics = getFixtureDiagnostics([
      'generated-buffer-assignment.mjs',
      'safe-exec-file-sync.ts',
    ])
    const diagnosticCodes = unsafeDiagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      file: diagnostic.file ? basename(diagnostic.file.fileName) : null,
    }))

    expect(diagnosticCodes.filter((diagnostic) => diagnostic.code === 2554)).toEqual([
      { code: 2554, file: 'unsafe-exec-file-sync.ts' },
    ])
    expect(diagnosticCodes.filter((diagnostic) => diagnostic.code !== 2554)).toEqual([])
    expect(safeDiagnostics).toEqual([])
  })
})
