import type { Node } from '@babel/types';
import _traverse from '@babel/traverse';

const traverse: any = (_traverse as any).default || _traverse;

export interface ImportedSymbol {
  localName: string;
  importedName: string;
  sourcePackage: string;
  isDefault: boolean;
  isNamespace: boolean;
  isRequire: boolean;
}

export interface FileImportMap {
  symbols: Map<string, ImportedSymbol>;
  packages: Set<string>;
}

export class ImportResolver {
  public static resolveImports(ast: Node, targetPackage?: string): FileImportMap {
    const symbols = new Map<string, ImportedSymbol>();
    const packages = new Set<string>();

    traverse(ast as any, {
      ImportDeclaration(path: any) {
        const sourcePkg = path.node.source.value;
        if (targetPackage && sourcePkg !== targetPackage && !sourcePkg.startsWith(`${targetPackage}/`)) {
          return;
        }

        packages.add(sourcePkg);

        for (const specifier of path.node.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier') {
            symbols.set(specifier.local.name, {
              localName: specifier.local.name,
              importedName: 'default',
              sourcePackage: sourcePkg,
              isDefault: true,
              isNamespace: false,
              isRequire: false,
            });
          } else if (specifier.type === 'ImportNamespaceSpecifier') {
            symbols.set(specifier.local.name, {
              localName: specifier.local.name,
              importedName: '*',
              sourcePackage: sourcePkg,
              isDefault: false,
              isNamespace: true,
              isRequire: false,
            });
          } else if (specifier.type === 'ImportSpecifier') {
            const importedName =
              specifier.imported.type === 'Identifier'
                ? specifier.imported.name
                : specifier.imported.value;
            symbols.set(specifier.local.name, {
              localName: specifier.local.name,
              importedName,
              sourcePackage: sourcePkg,
              isDefault: false,
              isNamespace: false,
              isRequire: false,
            });
          }
        }
      },

      VariableDeclarator(path: any) {
        // Handle CommonJS require: const OpenAI = require('openai') or const { Configuration } = require('openai')
        const init = path.node.init;
        if (
          init &&
          init.type === 'CallExpression' &&
          init.callee.type === 'Identifier' &&
          init.callee.name === 'require' &&
          init.arguments.length > 0 &&
          init.arguments[0].type === 'StringLiteral'
        ) {
          const sourcePkg = init.arguments[0].value;
          if (targetPackage && sourcePkg !== targetPackage && !sourcePkg.startsWith(`${targetPackage}/`)) {
            return;
          }

          packages.add(sourcePkg);

          if (path.node.id.type === 'Identifier') {
            symbols.set(path.node.id.name, {
              localName: path.node.id.name,
              importedName: 'default',
              sourcePackage: sourcePkg,
              isDefault: true,
              isNamespace: false,
              isRequire: true,
            });
          } else if (path.node.id.type === 'ObjectPattern') {
            for (const prop of path.node.id.properties) {
              if (prop.type === 'ObjectProperty' && prop.value.type === 'Identifier') {
                const importedName =
                  prop.key.type === 'Identifier' ? prop.key.name : (prop.key as any).value;
                symbols.set(prop.value.name, {
                  localName: prop.value.name,
                  importedName,
                  sourcePackage: sourcePkg,
                  isDefault: false,
                  isNamespace: false,
                  isRequire: true,
                });
              }
            }
          }
        }
      },
    });

    return { symbols, packages };
  }
}
