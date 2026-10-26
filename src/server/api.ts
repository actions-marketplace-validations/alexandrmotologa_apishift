import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SpecIngestor } from '../spec/ingestor.js';
import { OpenApiDiffer } from '../spec/openapi_differ.js';
import { CallGraph } from '../scanner/call_graph.js';
import { MigrationAgent } from '../agent/loop.js';
import { BranchManager } from '../git/branch_manager.js';
import { PrPublisher } from '../git/pr_publisher.js';
import { SseManager } from './sse.js';
import { SandboxMode } from '../sandbox/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
  defaultRepo?: string;
}

export class ApiServer {
  private app: FastifyInstance;
  private port: number;
  private host: string;
  private latestResult: any = null;

  constructor(options: ServerOptions = {}) {
    this.port = options.port || 9220;
    this.host = options.host || '0.0.0.0';
    this.app = fastify({ logger: false });
  }

  public async start(): Promise<string> {
    await this.app.register(cors, { origin: '*' });

    // Register API routes
    this.registerRoutes();

    // Serve static files from web/dist if present
    const webDistPath = path.resolve(__dirname, '../../web/dist');
    if (fs.existsSync(webDistPath)) {
      await this.app.register(fastifyStatic, {
        root: webDistPath,
        prefix: '/',
      });
      this.app.setNotFoundHandler((req, reply) => {
        if (req.raw.url && !req.raw.url.startsWith('/api')) {
          return reply.sendFile('index.html');
        }
        return reply.status(404).send({ error: 'Not found' });
      });
    }

    const address = await this.app.listen({ port: this.port, host: this.host });
    return address;
  }

  public async stop(): Promise<void> {
    await this.app.close();
  }

  private registerRoutes(): void {
    // Health check
    this.app.get('/api/health', async () => {
      return { status: 'ok', name: 'APIShift Studio Server', time: new Date().toISOString() };
    });

    // List built-in recipes
    this.app.get('/api/recipes', async () => {
      const recipes = SpecIngestor.listBuiltinRecipes();
      return { recipes };
    });

    // Save custom recipe
    this.app.post('/api/recipes', async (request, reply) => {
      try {
        const body = request.body as any;
        const validated = SpecIngestor.validate(body);
        const targetPath = path.resolve(process.cwd(), `${validated.id}.json`);
        SpecIngestor.saveRecipe(targetPath, validated);
        return { success: true, recipe: validated, savedPath: targetPath };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    });

    // OpenAPI Diff
    this.app.post('/api/diff-openapi', async (request, reply) => {
      try {
        const body = request.body as { oldSpec: any; newSpec: any };
        if (!body.oldSpec || !body.newSpec) {
          return reply.status(400).send({ error: 'Both oldSpec and newSpec are required.' });
        }
        const diffResult = OpenApiDiffer.diff(body.oldSpec, body.newSpec);
        return diffResult;
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    // Scan AST
    this.app.post('/api/scan', async (request, reply) => {
      try {
        const body = request.body as { repoPath: string; recipeIdOrPath: string };
        const recipe = SpecIngestor.loadRecipe(body.recipeIdOrPath);
        const scanSummary = CallGraph.scanRepository(body.repoPath, recipe);
        return { success: true, recipe, scanSummary };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    });

    // Migrate with live events
    this.app.post('/api/migrate', async (request, reply) => {
      try {
        const body = request.body as {
          repoPath: string;
          recipeIdOrPath: string;
          testCommand?: string;
          sandboxMode?: SandboxMode;
          dryRun?: boolean;
          maxIterations?: number;
        };

        const recipe = SpecIngestor.loadRecipe(body.recipeIdOrPath);

        const result = await MigrationAgent.run({
          repoPath: body.repoPath,
          recipe,
          testCommand: body.testCommand || 'npm test',
          sandboxMode: body.sandboxMode || 'auto',
          dryRun: body.dryRun ?? false,
          maxIterations: body.maxIterations || 5,
          onEvent: (event) => {
            SseManager.broadcast('migration-event', event);
          },
        });

        this.latestResult = { recipe, result, repoPath: body.repoPath };
        return { success: true, result };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    // Create GitHub PR
    this.app.post('/api/pr', async (request, reply) => {
      try {
        const body = request.body as {
          repoPath: string;
          recipeIdOrPath: string;
          commitMessage?: string;
          token?: string;
        };

        const targetRepo = body.repoPath || (this.latestResult ? this.latestResult.repoPath : '');
        if (!targetRepo) {
          return reply.status(400).send({ error: 'Repository path is required' });
        }

        const recipe = SpecIngestor.loadRecipe(body.recipeIdOrPath);

        if (!this.latestResult || !this.latestResult.result) {
          return reply.status(400).send({ error: 'No recent migration result available to create PR for.' });
        }

        // Create branch & commit
        const branchName = BranchManager.createMigrationBranch(
          targetRepo,
          recipe.packageName,
          recipe.toVersion
        );

        const commitMsg =
          body.commitMessage ||
          `refactor(api): migrate ${recipe.packageName} to v${recipe.toVersion}`;

        const branchResult = BranchManager.commitChanges(
          targetRepo,
          this.latestResult.result.mutatedFiles,
          commitMsg
        );

        // Open PR
        const prResult = await PrPublisher.createPullRequest({
          repoPath: targetRepo,
          recipe,
          migrationResult: this.latestResult.result,
          token: body.token,
        });

        return {
          success: true,
          branchResult,
          prResult,
        };
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    // SSE Event Stream
    this.app.get('/api/events', async (request, reply) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      SseManager.addClient(clientId, reply);
    });
  }
}
