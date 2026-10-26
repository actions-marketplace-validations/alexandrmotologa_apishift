import * as recast from 'recast';
import * as babelParser from '@babel/parser';
import _traverse from '@babel/traverse';
import { ImportResolver, FileImportMap } from './import_resolver.js';
import {
  MigrationRecipe,
  MethodRenameTransformation,
  ParamRenameTransformation,
  ClassInstantiationTransformation,
  ImportRenameTransformation,
  ReturnValueAccessTransformation,
} from '../spec/types.js';

const traverse: any = (_traverse as any).default || _traverse;

export const BABEL_PARSER_OPTIONS: babelParser.ParserOptions = {
  sourceType: 'module',
  plugins: [
    'typescript',
    'jsx',
    'decorators-legacy',
    'classProperties',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'nullishCoalescingOperator',
    'optionalChaining',
  ],
};

export const RECAST_PARSE_OPTIONS = {
  parser: {
    parse(source: string) {
      return babelParser.parse(source, BABEL_PARSER_OPTIONS);
    },
  },
};

export interface ScannedCallSite {
  id: string;
  filePath: string;
  line: number;
  column: number;
  callee: string;
  kind: 'METHOD_CALL' | 'CONSTRUCTOR' | 'IMPORT' | 'PROPERTY_ACCESS';
  rawSnippet: string;
  transformationType: string;
  matchedRule: any;
  node: any;
}

export interface ScanFileResult {
  filePath: string;
  callsites: ScannedCallSite[];
  importMap: FileImportMap;
  ast: any;
  sourceCode: string;
}

export class AstWalker {
  public static parseSource(code: string): any {
    return recast.parse(code, RECAST_PARSE_OPTIONS);
  }

  public static scanFile(filePath: string, sourceCode: string, recipe: MigrationRecipe): ScanFileResult {
    const ast = this.parseSource(sourceCode);
    const importMap = ImportResolver.resolveImports(ast, recipe.packageName);

    const callsites: ScannedCallSite[] = [];
    let counter = 0;

    const methodRenameRules = recipe.transformations.filter(
      (t): t is MethodRenameTransformation => t.type === 'METHOD_RENAME'
    );
    const classRenameRules = recipe.transformations.filter(
      (t): t is ClassInstantiationTransformation => t.type === 'CLASS_INSTANTIATION_RENAME'
    );
    const importRenameRules = recipe.transformations.filter(
      (t): t is ImportRenameTransformation => t.type === 'IMPORT_RENAME'
    );
    const paramRenameRules = recipe.transformations.filter(
      (t): t is ParamRenameTransformation => t.type === 'PARAM_RENAME'
    );
    const returnValueRules = recipe.transformations.filter(
      (t): t is ReturnValueAccessTransformation => t.type === 'RETURN_VALUE_ACCESS_TRANSFORM'
    );

    traverse(ast as any, {
      ImportDeclaration(path: any) {
        const sourcePkg = path.node.source.value;
        for (const rule of importRenameRules) {
          if (rule.sourcePackage === sourcePkg) {
            const hasTargetImports = path.node.specifiers.some((spec: any) => {
              if (spec.type === 'ImportSpecifier') {
                const name =
                  spec.imported.type === 'Identifier'
                    ? spec.imported.name
                    : spec.imported.value;
                return rule.oldImports.includes(name);
              }
              return false;
            });

            if (hasTargetImports) {
              const loc = path.node.loc?.start || { line: 1, column: 0 };
              callsites.push({
                id: `import-${++counter}`,
                filePath,
                line: loc.line,
                column: loc.column,
                callee: sourcePkg,
                kind: 'IMPORT',
                rawSnippet: recast.print(path.node).code,
                transformationType: 'IMPORT_RENAME',
                matchedRule: rule,
                node: path.node,
              });
            }
          }
        }
      },

      NewExpression(path: any) {
        const calleeStr = AstWalker.getCalleeString(path.node.callee);
        for (const rule of classRenameRules) {
          // Check if callee matches oldClass or an imported alias
          const isMatch =
            calleeStr === rule.oldClass ||
            calleeStr.endsWith(`.${rule.oldClass}`) ||
            Array.from(importMap.symbols.values()).some(
              sym => sym.importedName === rule.oldClass && sym.localName === calleeStr
            );

          if (isMatch) {
            const loc = path.node.loc?.start || { line: 1, column: 0 };
            callsites.push({
              id: `ctor-${++counter}`,
              filePath,
              line: loc.line,
              column: loc.column,
              callee: calleeStr,
              kind: 'CONSTRUCTOR',
              rawSnippet: recast.print(path.node).code,
              transformationType: 'CLASS_INSTANTIATION_RENAME',
              matchedRule: rule,
              node: path.node,
            });
          }
        }
      },

      CallExpression(path: any) {
        const calleeStr = AstWalker.getCalleeString(path.node.callee);

        // Check method renames
        for (const rule of methodRenameRules) {
          const match = AstWalker.isMethodMatch(calleeStr, rule.from, importMap);
          if (match) {
            const loc = path.node.loc?.start || { line: 1, column: 0 };
            callsites.push({
              id: `method-${++counter}`,
              filePath,
              line: loc.line,
              column: loc.column,
              callee: calleeStr,
              kind: 'METHOD_CALL',
              rawSnippet: recast.print(path.node).code,
              transformationType: 'METHOD_RENAME',
              matchedRule: rule,
              node: path.node,
            });
            break;
          }
        }

        // Check param renames
        for (const rule of paramRenameRules) {
          const match = AstWalker.isMethodMatch(calleeStr, rule.method, importMap);
          if (match && path.node.arguments.length > 0) {
            const loc = path.node.loc?.start || { line: 1, column: 0 };
            callsites.push({
              id: `param-${++counter}`,
              filePath,
              line: loc.line,
              column: loc.column,
              callee: calleeStr,
              kind: 'METHOD_CALL',
              rawSnippet: recast.print(path.node).code,
              transformationType: 'PARAM_RENAME',
              matchedRule: rule,
              node: path.node,
            });
            break;
          }
        }
      },

      MemberExpression(path: any) {
        // Check return value property access like response.data.choices
        for (const rule of returnValueRules) {
          if (rule.stripPropertyPrefix) {
            const propName =
              path.node.property.type === 'Identifier' ? path.node.property.name : '';
            if (propName === rule.stripPropertyPrefix) {
              // Check if parent or context comes from target call
              const parentObj = path.node.object;
              if (parentObj.type === 'Identifier') {
                const loc = path.node.loc?.start || { line: 1, column: 0 };
                callsites.push({
                  id: `prop-${++counter}`,
                  filePath,
                  line: loc.line,
                  column: loc.column,
                  callee: `${parentObj.name}.${propName}`,
                  kind: 'PROPERTY_ACCESS',
                  rawSnippet: recast.print(path.node).code,
                  transformationType: 'RETURN_VALUE_ACCESS_TRANSFORM',
                  matchedRule: rule,
                  node: path.node,
                });
              }
            }
          }
        }
      },
    });

    return {
      filePath,
      callsites,
      importMap,
      ast,
      sourceCode,
    };
  }

  public static getCalleeString(node: any): string {
    if (!node) return '';
    if (node.type === 'Identifier') {
      return node.name;
    }
    if (node.type === 'MemberExpression') {
      const obj = this.getCalleeString(node.object);
      const prop = node.property.type === 'Identifier' ? node.property.name : '';
      return obj ? `${obj}.${prop}` : prop;
    }
    return '';
  }

  public static isMethodMatch(calleeStr: string, targetFrom: string, importMap: FileImportMap): boolean {
    if (!calleeStr) return false;

    // Direct match (e.g. "openai.ChatCompletion.create" === "openai.ChatCompletion.create")
    if (calleeStr === targetFrom) return true;

    // Target from could be namespaced, e.g. "openai.ChatCompletion.create"
    // But caller might have imported ChatCompletion directly: "ChatCompletion.create"
    const parts = targetFrom.split('.');
    const tail2 = parts.slice(-2).join('.'); // ChatCompletion.create
    const tail1 = parts.slice(-1)[0]; // create

    if (calleeStr === tail2) {
      return true;
    }

    // Check if receiver is an instance or alias
    // e.g. targetFrom: "openai.chat.completions.create" or "openai.ChatCompletion.create"
    // calleeStr could be "ai.ChatCompletion.create" or "client.ChatCompletion.create"
    const calleeParts = calleeStr.split('.');
    if (calleeParts.length >= 2 && parts.length >= 2) {
      const calleeTail = calleeParts.slice(1).join('.');
      const targetTail = parts.slice(1).join('.');
      if (calleeTail === targetTail) {
        return true;
      }
    }

    // Check imported symbol aliases
    for (const [, sym] of importMap.symbols.entries()) {
      if (targetFrom.startsWith(sym.importedName)) {
        const suffix = targetFrom.slice(sym.importedName.length);
        if (calleeStr === `${sym.localName}${suffix}`) {
          return true;
        }
      }
    }

    return false;
  }
}
