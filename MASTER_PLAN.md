# APIShift: Master Implementation Plan

Autonomous API migration and breaking change healing engine. Ingests API breaking change specifications and SDK migration guides, scans repository Abstract Syntax Trees (ASTs), synthesizes type-safe code transformations, runs local test suites in isolated sandboxes, and iteratively heals regressions until 100% of tests pass.

---

## 1. Project overview and architecture

Software teams frequently face breaking changes in third-party APIs and SDKs (such as OpenAI v0.28 to v1.0, Stripe v12 to v14, or Next.js router migrations). Manual refactoring across hundreds of files introduces high regression risks, and naive code generation models often alter unrelated code or generate invalid parameter names.

APIShift provides an automated migration pipeline:
1. Migration specification ingestion: parses OpenAPI diffs, declarative JSON migration recipes, or deprecation manifests.
2. AST codebase scanner: analyzes TypeScript, JavaScript, and Python codebases using Babel and Recast to map every import statement, callsite, and interface contract.
3. Semantic patch synthesizer: applies style-preserving AST transformations that keep user comments, indentation, and structure intact.
4. Isolated test-driven healing loop: executes the repository test suite in an isolated sandbox (Docker container when available, or isolated worker sandbox with process isolation). Parses compiler and runtime errors, feeding them back to the patch synthesizer until all tests pass.
5. GitHub pull request generator: creates dedicated feature branches, generates conventional commits, and opens pull requests with before and after diffs and test logs.
6. Web review studio: React 19 interface displaying live migration progress, side-by-side diffs, test logs, and pull request previews.

```
+-----------------------------------------------------------------------------------+
|                                     APISHIFT                                      |
+-----------------------------------------+-----------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                                                   |
+-------v-------------------------+                 +-----------------------v-------+
|    Migration Spec Ingestor      |                 |      AST Codebase Scanner     |
|  * OpenAPI Diff / JSON Recipe   |                 |  * TypeScript/JavaScript AST  |
|  * Renamed Methods & Params     |                 |  * Callsite & Import Mapper   |
|  * Schema Type Transformations  |                 |  * Call Graph Resolution      |
+-------+-------------------------+                 +-----------------------+-------+
        |                                                                   |
        +---------------------------------+---------------------------------+
                                          |
                        +-----------------v-----------------+
                        |   Semantic Patch Synthesizer      |
                        |  * AST Transformation (Recast)    |
                        |  * Preserves Comments & Style     |
                        |  * Targeted Code Synthesis        |
                        +-----------------+-----------------+
                        |
                        +-----------------v-----------------+
                        |    Sandboxed Test-Driven Healer   |
                        |  * Docker / Isolated Process      |
                        |  * Error & Stack Trace Parser     |
                        |  * Iterative Self-Healing Loop    |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   GitHub PR & Diff Studio         |
                        |  * Atomic Git Commits             |
                        |  * Verified Green PR Generator    |
                        |  * Web Review Studio (Port 9220)  |
                        +-----------------------------------+
```

---

## 2. Directory structure

```
apishift/
├── src/
│   ├── spec/
│   │   ├── types.ts              # Migration recipe and rule schema types
│   │   ├── ingestor.ts           # Parses JSON migration recipes and OpenAPI diffs
│   │   ├── openapi_differ.ts     # Computes breaking change diffs between two OpenAPI specs
│   │   └── builtins/             # Pre-packaged recipes (OpenAI v1, Stripe v14, Supabase v2, Next.js)
│   ├── scanner/
│   │   ├── ast_walker.ts         # Babel / Recast AST visitor for TS/JS
│   │   ├── import_resolver.ts    # Resolves library imports, namespaces, and aliases
│   │   └── call_graph.ts         # Maps resolved call sites across repository files
│   ├── synthesizer/
│   │   ├── ast_mutator.ts        # Rewrites AST nodes preserving comments and formatting
│   │   ├── transformer_rules.ts  # Rule executors for rename, param remap, option wrapping
│   │   ├── patch_generator.ts    # Computes unified git diffs and patch statistics
│   │   └── repair_prompts.ts     # Generates targeted repair strategies for test failures
│   ├── sandbox/
│   │   ├── types.ts              # Sandbox executor interfaces and execution result types
│   │   ├── docker_runner.ts      # Dockerode container sandbox runner
│   │   ├── local_runner.ts       # Isolated staging sandbox runner for local environments
│   │   ├── runner_factory.ts     # Detects environment and instantiates appropriate runner
│   │   └── error_parser.ts       # Parses compiler, assertion, and runtime error messages
│   ├── agent/
│   │   ├── loop.ts               # Iterative heal loop: Run -> Fail -> Analyze -> Mutate -> Retry
│   │   └── memory.ts             # Tracks attempts and prevents cyclic mutations
│   ├── git/
│   │   ├── branch_manager.ts     # Git branch and commit automation
│   │   └── pr_publisher.ts       # Octokit and GitHub CLI pull request generator
│   ├── server/
│   │   ├── api.ts                # Fastify backend routes for web UI
│   │   ├── sse.ts                # Server-Sent Events stream for live execution logs
│   │   └── static.ts             # Static file server for built React frontend
│   └── cli.ts                    # Commander CLI entrypoint
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx            # Navigation and status header
│   │   │   ├── RecipeSelector.tsx    # Migration recipe picker and JSON editor
│   │   │   ├── MigrationProgress.tsx # Live pipeline progress indicator
│   │   │   ├── DiffViewer.tsx        # Side by side code diff viewer
│   │   │   ├── TestConsole.tsx       # Live test execution console
│   │   │   └── PrPreviewModal.tsx    # GitHub Pull Request preview dialog
│   │   ├── hooks/
│   │   │   └── useMigrationStream.ts # SSE hook for streaming updates
│   │   ├── App.tsx                   # Main studio application view
│   │   ├── main.tsx                  # React 19 mount entrypoint
│   │   └── index.css                 # Clean CSS tokens and layout styles
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
├── fixtures/                         # Real test repositories for verification
│   ├── sample_openai_project/        # Real project with v0.28 calls and test suite
│   └── sample_stripe_project/        # Real project with v12 calls and test suite
├── tests/
│   ├── spec_ingestor.test.ts         # Ingestor and OpenAPI differ tests
│   ├── ast_walker.test.ts            # Call site and import scanner tests
│   ├── ast_mutator.test.ts           # Style preserving Recast mutation tests
│   ├── error_parser.test.ts          # Test failure and compiler error parser tests
│   └── healing_loop.test.ts          # Full end to end migration and self-healing tests
├── docs/
│   ├── ARCHITECTURE.md               # Technical architecture document
│   ├── RECIPES.md                    # Migration recipe reference
│   └── images/                       # UI screenshots and animated demo GIF
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Implementation roadmap

### Phase 1: Core setup and recipe ingestion
- Initialize root `package.json` with TypeScript configuration and dependencies:
  - `recast`, `@babel/parser`, `@babel/traverse`, `@babel/types`, `dockerode`, `commander`, `fastify`, `@fastify/cors`, `@fastify/static`, `diff`, `octokit`.
- Implement `src/spec/types.ts` defining migration recipe schema:
  - `PackageTarget`: package name, source version, target version.
  - `TransformationRule`: method renames, parameter remapping, import specifier updates, options object wrapping, deprecation removals.
- Implement `src/spec/ingestor.ts`: loads JSON and YAML migration manifests with validation.
- Implement `src/spec/openapi_differ.ts`: extracts route renames, parameter alterations, and schema property renames between two OpenAPI JSON/YAML specifications.
- Implement pre-packaged built-in recipes in `src/spec/builtins/`:
  - `openai-v0-to-v1.json`
  - `stripe-v12-to-v14.json`
  - `supabase-v1-to-v2.json`
  - `nextjs-pages-to-app.json`

### Phase 2: AST codebase scanner and import resolver
- Implement `src/scanner/import_resolver.ts`:
  - Tracks default imports, named imports, namespace imports, and CommonJS `require` statements.
  - Maps local alias names to original package exports (e.g. `import { Configuration as Cfg } from 'openai'`).
- Implement `src/scanner/ast_walker.ts`:
  - Walks AST using `@babel/parser` and Babel traversal.
  - Finds all `CallExpression`, `MemberExpression`, `NewExpression`, and `TSInterfaceDeclaration` references tied to target packages.
  - Records source file, line number, column range, and arguments.
- Implement `src/scanner/call_graph.ts`:
  - Scans entire repository directory tree, filtering node_modules, build, and dist folders.
  - Aggregates call sites per file and computes dependency order.

### Phase 3: Semantic patch synthesizer
- Implement `src/synthesizer/ast_mutator.ts`:
  - Uses `recast` to parse and reprint code, preserving original comments, quotes, indentation, and formatting.
  - Rewrites method chains (e.g. `openai.ChatCompletion.create` -> `openai.chat.completions.create`).
  - Rewrites argument dictionaries (e.g. renaming `model_name` key to `model`).
  - Updates import statements to new package contracts.
- Implement `src/synthesizer/patch_generator.ts`:
  - Generates standard unified diffs for previewing and staging changes.
  - Calculates file modification counts and callsite statistics.

### Phase 4: Sandboxed test-driven self-healing engine
- Implement `src/sandbox/docker_runner.ts`:
  - Manages Docker containers via `dockerode`, mounting workspace volumes.
- Implement `src/sandbox/local_runner.ts`:
  - Provides isolated workspace staging in temporary working trees with timeout protection, environment isolation, and clean tear-down.
- Implement `src/sandbox/runner_factory.ts`:
  - Automatically selects Docker if available, falling back to isolated local staging runner.
- Implement `src/sandbox/error_parser.ts`:
  - Extracts error stacks, failed test names, line numbers, and error codes (TypeScript compiler errors, Jest/Vitest assertions, Mocha, Node test runner).
- Implement `src/agent/loop.ts`:
  - Runs baseline test suite to verify starting state.
  - Applies initial AST transformations.
  - Re-executes test suite.
  - On test failure, analyzes failure signatures, applies targeted AST or heuristic fixes, and retries.
  - Halts with success once 100% of tests pass, or logs detailed diagnostics.
- Implement `src/agent/memory.ts`:
  - Prevents cyclic modifications and records tried mutation strategies.

### Phase 5: Git automation and GitHub PR publisher
- Implement `src/git/branch_manager.ts`:
  - Creates clean migration branch (`migrate/<package>-to-<version>`).
  - Stages modified files and creates conventional commits.
- Implement `src/git/pr_publisher.ts`:
  - Opens pull request via GitHub API or `gh` CLI.
  - Generates clear pull request description with migration summary, changed call sites, and test verification report.

### Phase 6: React 19 web review studio and Fastify API
- Set up Fastify backend in `src/server/api.ts` with SSE streaming (`src/server/sse.ts`).
- Build React 19 UI in `web/`:
  - Header with project status and active repository path.
  - Recipe selector with built-in recipes and custom JSON editor.
  - Migration progress visualizer showing real-time stage progression.
  - Side-by-side diff viewer with syntax highlighting and file tree.
  - Live test console streaming container test execution logs.
  - PR preview dialog with branch details and submit trigger.

### Phase 7: CLI and end-to-end verification
- Implement CLI in `src/cli.ts`:
  - `apishift scan --repo <path> --recipe <name_or_path>`
  - `apishift migrate --repo <path> --recipe <name_or_path> [--sandbox <mode>] [--auto-pr]`
  - `apishift diff --spec-old <file> --spec-new <file> [--out <file>]`
  - `apishift serve --port 9220`
- Construct real sample project fixtures:
  - `fixtures/sample_openai_project`: contains v0.28 OpenAI SDK calls and a real test suite.
- Write automated tests:
  - Spec ingestion and OpenAPI diffing.
  - AST scanning and identifier resolution.
  - Style-preserving Recast mutations.
  - Error parsing across test runner formats.
  - End-to-end migration and healing verification.
