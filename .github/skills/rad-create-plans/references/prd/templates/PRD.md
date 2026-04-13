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

### FR-2: {Title}

{Body}

## Non-Functional Requirements

### NFR-1: {Title — 5 words max}

{1-3 sentences. Category + requirement.}

### NFR-2: {Title}

{Body}

## Risks

{Optional section — include only if product-scoped risks exist}

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | {Risk} | High/Med/Low | {Mitigation} |
