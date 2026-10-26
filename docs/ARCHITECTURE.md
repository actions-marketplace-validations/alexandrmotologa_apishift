# APIShift Technical Architecture

APIShift is an autonomous API migration and breaking change healing engine. It ingests API specifications and SDK deprecation manifests, scans codebase Abstract Syntax Trees (ASTs), synthesizes style-preserving code transformations, executes local test suites in isolated sandboxes, and iteratively heals regressions until all tests pass.

---

## High level pipeline

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

## 1. Specification ingestion

The specification layer in `src/spec/` provides two inputs:
- Declarative JSON/YAML recipes defining method renames, parameter remapping, import specifier updates, options object wrapping, and deprecation notes.
- OpenAPI differ (`src/spec/openapi_differ.ts`) which compares two versions of an OpenAPI 3.x / Swagger 2.0 specification, detects path modifications and parameter alterations, and auto-generates a migration recipe.

---

## 2. AST codebase scanning

The scanner in `src/scanner/` maps API dependencies across the repository:
- `ImportResolver`: identifies ESM default, named, and namespace imports, as well as CommonJS `require` statements. Maps local variable aliases to target package symbols.
- `AstWalker`: traverses Babel AST nodes for `CallExpression`, `MemberExpression`, `NewExpression`, and property accesses.
- `CallGraph`: scans files recursively while filtering ignored directories (`node_modules`, `dist`, `.git`), gathering call sites and lines of code affected.

---

## 3. Style-preserving patch synthesis

The synthesizer in `src/synthesizer/` uses Recast to parse and print code. Recast maintains original tokens and whitespace for untouched code, modifying only target AST nodes:
- Replaces import specifiers and updates CommonJS destructuring.
- Renames constructor calls and unwraps legacy options wrappers.
- Rewrites method chains, parameter keys, and options arguments.
- Strips obsolete response properties (such as legacy `.data` wrappers).
- Generates standard unified diffs via the `diff` library.

---

## 4. Sandboxed test-driven self-healing loop

The healing engine in `src/sandbox/` and `src/agent/` executes the test suite after each mutation:
- Dual-mode sandbox execution:
  - Docker mode: uses `dockerode` to run tests inside an isolated container with volume bindings when Docker is active.
  - Local process mode: runs commands with process isolation, environment controls, and timeout protection when Docker daemon is not active.
- `ErrorParser`: extracts structured errors from compiler outputs and test runners (TypeScript `TS2339`/`TS2554`, Jest, Vitest, Node test runner).
- `AgentMemory`: records error signatures to detect and avoid cyclic regressions.
- Iterative healing loop: applies targeted AST and heuristic repairs, re-running tests until 100% of test suites pass on green.

---

## 5. Web review studio and PR automation

- Fastify server with Server-Sent Events (`src/server/`) streams live migration steps to the browser.
- React 19 web studio (`web/`) provides real-time progress indicators, file diff trees, live consoles, and recipe editors.
- Branch manager and PR publisher (`src/git/`) create git branches, stage conventional commits, and publish pull requests with test execution logs.
