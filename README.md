# APIShift

Autonomous API migration and breaking change healing engine. Ingests API breaking change specifications and SDK migration guides, scans repository Abstract Syntax Trees (ASTs), synthesizes type-safe code transformations, runs local test suites in isolated sandboxes, and iteratively heals regressions until 100% of tests pass.

![APIShift Demo](docs/images/apishift_demo.gif)

---

## What it does

Software teams frequently postpone major SDK upgrades because manual refactoring across hundreds of files introduces high regression risks. Passing entire repositories to standard chat models often generates broken parameter names or deletes unrelated logic.

APIShift automates the complete upgrade lifecycle:
1. **Migration recipe ingestion**: loads declarative migration recipes (OpenAI v0.28 to v1.0, Stripe v12 to v14, Supabase v1 to v2, Next.js Pages to App Router) or computes OpenAPI diffs between two versions.
2. **AST codebase scanner**: walks TypeScript and JavaScript ASTs using Babel and Recast, mapping every import statement, class instantiation, method call, and parameter dictionary.
3. **Semantic patch synthesizer**: performs style-preserving AST mutations, retaining existing user comments, indentation, and structure.
4. **Sandboxed test-driven healing loop**: executes the repository test suite in an isolated sandbox (Docker container when available, or an isolated process runner). Parses compiler errors and assertion failures, applying iterative repairs until all tests turn green.
5. **Pull request publisher**: creates dedicated migration branches, writes conventional git commits, and opens verified GitHub pull requests with diff breakdowns and test execution proofs.
6. **Web review studio**: React 19 interface displaying live migration progress, side-by-side file diffs, test logs, and recipe editors.

---

## Visual walkthrough

| Migration studio & live test console | Side by side diff viewer |
| :---: | :---: |
| ![Studio](docs/images/apishift-1.png) | ![Diff Viewer](docs/images/apishift-2.png) |

| Recipe inspector & schema editor | OpenAPI specification differ |
| :---: | :---: |
| ![Recipe Inspector](docs/images/apishift-3.png) | ![OpenAPI Differ](docs/images/apishift-4.png) |

---

## Installation

```bash
# Clone the repository
git clone https://github.com/alexandrmotologa/apishift.git
cd apishift

# Install dependencies and build
npm install
npm run build:all
```

---

## CLI usage

### 1. List available built-in recipes
```bash
node dist/cli.js recipes
```

### 2. Scan a target repository
Finds all callsites matching a migration recipe without modifying files:
```bash
node dist/cli.js scan --repo ./my-project --recipe openai-v0-to-v1
```

### 3. Run migration with test healing
Applies AST transformations and verifies against your project test suite:
```bash
node dist/cli.js migrate --repo ./my-project --recipe openai-v0-to-v1 --test-cmd "npm test"
```

Options:
- `--sandbox <mode>`: sandbox runner mode (`auto`, `docker`, or `local`, default: `auto`).
- `--test-cmd <cmd>`: test command to run (e.g., `npm test`, `npx vitest run`, `node --test`).
- `--dry-run`: previews changes without writing files to disk.
- `--auto-pr`: creates a git branch, commits changes, and opens a GitHub pull request.
- `--max-iter <num>`: maximum self-healing iterations (default: 5).

### 4. Diff two OpenAPI specifications
Compares two OpenAPI JSON/YAML specifications and generates an automated migration recipe:
```bash
node dist/cli.js diff --spec-old ./spec-v1.json --spec-new ./spec-v2.json --out ./custom-recipe.json
```

### 5. Start the web review studio
Launches the Fastify API server and React 19 web studio on port 9220:
```bash
node dist/cli.js serve --port 9220
```

Open `http://localhost:9220` in your browser.

---

## Pre-packaged migration recipes

| Recipe ID | Target package | Version jump | Description |
| :--- | :--- | :--- | :--- |
| `openai-v0-to-v1` | `openai` | `0.28.0` → `1.0.0` | Migrates `Configuration` and `OpenAIApi` to `OpenAI`, renames `createChatCompletion` to `chat.completions.create`, updates `model_name` to `model`, and removes `.data` wrapper. |
| `stripe-v12-to-v14` | `stripe` | `12.0.0` → `14.0.0` | Migrates `charges.create` to `paymentIntents.create`, remaps `destination` to `on_behalf_of`, and wraps options into secondary parameters. |
| `supabase-v1-to-v2` | `@supabase/supabase-js` | `1.35.0` → `2.0.0` | Migrates synchronous `auth.user()` and `auth.session()` calls to asynchronous `auth.getUser()` and `auth.getSession()`. |
| `nextjs-pages-to-app` | `next` | `12.0.0` → `14.0.0` | Updates `useRouter` import path from `next/router` to `next/navigation` and flags legacy query parameters. |

---

## Architecture

```
apishift/
├── src/
│   ├── spec/            # Recipe parser and OpenAPI differ
│   ├── scanner/         # Babel / Recast AST visitor and import resolver
│   ├── synthesizer/     # Style-preserving AST mutator and patch generator
│   ├── sandbox/         # Dockerode runner and local process sandbox
│   ├── agent/           # Test-driven self-healing loop and memory
│   ├── git/             # Branch manager and GitHub PR publisher
│   ├── server/          # Fastify backend and Server-Sent Events stream
│   └── cli.ts           # Commander CLI entrypoint
├── web/                 # React 19 web review studio (Vite, TypeScript, CSS)
├── fixtures/            # Real sample project fixtures for verification
└── tests/               # Vitest unit and integration test suite
```

---

## Verification and testing

Run the full automated test suite:
```bash
npm test
```

Expected output:
```text
 ✓ tests/error_parser.test.ts (2 tests)
 ✓ tests/openapi_differ.test.ts (1 test)
 ✓ tests/spec_ingestor.test.ts (3 tests)
 ✓ tests/ast_walker.test.ts (1 test)
 ✓ tests/ast_mutator.test.ts (1 test)
 ✓ tests/healing_loop.test.ts (1 test)

 Test Files  6 passed (6)
      Tests  9 passed (9)
```

---

## License

MIT License. Copyright (c) 2026 Alexandr Motologa.
