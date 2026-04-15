---
project: "{PROJECT-NAME}"
status: "draft"
author: "architect-agent"
created: "{ISO-DATE}"
---

## Architectural Decisions

### AD-1: {Decision Title}

**Tags:** AD-1, decision, [domain-tag], [layer-tag]

{Describe the architectural decision, its rationale, constraints, and trade-offs considered. Target 200–300 tokens. Explain what was decided, why this option was chosen over alternatives, and what constraints or assumptions apply going forward.}

---

## Module Definitions

### AD-2: {Module Title}

**Tags:** AD-2, module, [domain-tag], [layer-tag]
**Resolves:** FR-X, FR-Y

{Describe the module's responsibility, boundaries, and key design constraints. Target 200–300 tokens. Include the module's public contract surface — what it exposes, what it depends on, and what it must not leak.}

```typescript
// Public interface surface only — no implementation bodies
// Code block is atomic chunk; counts toward 512-token ceiling
export interface ModuleName {
  // public methods and properties only
}
```

---

## Contracts & Interfaces

### AD-3: {Contract Title}

**Tags:** AD-3, contract, [domain-tag], [layer-tag]
**Resolves:** FR-X, FR-Y

{Describe the contract or interface, its purpose, and how it enforces boundaries between modules. Target 200–300 tokens. Specify the expected inputs, outputs, error handling conventions, and versioning strategy where applicable.}

```typescript
// Public interface surface only — no implementation bodies
export interface ContractName {
  // public method signatures only
}
```

---

## API Endpoints

### AD-4: {Endpoint Title}

**Tags:** AD-4, api-endpoint, [domain-tag], [layer-tag]
**Resolves:** FR-X, FR-Y

{Describe the API endpoint, its purpose, request/response shape, and any authorization or validation requirements. Target 200–300 tokens. Include HTTP method, path, expected status codes, and error response conventions.}

```typescript
// Public interface surface only — no implementation bodies
// Request and response type definitions only
interface EndpointRequest {
  // fields only
}
interface EndpointResponse {
  // fields only
}
```

---

## Dependencies

### AD-5: {Dependency Title}

**Tags:** AD-5, dependency, [domain-tag], [layer-tag]

{Describe the external or internal dependency, why it was selected, version constraints, and any risk or migration considerations. Target 200–300 tokens. Note licensing, maintenance status, and the scope of usage within the project.}

---

## File Structure

```
# New directories and moved/renamed files only.
# Do not list unchanged files.
#
# Example:
# src/
#   modules/
#     new-module/       ← new directory
#       index.ts        ← new file
# OLD-PATH.ts → NEW-PATH.ts   ← renamed/moved
```

---

## Cross-Cutting Concerns

### AD-6: {Concern Title}

**Tags:** AD-6, cross-cutting, [domain-tag], [layer-tag]

{Describe the cross-cutting concern (e.g., logging, error handling, auth, observability, caching strategy) and how it is applied consistently across modules. Target 200–300 tokens. Specify the enforcement mechanism, where the concern is implemented, and what modules are affected.}
