import * as recast from 'recast';
import * as babelParser from '@babel/parser';
import _traverse from '@babel/traverse';
import * as t from '@babel/types';
import {
  MigrationRecipe,
  MethodRenameTransformation,
  ParamRenameTransformation,
  ParamWrapOptionsTransformation,
  ImportRenameTransformation,
  ClassInstantiationTransformation,
  ReturnValueAccessTransformation,
} from '../spec/types.js';
import { ImportResolver, FileImportMap } from '../scanner/import_resolver.js';
import { AstWalker, RECAST_PARSE_OPTIONS } from '../scanner/ast_walker.js';

const traverse: any = (_traverse as any).default || _traverse;

export interface MutateFileResult {
  filePath: string;
  originalCode: string;
  modifiedCode: string;
  hasChanges: boolean;
  appliedCount: number;
  appliedTransformations: string[];
}

export class AstMutator {
  public static mutateCode(
    sourceCode: string,
    recipe: MigrationRecipe,
    filePath: string = 'file.ts'
  ): MutateFileResult {
    const ast = recast.parse(sourceCode, RECAST_PARSE_OPTIONS);
    const importMap = ImportResolver.resolveImports(ast, recipe.packageName);

    let appliedCount = 0;
    const appliedTransformations: string[] = [];

    // Filter rules
    const importRules = recipe.transformations.filter(
      (r): r is ImportRenameTransformation => r.type === 'IMPORT_RENAME'
    );
    const ctorRules = recipe.transformations.filter(
      (r): r is ClassInstantiationTransformation => r.type === 'CLASS_INSTANTIATION_RENAME'
    );
    const methodRules = recipe.transformations.filter(
      (r): r is MethodRenameTransformation => r.type === 'METHOD_RENAME'
    );
    const paramRules = recipe.transformations.filter(
      (r): r is ParamRenameTransformation => r.type === 'PARAM_RENAME'
    );
    const wrapRules = recipe.transformations.filter(
      (r): r is ParamWrapOptionsTransformation => r.type === 'PARAM_WRAP_OPTIONS'
    );
    const returnValRules = recipe.transformations.filter(
      (r): r is ReturnValueAccessTransformation => r.type === 'RETURN_VALUE_ACCESS_TRANSFORM'
    );

    // 1. Mutate imports
    if (importRules.length > 0) {
      traverse(ast as any, {
        ImportDeclaration(path: any) {
          const src = path.node.source.value;
          for (const rule of importRules) {
            if (rule.sourcePackage === src) {
              const matchedSpecifiers = path.node.specifiers.filter((spec: any) => {
                if (spec.type === 'ImportSpecifier') {
                  const importedName =
                    spec.imported.type === 'Identifier'
                      ? spec.imported.name
                      : spec.imported.value;
                  return rule.oldImports.includes(importedName);
                }
                return false;
              });

              if (matchedSpecifiers.length > 0) {
                // Remove old specifiers
                path.node.specifiers = path.node.specifiers.filter(
                  (spec: any) => !matchedSpecifiers.includes(spec)
                );

                // Add new specifier
                if (rule.newImport.isDefault) {
                  path.node.specifiers.unshift(
                    t.importDefaultSpecifier(t.identifier(rule.newImport.name))
                  );
                } else {
                  path.node.specifiers.push(
                    t.importSpecifier(
                      t.identifier(rule.newImport.name),
                      t.identifier(rule.newImport.alias || rule.newImport.name)
                    )
                  );
                }

                appliedCount++;
                appliedTransformations.push(`IMPORT_RENAME: updated imports from ${src}`);
              }
            }
          }
        },

        // CommonJS require updates
        VariableDeclarator(path: any) {
          const init = path.node.init;
          if (
            init &&
            init.type === 'CallExpression' &&
            init.callee.type === 'Identifier' &&
            init.callee.name === 'require' &&
            init.arguments.length > 0 &&
            init.arguments[0].type === 'StringLiteral'
          ) {
            const src = init.arguments[0].value;
            for (const rule of importRules) {
              if (rule.sourcePackage === src) {
                if (path.node.id.type === 'ObjectPattern') {
                  const hasOldImports = path.node.id.properties.some((p: any) => {
                    if (p.type === 'ObjectProperty') {
                      const name =
                        p.key.type === 'Identifier' ? p.key.name : (p.key as any).value;
                      return rule.oldImports.includes(name);
                    }
                    return false;
                  });

                  if (hasOldImports) {
                    // Replace { Configuration, OpenAIApi } with { OpenAI }
                    path.node.id = t.objectPattern([
                      t.objectProperty(
                        t.identifier(rule.newImport.name),
                        t.identifier(rule.newImport.alias || rule.newImport.name),
                        false,
                        true
                      ),
                    ]);
                    appliedCount++;
                    appliedTransformations.push(`IMPORT_RENAME: updated require from ${src}`);
                  }
                }
              }
            }
          }
        },
      });
    }

    // 2. Mutate Class Instantiations (e.g. new OpenAIApi(new Configuration({ apiKey })))
    if (ctorRules.length > 0) {
      traverse(ast as any, {
        NewExpression(path: any) {
          const calleeStr = AstWalker.getCalleeString(path.node.callee);
          for (const rule of ctorRules) {
            const isMatch =
              calleeStr === rule.oldClass ||
              calleeStr.endsWith(`.${rule.oldClass}`) ||
              Array.from(importMap.symbols.values()).some(
                sym => sym.importedName === rule.oldClass && sym.localName === calleeStr
              );

            if (isMatch) {
              if (rule.unwrapToArgument && path.node.arguments.length > 0) {
                path.replaceWith(path.node.arguments[0]);
                appliedCount++;
                appliedTransformations.push(
                  `CLASS_INSTANTIATION_RENAME: unwrapped new ${calleeStr}(opts) to plain options`
                );
                break;
              }

              // Update callee identifier to newClass
              path.node.callee = AstMutator.buildMemberOrIdentifier(rule.newClass);

              // Simplify constructor arg if required
              // e.g. new OpenAIApi(new Configuration({ apiKey: '...' })) -> new OpenAI({ apiKey: '...' })
              if (rule.simplifyConstructorArg && path.node.arguments.length > 0) {
                const firstArg = path.node.arguments[0];
                if (
                  firstArg.type === 'NewExpression' &&
                  AstWalker.getCalleeString(firstArg.callee).includes('Configuration') &&
                  firstArg.arguments.length > 0
                ) {
                  path.node.arguments = [firstArg.arguments[0]];
                }
              }

              appliedCount++;
              appliedTransformations.push(
                `CLASS_INSTANTIATION_RENAME: ${calleeStr} -> ${rule.newClass}`
              );
            }
          }
        },
      });
    }

    // 3. Mutate Method Invocations (e.g. openai.ChatCompletion.create -> openai.chat.completions.create)
    if (methodRules.length > 0) {
      traverse(ast as any, {
        CallExpression(path: any) {
          const calleeStr = AstWalker.getCalleeString(path.node.callee);
          for (const rule of methodRules) {
            if (AstWalker.isMethodMatch(calleeStr, rule.from, importMap)) {
              // Extract receiver prefix if any
              const targetToParts = rule.to.split('.');
              const fromParts = rule.from.split('.');
              const calleeParts = calleeStr.split('.');

              let newCalleeStr = rule.to;
              if (calleeParts.length > 0 && fromParts.length > 0) {
                // If caller used a custom variable name, e.g. `client.ChatCompletion.create`
                // replace leading namespace with caller's variable
                const callerPrefix = calleeParts[0];
                const fromPrefix = fromParts[0];
                if (targetToParts[0] === fromPrefix && callerPrefix !== fromPrefix) {
                  newCalleeStr = [callerPrefix, ...targetToParts.slice(1)].join('.');
                }
              }

              path.node.callee = AstMutator.buildMemberOrIdentifier(newCalleeStr);
              appliedCount++;
              appliedTransformations.push(`METHOD_RENAME: ${calleeStr} -> ${newCalleeStr}`);
              break;
            }
          }
        },
      });
    }

    // 4. Mutate Parameters (e.g. model_name -> model)
    if (paramRules.length > 0) {
      traverse(ast as any, {
        CallExpression(path: any) {
          const calleeStr = AstWalker.getCalleeString(path.node.callee);
          for (const rule of paramRules) {
            // Check if callee matches the rule method or its target renamed method
            const isMatch =
              AstWalker.isMethodMatch(calleeStr, rule.method, importMap) ||
              calleeStr.endsWith(rule.method.split('.').slice(-2).join('.'));

            if (isMatch && path.node.arguments.length > 0) {
              const arg = path.node.arguments[0];
              if (arg.type === 'ObjectExpression') {
                let mutatedAnyProp = false;
                for (const prop of arg.properties) {
                  if (prop.type === 'ObjectProperty') {
                    const keyName =
                      prop.key.type === 'Identifier'
                        ? prop.key.name
                        : prop.key.type === 'StringLiteral'
                        ? prop.key.value
                        : '';

                    if (keyName && rule.paramMap[keyName]) {
                      const newKey = rule.paramMap[keyName];
                      prop.key = t.identifier(newKey);
                      mutatedAnyProp = true;
                      appliedCount++;
                      appliedTransformations.push(
                        `PARAM_RENAME: in ${calleeStr} renamed ${keyName} -> ${newKey}`
                      );
                    }
                  }
                }
              }
            }
          }
        },
      });
    }

    // 5. Mutate Parameter Wrap Options (e.g. idempotencyKey into secondary options object)
    if (wrapRules.length > 0) {
      traverse(ast as any, {
        CallExpression(path: any) {
          const calleeStr = AstWalker.getCalleeString(path.node.callee);
          for (const rule of wrapRules) {
            const isMatch =
              AstWalker.isMethodMatch(calleeStr, rule.method, importMap) ||
              calleeStr.endsWith(rule.method.split('.').slice(-2).join('.'));

            if (isMatch && path.node.arguments.length > 0) {
              const firstArg = path.node.arguments[0];
              if (firstArg.type === 'ObjectExpression') {
                const wrapFieldsSet = new Set(rule.wrapFields);
                const extractedProperties: t.ObjectProperty[] = [];

                firstArg.properties = firstArg.properties.filter((prop: any) => {
                  if (prop.type === 'ObjectProperty') {
                    const keyName =
                      prop.key.type === 'Identifier'
                        ? prop.key.name
                        : prop.key.type === 'StringLiteral'
                        ? prop.key.value
                        : '';
                    if (wrapFieldsSet.has(keyName)) {
                      extractedProperties.push(prop);
                      return false;
                    }
                  }
                  return true;
                });

                if (extractedProperties.length > 0) {
                  const optionsArg = t.objectExpression(extractedProperties);
                  if (path.node.arguments.length <= rule.optionsParamIndex) {
                    path.node.arguments.push(optionsArg);
                  } else {
                    const existingOptions = path.node.arguments[rule.optionsParamIndex];
                    if (existingOptions.type === 'ObjectExpression') {
                      existingOptions.properties.push(...extractedProperties);
                    }
                  }
                  appliedCount++;
                  appliedTransformations.push(
                    `PARAM_WRAP_OPTIONS: wrapped ${extractedProperties.length} options in ${calleeStr}`
                  );
                }
              }
            }
          }
        },
      });
    }

    // 6. Mutate Return Value Property Access (e.g. response.data.choices -> response.choices)
    if (returnValRules.length > 0) {
      traverse(ast as any, {
        MemberExpression(path: any) {
          for (const rule of returnValRules) {
            if (rule.stripPropertyPrefix) {
              const prop = path.node.property;
              const propName = prop.type === 'Identifier' ? prop.name : '';
              if (propName === rule.stripPropertyPrefix) {
                // If this is accessed as `foo.data.bar`
                // we want the parent MemberExpression to access `foo.bar` directly
                const parentPath = path.parentPath;
                if (
                  parentPath &&
                  parentPath.node.type === 'MemberExpression' &&
                  parentPath.node.object === path.node
                ) {
                  parentPath.node.object = path.node.object;
                  appliedCount++;
                  appliedTransformations.push(
                    `RETURN_VALUE_ACCESS_TRANSFORM: stripped .${rule.stripPropertyPrefix}`
                  );
                }
              }
            }
          }
        },
      });
    }

    const modifiedCode = recast.print(ast).code;
    const hasChanges = modifiedCode !== sourceCode;

    return {
      filePath,
      originalCode: sourceCode,
      modifiedCode,
      hasChanges,
      appliedCount,
      appliedTransformations,
    };
  }

  public static buildMemberOrIdentifier(chainStr: string): any {
    const parts = chainStr.split('.');
    if (parts.length === 1) {
      return t.identifier(parts[0]);
    }

    let node: any = t.identifier(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      node = t.memberExpression(node, t.identifier(parts[i]));
    }
    return node;
  }
}
