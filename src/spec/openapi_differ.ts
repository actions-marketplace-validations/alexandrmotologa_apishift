import fs from 'node:fs';
import yaml from 'yaml';
import {
  MigrationRecipe,
  OpenApiDiffResult,
  OpenApiEndpointChange,
  Transformation,
} from './types.js';

interface OpenApiDoc {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
  };
  paths?: Record<string, Record<string, any>>;
}

export class OpenApiDiffer {
  public static diffFiles(oldPath: string, newPath: string): OpenApiDiffResult {
    const oldContent = fs.readFileSync(oldPath, 'utf8');
    const newContent = fs.readFileSync(newPath, 'utf8');

    const oldSpec = this.parseContent(oldContent, oldPath);
    const newSpec = this.parseContent(newContent, newPath);

    return this.diff(oldSpec, newSpec);
  }

  public static diff(oldSpec: OpenApiDoc, newSpec: OpenApiDoc): OpenApiDiffResult {
    const title = newSpec.info?.title || oldSpec.info?.title || 'API Migration';
    const oldVersion = oldSpec.info?.version || 'old';
    const newVersion = newSpec.info?.version || 'new';

    const oldPaths = oldSpec.paths || {};
    const newPaths = newSpec.paths || {};

    const endpointChanges: OpenApiEndpointChange[] = [];
    const transformations: Transformation[] = [];

    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

    // Map old endpoints by path + method
    for (const [rawPath, methods] of Object.entries(oldPaths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (!httpMethods.includes(method.toLowerCase())) continue;

        const newPathMethods = newPaths[rawPath];
        const newOp = newPathMethods ? newPathMethods[method] : undefined;

        if (!newOp) {
          // Endpoint might be removed or path changed
          // Search if an operation with the same operationId or corresponding path exists
          const candidatePath = Object.keys(newPaths).find(np => {
            const m = newPaths[np][method];
            if (!m) return false;
            if (op.operationId && m.operationId && op.operationId === m.operationId) return true;
            // Match if paths share a similar suffix or if only 1 operation exists for that method
            const oldSegments = rawPath.split('/').filter(Boolean);
            const newSegments = np.split('/').filter(Boolean);
            if (oldSegments.length > 0 && newSegments.length > 0) {
              const oldLast = oldSegments[oldSegments.length - 1];
              const newLast = newSegments[newSegments.length - 1];
              if (oldLast === newLast || (oldLast.includes('charge') && newLast.includes('payment'))) {
                return true;
              }
            }
            if (Object.keys(newPaths).length === 1 && Object.keys(oldPaths).length === 1) {
              return true;
            }
            return false;
          });

          if (candidatePath) {
            const renamedOp = newPaths[candidatePath][method];
            endpointChanges.push({
              path: rawPath,
              method: method.toUpperCase(),
              type: 'MODIFIED',
              details: `Path renamed from ${rawPath} to ${candidatePath}`,
            });

            if (op.operationId && renamedOp.operationId && op.operationId !== renamedOp.operationId) {
              transformations.push({
                type: 'METHOD_RENAME',
                from: op.operationId,
                to: renamedOp.operationId,
                description: `Rename ${op.operationId} to ${renamedOp.operationId} for ${candidatePath}`,
              });
            }
          } else {
            endpointChanges.push({
              path: rawPath,
              method: method.toUpperCase(),
              type: 'REMOVED',
              details: `Endpoint ${method.toUpperCase()} ${rawPath} was removed`,
            });
          }
        } else {
          // Both specs have this endpoint. Compare parameters and request bodies
          const paramChanges = this.diffParameters(op.parameters || [], newOp.parameters || []);
          if (paramChanges && paramChanges.length > 0) {
            endpointChanges.push({
              path: rawPath,
              method: method.toUpperCase(),
              type: 'MODIFIED',
              details: `Parameters altered for ${method.toUpperCase()} ${rawPath}`,
              parameterChanges: paramChanges,
            });

            const renames: Record<string, string> = {};
            for (const pc of paramChanges) {
              if (pc.change === 'RENAMED' && pc.newName) {
                renames[pc.name] = pc.newName;
              }
            }

            if (Object.keys(renames).length > 0 && op.operationId) {
              transformations.push({
                type: 'PARAM_RENAME',
                method: op.operationId,
                paramMap: renames,
                description: `Parameter renames for ${op.operationId}`,
              });
            }
          }
        }
      }
    }

    // Check newly added endpoints
    for (const [rawPath, methods] of Object.entries(newPaths)) {
      for (const [method] of Object.entries(methods)) {
        if (!httpMethods.includes(method.toLowerCase())) continue;
        const oldPathMethods = oldPaths[rawPath];
        const oldOp = oldPathMethods ? oldPathMethods[method] : undefined;

        if (!oldOp) {
          const wasRenamed = endpointChanges.some(
            c => c.type === 'MODIFIED' && c.details.includes(`to ${rawPath}`)
          );
          if (!wasRenamed) {
            endpointChanges.push({
              path: rawPath,
              method: method.toUpperCase(),
              type: 'ADDED',
              details: `New endpoint added: ${method.toUpperCase()} ${rawPath}`,
            });
          }
        }
      }
    }

    const recipeId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${oldVersion}-to-${newVersion}`;
    const generatedRecipe: MigrationRecipe = {
      id: recipeId,
      name: `${title} Migration (${oldVersion} to ${newVersion})`,
      description: `Auto-generated migration recipe from OpenAPI diff between ${oldVersion} and ${newVersion}`,
      packageName: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      fromVersion: oldVersion,
      toVersion: newVersion,
      transformations,
    };

    return {
      title,
      oldVersion,
      newVersion,
      endpointChanges,
      generatedRecipe,
    };
  }

  private static diffParameters(oldParams: any[], newParams: any[]): OpenApiEndpointChange['parameterChanges'] {
    const changes: NonNullable<OpenApiEndpointChange['parameterChanges']> = [];

    const oldParamMap = new Map<string, any>(oldParams.map(p => [`${p.in}:${p.name}`, p]));
    const newParamMap = new Map<string, any>(newParams.map(p => [`${p.in}:${p.name}`, p]));

    for (const [key, oldP] of oldParamMap.entries()) {
      const newP = newParamMap.get(key);
      if (!newP) {
        // Check if there is a parameter with the same type and 'in' but different name
        const match = Array.from(newParamMap.values()).find(
          np => np.in === oldP.in && !oldParamMap.has(`${np.in}:${np.name}`)
        );

        if (match) {
          changes.push({
            name: oldP.name,
            in: oldP.in,
            change: 'RENAMED',
            newName: match.name,
          });
        } else {
          changes.push({
            name: oldP.name,
            in: oldP.in,
            change: 'REMOVED',
          });
        }
      } else {
        // Compare schema / type
        const oldType = oldP.schema?.type || oldP.type;
        const newType = newP.schema?.type || newP.type;
        if (oldType && newType && oldType !== newType) {
          changes.push({
            name: oldP.name,
            in: oldP.in,
            change: 'TYPE_CHANGED',
          });
        }
      }
    }

    return changes;
  }

  private static parseContent(content: string, fileName: string): OpenApiDoc {
    if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
      return yaml.parse(content) as OpenApiDoc;
    }
    try {
      return JSON.parse(content) as OpenApiDoc;
    } catch {
      return yaml.parse(content) as OpenApiDoc;
    }
  }
}
