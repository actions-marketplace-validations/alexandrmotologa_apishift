# APIShift: Master Implementation Plan

> **Agentic API-to-Codebase Auto-Migrator & Breaking Change Healing Engine (YC RFS)**
>
> *Autonomous developer agent and AST refactoring engine solving Y Combinator's official Request for Startups. Ingests API breaking change specifications and SDK migration guides, scans repository Abstract Syntax Trees (ASTs), synthesizes type-safe code transformations, runs local test suites in Docker, and iteratively auto-heals regressions until 100% of tests pass.*

---

## 1. Project Overview & Architecture

Software development is plagued by API and SDK deprecations. When major platforms (Stripe, OpenAI, Supabase, Twilio, AWS) release breaking changes (e.g. OpenAI v0.28 -> v1.0, Stripe v12 -> v14, or Next.js Pages -> App Router), engineering teams face severe friction:
1. **Prolonged Upgrade Paralysis**: Companies delay critical SDK upgrades for 6–12 months because manual refactoring across hundreds of files carries high regression risks.
2. **Platform Provider Burden**: API platforms spend millions of dollars maintaining legacy API endpoints and backwards-compatibility layers because customers refuse to upgrade.
3. **Naive AI Limitations**: Passing an entire repository to standard chat models generates incomplete code, hallucinates parameter names, and introduces subtle runtime bugs.
4. **Lack of Automated Verification**: Code transformations must be strictly verified against the project's actual unit and integration test suites before any pull request is opened.

**APIShift** automates the entire migration lifecycle end-to-end:
- **Migration Spec Ingestion**: Ingests OpenAPI diffs, JSON migration recipes, or deprecation markdown documents (mapping old method signatures, renamed parameters, and altered payload shapes).
- **AST Codebase Scanner**: Analyzes target repositories (TypeScript, Python, Go) using Babel/Recast to map every import statement, callsite, and interface contract.
- **Semantic Patch Synthesizer**: Generates exact, style-preserving AST transformations that retain all user code comments, indentation, and structure.
- **Docker-Sandboxed Test-Driven Healing Loop**: Executes the repository's test suite (`npm test`, `pytest`, `go test`) inside an isolated local Docker container. Catches compiler errors and failed assertions, feeding them back to the LLM agent to iteratively heal regressions until all tests pass.
- **Automated GitHub Pull Request Generator**: Creates a dedicated git branch with atomic commits and opens a comprehensive PR complete with before/after diffs and green test execution proofs.

```
+-----------------------------------------------------------------------------------+
|                                     APISHIFT                                      |
+-----------------------------------------+-----------------------------------------+
                                          |
        +---------------------------------+---------------------------------+
        |                                                                   |
+-------v-------------------------+                 +-----------------------v-------+
|    Migration Spec Ingestor      |                 |      AST Codebase Scanner     |
|  * OpenAPI Diff / JSON Recipe   |                 |  * TypeScript, Python, Go AST |
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
                        |  * Context-Aware LLM Reasoning    |
                        +-----------------+-----------------+
                                          |
                        +-----------------v-----------------+
                        |   Docker Test-Driven Healer Loop  |
                        |  * Runs Local Test Suite in Docker|
                        |  * Captures Stack Traces & Errors |
                        |  * Iterative Self-Healing Agent   |
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

## 2. Directory Structure

```
apishift/
├── src/
│   ├── spec/
│   │   ├── ingestor.ts           # Parses OpenAPI diffs & JSON migration recipes
│   │   ├── rules.ts              # Transformation rules: rename, reorder, type-cast
│   │   └── builtins/             # Pre-packaged recipes (OpenAI v1, Stripe v14, Next.js)
│   ├── scanner/
│   │   ├── ast_walker.ts         # Babel / Recast AST visitor for TS/JS
│   │   ├── python_scanner.ts     # Python AST caller locator
│   │   └── call_graph.ts         # Resolves imported functions to call sites
│   ├── synthesizer/
│   │   ├── ast_mutator.ts        # Rewrites AST nodes preserving comments
│   │   ├── prompt_builder.ts     # Constructs targeted LLM prompts for ambiguous logic
│   │   └── patch_generator.ts    # Computes unified git diffs
│   ├── sandbox/
│   │   ├── docker_runner.ts      # Spawns isolated container with repo volume
│   │   ├── test_executor.ts      # Runs npm test / pytest / go test
│   │   └── error_parser.ts       # Parses compiler errors and test assertion failures
│   ├── agent/
│   │   ├── loop.ts               # Iterative heal loop: Run -> Fail -> Fix -> Retry
│   │   └── memory.ts             # Tracks attempts and avoids cyclic regressions
│   ├── git/
│   │   ├── branch_manager.ts     # Creates feature branch (e.g. migrate/stripe-v14)
│   │   └── pr_publisher.ts       # Octokit integration to open GitHub PR
│   ├── server/
│   │   ├── api.ts                # Fastify backend for web UI
│   │   └── sse.ts                # Live migration progress streaming
│   └── cli.ts                    # Commander CLI entrypoint
├── web/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MigrationProgress.tsx # Live step visualizer (Scan -> Patch -> Test)
│   │   │   ├── DiffViewer.tsx        # Side-by-side file changes
│   │   │   ├── TestOutputConsole.tsx # Streaming test execution logs
│   │   │   └── PrPreviewModal.tsx    # Formatted GitHub PR description preview
│   │   ├── hooks/
│   │   │   └── useMigrationStream.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── tests/
│   ├── ast_walker.test.ts
│   └── spec_ingestor.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Implementation Roadmap

### Phase 1: Migration Recipe Specification & OpenAPI Ingestion
- Implement `src/spec/ingestor.ts`:
  - Define declarative migration schema:
    ```json
    {
      "packageName": "openai",
      "fromVersion": "0.28.0",
      "toVersion": "1.0.0",
      "transformations": [
        {
          "type": "METHOD_RENAME",
          "from": "openai.ChatCompletion.create",
          "to": "openai.chat.completions.create"
        },
        {
          "type": "PARAM_RENAME",
          "method": "openai.chat.completions.create",
          "paramMap": { "model_name": "model" }
        }
      ]
    }
    ```
  - Ingest OpenAPI v2 vs v3 diffs to automatically extract changed endpoints and altered parameter names.

### Phase 2: AST Analysis & Precision Callsite Mapping
- Implement `src/scanner/ast_walker.ts` using `@babel/parser` and `@babel/traverse`:
  - Trace `import` statements to determine variable aliases (e.g. `import OpenAI from 'openai'`, `import { Configuration } from 'openai'`).
  - Traverse all AST CallExpressions and MemberExpressions matching target API signatures.
  - Record exact file paths, line numbers, and parameter AST nodes.

### Phase 3: Semantic Patch Synthesis (Recast AST + LLM)
- Implement `src/synthesizer/ast_mutator.ts` using `recast`:
  - Perform mechanical transformations directly on the AST: renaming methods, wrapping arguments in updated options objects, and updating import paths.
  - Guarantee zero modification to unrelated lines, preserving user comments, spacing, and formatting.
- Implement `src/synthesizer/prompt_builder.ts`:
  - For non-trivial logic changes (e.g. asynchronous promise shifts or streaming response handling), isolate the single function AST snippet and prompt the LLM to rewrite only that function.

### Phase 4: Docker-Sandboxed Test-Driven Healing Loop
- Implement `src/sandbox/docker_runner.ts` using `dockerode`:
  - Mount repository clone into a sandboxed container matching the project's runtime (Node.js, Python, or Go).
- Implement `src/agent/loop.ts`:
  - Step 1: Run project's existing test command (`npm test`, `pytest`).
  - Step 2: If tests fail, parse stdout/stderr for exact error messages, file names, and line numbers.
  - Step 3: Dispatch context to LLM: *"The previous patch caused test 'should stream tokens' to fail with error: TypeError: response.on is not a function. Fix this function."*
  - Step 4: Apply fix and re-run tests. Maximum 5 iterations until all tests pass.

### Phase 5: Web Studio, GitHub PR Generator & CLI
- Build modern React 19 interface in `web/`:
  - **Migration Progress Bar**: Real-time progress showing scanned files, modified callsites, and test suite status.
  - **Side-by-Side Diff Viewer**: Monaco-style diff of every changed file.
  - **PR Preview Panel**: Summary of changed files, test coverage confirmation, and breaking change mapping.
- Implement CLI commands:
  - `npx apishift scan --repo ./project --recipe openai-v1`: Lists all callsites needing migration.
  - `npx apishift migrate --repo ./project --recipe openai-v1 --auto-pr`: Runs full pipeline, heals tests, and opens PR.

---

## 4. Agent Kickoff Prompt

```markdown
You are implementing **APIShift**, an agentic API-to-codebase auto-migrator and breaking change healing engine in Node.js 22 + TypeScript + React 19.

### Execution Plan:
1. Initialize the project in `B:\workgit\apishift` with root `package.json`, TypeScript configuration, and dependencies (`recast`, `@babel/parser`, `@babel/traverse`, `dockerode`, `commander`, `fastify`).
2. Implement `src/spec/ingestor.ts` to parse declarative migration recipes and OpenAPI diffs.
3. Implement `src/scanner/ast_walker.ts` to scan TypeScript/JavaScript files and locate all callsites, imports, and method invocations for target libraries.
4. Implement `src/synthesizer/ast_mutator.ts` using Recast to rewrite AST nodes while preserving existing formatting and comments.
5. Implement `src/sandbox/` and `src/agent/loop.ts` to execute test suites in isolated Docker containers and iteratively heal test regressions.
6. Implement `src/git/` to create git branches and open verified GitHub Pull Requests.
7. Build the modern React 19 web studio in `web/` featuring the Migration Progress Visualizer, Side-by-Side Diff Viewer, and Test Console.
8. Implement the CLI in `src/cli.ts` supporting `scan`, `migrate`, and `serve --port 9220`.

Maintain 100% production code without mocks, placeholders, or empty handlers.
```
