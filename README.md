# dependency-health

`dependency-health` is a TypeScript CLI for auditing dependency freshness, duplication and lockfile health.

It scans `package.json`, analyzes the lockfile, optionally queries the npm registry and produces a compact report for local development or CI.

## Features

- scans `dependencies`
- scans `devDependencies`
- scans `peerDependencies`
- scans `optionalDependencies`
- supports `package-lock.json`
- supports `pnpm-lock.yaml`
- basic support for classic `yarn.lock`
- counts dependency-tree entries
- detects packages resolved to multiple versions
- detects packages installed across multiple major versions
- checks current npm `latest` versions
- detects deprecated direct dependencies
- flags wildcard and `latest` ranges
- flags Git / HTTP dependency sources
- flags local `file:` / `link:` sources
- estimates npm `node_modules` nesting depth
- flags unusually large dependency trees
- JSON reports
- standalone HTML reports
- offline mode
- CI-friendly exit codes

## Quick start

```bash
npm install
npm run build
node dist/cli.js .
```

Development mode:

```bash
npm run dev -- .
```

## Analyze another project

```bash
node dist/cli.js ../some-project
```

## Offline analysis

```bash
node dist/cli.js . --offline
```

This skips npm registry requests but still analyzes the package file and lockfile.

## Reports

JSON:

```bash
node dist/cli.js . --json reports/dependency-health.json
```

Standalone HTML:

```bash
node dist/cli.js . --html reports/dependency-health.html
```

Both:

```bash
node dist/cli.js . \
  --json reports/dependency-health.json \
  --html reports/dependency-health.html
```

## CI

The CLI can fail a build when findings reach a selected severity.

Default:

```bash
node dist/cli.js . --fail-on high
```

Stricter:

```bash
node dist/cli.js . --fail-on medium
```

Exit codes:

```text
0  no finding reached the configured threshold
1  dependency-health findings reached the threshold
2  invalid input or runtime error
```

## Finding examples

### High

- missing lockfile
- wildcard / `latest` direct dependency
- deprecated direct dependency
- one package resolved across multiple major versions

### Medium

- major-version freshness gap
- duplicated resolved versions
- Git / HTTP dependency source
- very large dependency tree

### Low

- smaller freshness gap
- exact direct version pin
- moderately large dependency tree

### Info

- local `file:` / `link:` dependency

## Registry checks

Online mode queries the public npm registry to determine:

- latest published version
- whether the latest version is marked deprecated

Registry failures do not stop the full scan. Unknown freshness stays unknown.

## Lockfile analysis

### npm

`package-lock.json` gets the deepest analysis:

- package entry count
- unique package count
- duplicate versions
- duplicate major versions
- approximate `node_modules` nesting depth

### pnpm

`pnpm-lock.yaml` is parsed for resolved package versions and duplication.

### Yarn

Classic `yarn.lock` receives lightweight resolved-version analysis.

## Project structure

```text
dependency-health/
├── src/
│   ├── analyze.ts
│   ├── cli.ts
│   ├── export.ts
│   ├── lockfile.ts
│   └── types.ts
├── tests/
│   └── rules.test.ts
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

## Install as a local CLI

```bash
npm install
npm run build
npm link
```

Then:

```bash
dependency-health .
```

## Requirements

- Node.js 20+
- npm

## Scope

`dependency-health` is not a replacement for `npm audit`.

Its focus is dependency freshness, duplicate versions, lockfile shape and maintainability signals rather than vulnerability databases.

Not every finding is automatically a problem. The tool surfaces conditions worth reviewing.

## License

MIT
