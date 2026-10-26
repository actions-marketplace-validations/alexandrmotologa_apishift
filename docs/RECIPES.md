# Migration Recipe Reference

APIShift uses declarative migration recipes to define AST transformations for target SDK versions.

---

## Schema structure

```json
{
  "id": "recipe-unique-id",
  "name": "Human Readable Name",
  "description": "Overview of the migration scope",
  "packageName": "target-npm-package",
  "fromVersion": "source-semver",
  "toVersion": "target-semver",
  "transformations": [
    {
      "type": "METHOD_RENAME",
      "from": "old.method.name",
      "to": "new.method.name",
      "description": "Optional explanation"
    }
  ]
}
```

---

## Transformation rule types

### 1. METHOD_RENAME
Renames an API callsite chain:
```json
{
  "type": "METHOD_RENAME",
  "from": "openai.ChatCompletion.create",
  "to": "openai.chat.completions.create"
}
```

### 2. PARAM_RENAME
Renames object parameters inside a target method call:
```json
{
  "type": "PARAM_RENAME",
  "method": "openai.chat.completions.create",
  "paramMap": {
    "model_name": "model",
    "max_tokens_to_sample": "max_tokens"
  }
}
```

### 3. IMPORT_RENAME
Updates package imports and CommonJS require statements:
```json
{
  "type": "IMPORT_RENAME",
  "sourcePackage": "openai",
  "oldImports": ["Configuration", "OpenAIApi"],
  "newImport": {
    "isDefault": false,
    "name": "OpenAI"
  }
}
```

### 4. CLASS_INSTANTIATION_RENAME
Rewrites class constructors and unwraps configuration arguments:
```json
{
  "type": "CLASS_INSTANTIATION_RENAME",
  "oldClass": "OpenAIApi",
  "newClass": "OpenAI",
  "simplifyConstructorArg": true
}
```

### 5. PARAM_WRAP_OPTIONS
Extracts top-level properties and moves them into a secondary options argument:
```json
{
  "type": "PARAM_WRAP_OPTIONS",
  "method": "stripe.paymentIntents.create",
  "optionsParamIndex": 1,
  "wrapFields": ["idempotencyKey", "stripeAccount", "apiVersion"]
}
```

### 6. RETURN_VALUE_ACCESS_TRANSFORM
Removes obsolete property wrappers from response accesses:
```json
{
  "type": "RETURN_VALUE_ACCESS_TRANSFORM",
  "targetCall": "openai.chat.completions.create",
  "stripPropertyPrefix": "data"
}
```

### 7. DEPRECATED_WARN
Adds a code comment or migration note above a callsite:
```json
{
  "type": "DEPRECATED_WARN",
  "pattern": "router.query",
  "message": "router.query is not supported in next/navigation. Use useSearchParams() instead."
}
```
