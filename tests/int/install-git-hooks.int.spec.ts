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

function getProductionDiagnostics(productionSource: string) {
  const root = process.cwd()
  const productionFile = resolve(root, 'scripts/install-git-hooks.ts')
  const fixtureRoot = resolve(root, 'tests/fixtures/node-api-buffer')
  const options: ts.CompilerOptions = {
    allowJs: true,
    checkJs: false,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    incremental: false,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    strictNullChecks: false,
    allowImportingTsExtensions: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    isolatedModules: true,
    target: ts.ScriptTarget.ES2022,
    types: ['node'],
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (resolve(fileName) === productionFile) {
      return ts.createSourceFile(fileName, productionSource, languageVersion, true)
    }

    return getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
  }

  const program = ts.createProgram({
    rootNames: [
      resolve(fixtureRoot, 'generated-buffer-assignment.mjs'),
      productionFile,
    ],
    options,
    host,
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

  it('compiles the production installer and catches a restored Buffer.toString encoding call', () => {
    const productionFile = resolve(process.cwd(), 'scripts/install-git-hooks.ts')
    const productionSource = readFileSync(productionFile, 'utf8')
    const restoredWriter = `function writeCapturedGitStdout(output: unknown): void {
  if (!output) return
  const text = Buffer.isBuffer(output) ? output.toString('utf8') : String(output)
  if (text) process.stderr.write(text)
}`
    const sourceFile = ts.createSourceFile(
      productionFile,
      productionSource,
      ts.ScriptTarget.Latest,
      true,
    )
    const writer = sourceFile.statements.find((statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === 'writeCapturedGitStdout',
    )

    if (!writer) throw new Error('Missing writeCapturedGitStdout production function')

    const restoredSource = [
      productionSource.slice(0, writer.getStart(sourceFile)),
      restoredWriter,
      productionSource.slice(writer.end),
    ].join('')

    const currentDiagnosticCodes = getProductionDiagnostics(productionSource).map((diagnostic) => ({
      code: diagnostic.code,
      file: diagnostic.file ? basename(diagnostic.file.fileName) : null,
    }))
    expect(currentDiagnosticCodes).toEqual([])

    const restoredDiagnosticCodes = getProductionDiagnostics(restoredSource).map((diagnostic) => ({
      code: diagnostic.code,
      file: diagnostic.file ? basename(diagnostic.file.fileName) : null,
    }))

    expect(restoredDiagnosticCodes.filter((diagnostic) => diagnostic.code === 2554)).toContainEqual({
      code: 2554,
      file: 'install-git-hooks.ts',
    })
    expect(restoredDiagnosticCodes.filter((diagnostic) => diagnostic.code !== 2554)).toEqual([])
  })
})
