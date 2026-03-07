# DOMIsh Documentation Conventions

This document defines the documentation standards for the DOMIsh TypeScript codebase.

## Format

Documentation uses **NaturalDocs-style** comments with **markdown support**.

## File Template

```typescript
// Project: DOMIsh
// Author:  Sebastien Pierre
// License: Revised BSD License
// Created: YYYY-MM-DD

// Module: {{module name}}
// {{description of the module, concepts, short examples}}

// ----------------------------------------------------------------------------
//
// SECTION
//
// ----------------------------------------------------------------------------
// ============================================================================
// SUBSECTION
// ============================================================================

// Type: {{name}}
// {{description}}
// {{attribute_list}}

// Function: {{name}}
// {{description with embedded parameters}}

export { {{name}} }

// EOF
```

## Rules

### Project Headers
- Include at file top: Project, Author, License, Created date
- Use the exact format shown in the template

### Section Delimiters
- Use `// SECTION` headers with separator lines
- Use `// SUBSECTION` headers with `// ====` separators
- Group related functionality under sections

### Module Documentation
- Define concepts and keywords at module level
- Provide short usage examples for complex modules
- Assume technical competence in descriptions

### Type/Class Documentation
```typescript
// Class: ClassName
// Brief description of purpose.
//
// Properties:
// - propertyName: type - description
// - anotherProp: string - what it does
```

### Function/Method Documentation
```typescript
// Function: functionName
// Does something with `parameter` and returns a result.
//
// Parameters:
// - param: type - description
//
// Returns:
// type - description of return value
//
// Example:
// ```typescript
// const result = functionName("value");
// ```
```

### Factory Functions
Factory functions MUST include an example:
```typescript
// Function: createThing
// Factory that creates a Thing with `config`.
//
// Example:
// ```typescript
// const thing = createThing({ name: "test" });
// thing.activate();
// ```
```

### Exports
- List named exports at file end
- Include explicit `// EOF` marker
- Group related exports together

## Examples

All examples use fenced code blocks with language specifier:

```typescript
// Good:
// ```typescript
// const result = calculate(10, 20);
// ```

// Bad:
// Example: calculate(10, 20)
```

## Reference

- NaturalDocs: https://naturaldocs.org
- DOM API Reference: https://devdocs.io/dom/node
- DOM.js: https://github.com/andreasgal/dom.js
- Deno DOM: https://github.com/b-fuze/deno-dom

---

Last updated: 2026-03-08
