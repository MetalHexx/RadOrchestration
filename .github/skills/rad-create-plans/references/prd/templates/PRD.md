---
project: "{PROJECT-NAME}"
status: "draft|review|approved"
author: "product-manager-agent"
created: "{ISO-DATE}"
---

# {PROJECT-NAME} — Product Requirements

## Problem Statement

{2-4 sentences}

## Goals

- {Goal — measurable outcome, no IDs}

## Non-Goals

- {Explicitly out of scope item, no IDs}

## Functional Requirements

### FR-1: Consolidated Document Skill

The system shall provide a consolidated document-creation skill with a top-level router that loads shared reference documents — formatting guidelines and a self-review workflow — before dispatching to a document-type-specific workflow based on the invoking agent's identity. The router shall support a minimum of six document types without structural modification to the routing mechanism itself. Each document-type workflow shall be self-contained in its own spoke directory with a workflow file and a templates subdirectory, requiring only a single row addition to the routing table when a new type is added.

**Acceptance Criteria:**
- The router dispatches to the correct spoke for each of the six supported document types (PRD, Research Findings, Design, Architecture, Master Plan, Phase Plan, Task Handoff).
- Shared reference documents (formatting guide, self-review workflow) are loaded exactly once per invocation, before any type-specific logic executes.
- Adding a seventh document type requires only a routing-table row addition — no changes to the router logic or shared references.

**Constraints:** All document-type workflows must be independently testable without invoking the router. The router must not embed document-type-specific content or conditional branches beyond the dispatch table. If no agent identity matches, the router must surface a clear error rather than silently falling through to a default.

### FR-2: {Title}

{Body}

## Non-Functional Requirements

### NFR-1: {Title — 5 words max}

{1-3 sentences. Category + requirement.}

## Risks

{Optional section — include only if product-scoped risks exist}

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | {Risk} | High/Med/Low | {Mitigation} |
