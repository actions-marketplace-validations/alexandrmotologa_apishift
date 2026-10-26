export type TransformationType =
  | 'METHOD_RENAME'
  | 'PARAM_RENAME'
  | 'PARAM_WRAP_OPTIONS'
  | 'IMPORT_RENAME'
  | 'CLASS_INSTANTIATION_RENAME'
  | 'RETURN_VALUE_ACCESS_TRANSFORM'
  | 'DEPRECATED_WARN';

export interface BaseTransformation {
  type: TransformationType;
  description?: string;
}

export interface MethodRenameTransformation extends BaseTransformation {
  type: 'METHOD_RENAME';
  from: string;
  to: string;
}

export interface ParamRenameTransformation extends BaseTransformation {
  type: 'PARAM_RENAME';
  method: string;
  paramMap: Record<string, string>;
}

export interface ParamWrapOptionsTransformation extends BaseTransformation {
  type: 'PARAM_WRAP_OPTIONS';
  method: string;
  optionsParamIndex: number;
  wrapFields: string[];
  optionsKey?: string;
}

export interface ImportRenameTransformation extends BaseTransformation {
  type: 'IMPORT_RENAME';
  sourcePackage: string;
  oldImports: string[];
  newImport: {
    isDefault?: boolean;
    name: string;
    alias?: string;
  };
  removeImports?: string[];
}

export interface ClassInstantiationTransformation extends BaseTransformation {
  type: 'CLASS_INSTANTIATION_RENAME';
  oldClass: string;
  newClass: string;
  simplifyConstructorArg?: boolean;
  unwrapToArgument?: boolean;
}

export interface ReturnValueAccessTransformation extends BaseTransformation {
  type: 'RETURN_VALUE_ACCESS_TRANSFORM';
  targetCall: string;
  stripPropertyPrefix?: string;
}

export interface DeprecatedWarnTransformation extends BaseTransformation {
  type: 'DEPRECATED_WARN';
  pattern: string;
  message: string;
}

export type Transformation =
  | MethodRenameTransformation
  | ParamRenameTransformation
  | ParamWrapOptionsTransformation
  | ImportRenameTransformation
  | ClassInstantiationTransformation
  | ReturnValueAccessTransformation
  | DeprecatedWarnTransformation;

export interface MigrationRecipe {
  id: string;
  name: string;
  description: string;
  packageName: string;
  fromVersion: string;
  toVersion: string;
  transformations: Transformation[];
}

export interface OpenApiEndpointChange {
  path: string;
  method: string;
  type: 'ADDED' | 'REMOVED' | 'MODIFIED';
  details: string;
  parameterChanges?: Array<{
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie' | 'body';
    change: 'RENAMED' | 'ADDED' | 'REMOVED' | 'TYPE_CHANGED';
    newName?: string;
  }>;
}

export interface OpenApiDiffResult {
  title: string;
  oldVersion: string;
  newVersion: string;
  endpointChanges: OpenApiEndpointChange[];
  generatedRecipe: MigrationRecipe;
}
