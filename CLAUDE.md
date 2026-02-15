# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## GitHub Actions: SHA Pinning (Mandatory)

All GitHub Actions MUST use commit SHA references, never version tags or branch references. This is a supply chain security requirement to prevent tag-based attacks and ensure reproducible CI/CD pipelines.

### Correct — SHA-pinned with version tag comment

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
- uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8 # v4.0.2
```

Note: npm is included with Node.js, so no additional setup action is required.

### Wrong — tag or branch reference (not allowed)

```yaml
# Never use tags
- uses: actions/checkout@v4
- uses: actions/setup-node@v4

# Never use branches
- uses: actions/checkout@main
```

**How to find the SHA:** Use GitHub's action lookup tool or check the action's release page for the commit SHA of your desired version. Always include the version tag as a comment for readability.

---

## Monorepo Structure

Three npm workspaces in `packages/`:

- **`@mctx-ai/mcp-server`** — Core framework (zero runtime dependencies)
- **`@mctx-ai/mcp-dev`** — Dev server with hot reload and request logging
- **`create-mctx-server`** — CLI scaffolding tool

Root commands affect all workspaces. Use `--workspace` flag for package-specific operations.

---

## Development Commands

### Root (all packages)

```bash
npm run build          # Build all packages
npm test              # Run all tests
npm run lint          # Lint all packages
npm run format        # Format with Prettier
npm run format:check  # Check formatting without modifying
```

### Server Package

```bash
# Testing
npm run test --workspace=@mctx-ai/mcp-server
npm run test:coverage --workspace=@mctx-ai/mcp-server  # V8 coverage, 80% thresholds
npx vitest run test/uri.test.js                        # Single test file (from packages/server/)
npx vitest run -t "test name"                          # Specific test by name

# Code quality
npm run lint --workspace=@mctx-ai/mcp-server
npm run lint:fix --workspace=@mctx-ai/mcp-server
npm run typecheck --workspace=@mctx-ai/mcp-server  # tsc --noEmit
```

---

## Code Conventions

### Language and Typing

- **JavaScript with ESM** — No TypeScript source files. All packages use `"type": "module"`.
- **Type definitions** — Hand-written `.d.ts` files (see `packages/server/src/index.d.ts`, 770+ lines).
- **JSDoc** — Inline documentation in JS source, exported types in `.d.ts`.

### Naming Conventions

- **Functions and variables:** `camelCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **Types (in `.d.ts`):** `PascalCase`
- **Unused parameters:** `_` prefix (e.g., `function handler(_req, res)`)

### Linting

- **ESLint 9** with flat config (`eslint.config.js`)
- **Key rule:** `no-unused-vars` with `argsIgnorePattern: "^_"` — prefix unused params with underscore

### Formatting

- **Prettier 3** for `.js`, `.json`, `.md` files
- Run `npm run format` before committing

---

## Architecture Patterns

### Handler Descriptor Pattern

Functions carry metadata as properties:

```javascript
function greet({ name }) {
  return `Hello, ${name}!`;
}
greet.description = 'Greet someone by name';
greet.input = { name: T.string({ required: true }) };

app.tool('greet', greet);
```

### Handler Types

1. **Tools** — Sync, async, or generator functions. Generators yield progress notifications. `ask` parameter enables LLM sampling.
2. **Resources** — Static URIs or URI templates with `{param}` placeholders. Params extracted via RFC 6570 Level 1.
3. **Prompts** — Return string, `conversation()` result, or Message array.

### Core Modules

- **`server.js`** — JSON-RPC 2.0 routing, capability negotiation, handler dispatch
- **`types.js`** — `T` type system (T.string, T.number, T.boolean, T.array, T.object) compiles to JSON Schema
- **`uri.js`** — RFC 6570 Level 1 URI template matching
- **`conversation.js`** — Multi-message prompt builder (user.say, ai.say, attach, embed)
- **`progress.js`** — Generator-based progress with 60s timeout, 10k yield limit
- **`log.js`** — RFC 5424 logging (8 severity levels, internal buffer with FIFO eviction)
- **`sampling.js`** — LLM-in-the-loop via `ask` function (client sampling capability)
- **`completion.js`** — Auto-completion from handlers, T.enum, or URI templates
- **`security.js`** — Error sanitization, secret redaction, size limits, URI scheme validation

---

## Git Conventions

### Commit Messages

**Format:** Conventional Commits (`type(scope): description`)

**Types that trigger releases:**
- `feat(scope):` → Minor version bump
- `fix(scope):` → Patch version bump
- `perf(scope):` → Patch version bump
- `revert(scope):` → Patch version bump

**Types that don't trigger releases:**
- `docs:`, `chore:`, `ci:`, `test:`, `refactor:`, `style:`, `build:`

### DCO Requirement

All commits MUST be signed off:

```bash
git commit -s -m "feat(server): add URI template validation"
```

This adds `Signed-off-by: Your Name <your.email@example.com>` to the commit message.

---

## Testing

### Framework and Coverage

- **Vitest v4** with V8 coverage provider
- **Thresholds:** 80% minimum for lines, functions, branches, statements

### Running Tests

```bash
# All tests
npm test

# Single package
npm run test --workspace=@mctx-ai/mcp-server

# With coverage report
npm run test:coverage --workspace=@mctx-ai/mcp-server

# Single test file
npx vitest run test/uri.test.js

# Single test by name
npx vitest run -t "validates URI templates correctly"
```

---

## Releases

**Automated via Semantic Release** using `multi-semantic-release` for monorepo support.

- Triggered by commits to `main` branch
- Version bumps determined by commit type (feat → minor, fix/perf/revert → patch)
- Changelog generated automatically
- Packages released independently based on changes

No manual version bumps or changelog edits required.

---

## CI/CD

**GitHub Actions workflows:**

- **Lint** — ESLint across all packages
- **Test** — Matrix: Node 20.x/22.x × ubuntu/windows/macos
- **Security Audit** — npm audit for vulnerabilities
- **Scaffold Validation** — Tests `create-mctx-server` project generation

All actions MUST be SHA-pinned (see GitHub Actions section above).
