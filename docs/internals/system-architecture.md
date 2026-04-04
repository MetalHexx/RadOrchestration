# System Architecture

A high-level view of the orchestration system's runtime architecture — the services, protocols, data flows, and integration points that connect project execution, agent intelligence, and human interaction into a single working system.

This document complements [pipeline.md](../pipeline.md) (how projects move through tiers) and [dependency-model.md](dependency-model.md) (how dependencies work across levels). Where those are depth-focused, this is breadth-focused: how every major subsystem relates to every other.

---

## System Overview

```mermaid
graph TB
    subgraph "Developer Interfaces"
        DEV["VS Code + Copilot"]
        CLI["CLI (radorch)"]
        DASH["Dashboard (Browser)"]
    end

    ORCH["@Orchestrator<br/>Event-driven controller<br/>20-action routing table"]
    AGENTS["Specialized Agents<br/>Research · PM · Architect<br/>Planner · Coder · Reviewer"]

    subgraph "Pipeline Engine"
        PIPE["pipeline.js<br/>Sole state-mutation authority"]
        EXT["extract-knowledge.js"]
    end

    subgraph "Project Data"
        STATE["state.json<br/>(per project)"]
        DOCS["Project Documents<br/>(planning + execution)"]
        IDX["Knowledge Index"]
        CONFIG["orchestration.yml"]
    end

    API["C# Agent Backend<br/>(MCP + AG-UI)"]

    DEV -->|"@Orchestrator"| ORCH
    CLI --> PIPE
    ORCH -->|"--event signal"| PIPE
    PIPE -->|"JSON { action, context }"| ORCH
    ORCH -->|"routes action · spawns"| AGENTS
    AGENTS -->|"produce"| DOCS

    PIPE --> STATE
    PIPE --> DOCS
    PIPE --> CONFIG

    PIPE -->|"on project complete"| EXT
    EXT --> IDX
    API --> IDX
    API -.->|"MCP tools"| ORCH
    API -.->|"AG-UI stream"| DASH

    classDef human fill:#1a3a3a,stroke:#4dd0c4,color:#4dd0c4
    classDef agent fill:#2d1b4e,stroke:#c084fc,color:#c084fc
    classDef service fill:#3d2200,stroke:#fb923c,color:#fb923c
    classDef engine fill:#0f2744,stroke:#60a5fa,color:#60a5fa
    classDef data fill:#1e293b,stroke:#94a3b8,color:#94a3b8
    classDef index fill:#032920,stroke:#34d399,color:#34d399

    class DEV,CLI,DASH human
    class ORCH,AGENTS agent
    class API service
    class PIPE,EXT engine
    class STATE,DOCS,CONFIG data
    class IDX index
```

**Key principles**: Both VS Code Copilot and the CLI funnel through `pipeline.js` — it is the single entry point for all state mutations. The Orchestrator runs inside Copilot as an event-driven controller: it signals events to `pipeline.js`, receives a JSON action result, and routes on a 20-action table to spawn the appropriate specialized agent. Knowledge flows in the opposite direction — from project data up through the extractor and index back to agents via MCP tools. Dotted lines indicate knowledge-system connections (planned).

---

## Service Architecture

The C# agent backend is a single ASP.NET Core application hosting multiple protocol endpoints. Each endpoint serves a different consumer but shares the same underlying services.

```mermaid
graph LR
    subgraph "C# Agent Backend (ASP.NET Core)"
        direction TB
        subgraph "Protocol Endpoints"
            MCP["MCP Server<br/>ModelContextProtocol.AspNetCore"]
            AGUI["AG-UI Server<br/>Microsoft.Agents.AI.Hosting.AGUI"]
        end
        subgraph "Shared Services (DI)"
            KS["Knowledge Service"]
            LLM["LLM Provider<br/>IChatClient via MEAI"]
        end
        MCP --> KS
        AGUI --> KS
        AGUI --> LLM
    end

    VSCode["VS Code Agents"] -->|"MCP (Streamable HTTP)"| MCP
    NextJS["Next.js Dashboard"] -->|"AG-UI Protocol"| AGUI
    CLI["radorch CLI"] -->|"HTTP (health/admin)"| MCP

    classDef agent fill:#2d1b4e,stroke:#c084fc,color:#c084fc
    classDef protocol fill:#3b0a1a,stroke:#fb7185,color:#fb7185
    classDef service fill:#3d2200,stroke:#fb923c,color:#fb923c
    classDef human fill:#1a3a3a,stroke:#4dd0c4,color:#4dd0c4

    class VSCode agent
    class NextJS,CLI human
    class MCP,AGUI protocol
    class KS,LLM service
```

### Protocol Responsibilities

| Protocol | Package | Consumer | Purpose |
|----------|---------|----------|---------|
| **MCP** | `ModelContextProtocol.AspNetCore` | VS Code pipeline agents | Expose knowledge tools (search, retrieve, summarize) |
| **AG-UI** | `Microsoft.Agents.AI.Hosting.AGUI.AspNetCore` | Next.js chat panel | Stream brainstorming conversations, sync goal state |
| **HTTP** | ASP.NET Core minimal APIs | CLI, health checks | Index rebuild trigger, service status |

### Why One Service, Two Protocols

The Brainstormer chat agent and the knowledge tools share the same data and the same need for LLM access. Splitting them into separate services would duplicate the knowledge service, require inter-service communication for context injection, and double the container footprint. A single service with two endpoints is simpler to deploy, configure, and reason about.

---

## Knowledge System

The knowledge system gives agents memory across projects. It has two parts: an extraction pipeline that builds a structured index from project artifacts, and a query service that makes that index searchable.

### Data Flow

```mermaid
flowchart LR
    subgraph "Source"
        S1["state.json"]
        S2["Planning Docs<br/>PRD, Architecture,<br/>Master Plan, etc."]
        S3["Execution Docs<br/>Phase Reports,<br/>Error Logs"]
    end

    subgraph "Extraction"
        EXT["extract-knowledge.js<br/>(Node.js)"]
    end

    subgraph "Knowledge Index"
        I1["index.json<br/>Project catalog"]
        I2["decisions.json<br/>Cross-project decisions"]
        I3["technologies.json<br/>Tech choices"]
        I4["projects/<br/>Per-project summaries"]
    end

    subgraph "Consumers"
        C1["Knowledge Service<br/>(C# backend)"]
    end

    S1 --> EXT
    S2 --> EXT
    S3 --> EXT
    EXT --> I1
    EXT --> I2
    EXT --> I3
    EXT --> I4
    I1 --> C1
    I2 --> C1
    I3 --> C1
    I4 --> C1

    classDef data fill:#1e293b,stroke:#94a3b8,color:#94a3b8
    classDef engine fill:#0f2744,stroke:#60a5fa,color:#60a5fa
    classDef index fill:#032920,stroke:#34d399,color:#34d399
    classDef service fill:#3d2200,stroke:#fb923c,color:#fb923c

    class S1,S2,S3 data
    class EXT engine
    class I1,I2,I3,I4 index
    class C1 service
```

### Extraction Pipeline

The extractor is a Node.js script — consistent with the pipeline engine, installer, and existing scripts. It scans every project directory (including `_archived/`), parses known document sections using the templated structure, and writes structured JSON index files to a configurable path defined in `orchestration.yml`.

**Why Node.js for extraction, C# for serving?** The extractor runs in the same ecosystem as `pipeline.js` and needs to parse the same frontmatter, resolve the same paths, and understand the same state.json schema. The C# backend loads pre-built JSON files — it doesn't need to know how to parse markdown templates.

### What Gets Extracted

The system's templated documents have predictable structure. The extractor exploits this — it knows exactly where decisions live in an architecture doc, where requirements live in a PRD, and where outcomes live in phase reports.

| Source | Extracted Atoms |
|--------|----------------|
| `state.json` | Project name, tier, gate mode, phase/task counts, created/updated timestamps, review verdicts, retry counts |
| Brainstorming | Problem statement, validated goals (name + rationale), scope boundaries |
| PRD | Functional requirements (ID, description, priority), non-functional requirements, user stories |
| Architecture | Technical decisions, module map, technology choices, dependency graph |
| Master Plan | Executive summary, key requirements, phase outlines with exit criteria |
| Phase Reports | Exit criteria assessment, carry-forward items, adjustment recommendations |
| Error Logs | Structured entries: event, severity, root cause, workaround applied |
| Final Reviews | Per-requirement coverage assessment, overall verdict |

### Index Freshness

The index rebuilds on **pipeline-triggered events** — specifically when a project reaches `complete` tier. The extractor is a standalone script callable two ways:

- **Pipeline hook**: `pipeline.js` invokes it after writing `pipeline.current_tier = "complete"`
- **CLI command**: `radorch index rebuild` for manual refresh

Incremental updates (single-project re-index) are a natural optimization but not required for V1 — a full rebuild across ~40 projects completes in seconds.

---

## Chat System

The dashboard's embedded chat panel connects the Brainstormer agent directly to the UI, eliminating the context switch between the monitoring dashboard and VS Code for project ideation.

### Conversation Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant N as Next.js Dashboard
    participant A as Dotnet Agent Backend
    participant L as LLM Provider

    U->>N: Types message in chat panel
    N->>A: AG-UI RunRequest (HTTP stream)
    A->>L: Chat completion (IChatClient)
    L-->>A: Streamed response tokens
    A-->>N: AG-UI TextMessageStart/Delta/End events
    A-->>N: AG-UI StateSnapshot (goal cards)
    N-->>U: Renders streamed text + live goal cards

    rect rgb(26, 58, 58)
        Note over U,N: Human Layer
    end
```

### State Synchronization

The chat conversation and the goal cards are synchronized through AG-UI's state management events — not by parsing the prose stream. The agent backend maintains a typed goal array as shared state, pushing `StateSnapshot` and `StateDelta` (JSON Patch) events alongside the text stream. The frontend renders them independently.

```mermaid
graph LR
    subgraph "AG-UI Event Stream"
        T["TextMessageDelta<br/>(prose stream)"]
        S["StateSnapshot<br/>(goal array)"]
        D["StateDelta<br/>(JSON Patch)"]
        TC["ToolCallStart/End<br/>(goal extraction signals)"]
    end

    T --> CP["Chat Panel<br/>(message bubbles)"]
    S --> GC["Goal Cards<br/>(structured pane)"]
    D --> GC
    TC --> GC

    classDef protocol fill:#3b0a1a,stroke:#fb7185,color:#fb7185
    classDef human fill:#1a3a3a,stroke:#4dd0c4,color:#4dd0c4

    class T,S,D,TC protocol
    class CP,GC human
```

### Knowledge Injection

When the Brainstormer starts a conversation, the knowledge service automatically injects relevant context from past projects — similar problems solved, technologies previously chosen, patterns established. This happens via the shared `KnowledgeService` that both the MCP and AG-UI endpoints access.

---

## UI Architecture

The Next.js dashboard is a read-only monitoring and interaction layer. It reads project data from the filesystem via server-side API routes, receives live updates through SSE driven by a file watcher, and streams chat through the C# agent backend via AG-UI.

```mermaid
graph TB
    BROWSER["Browser"]

    subgraph "Next.js Dashboard (:3000)"
        direction TB
        subgraph "Client (React)"
            HOOKS["useProjects · useSSE<br/>useCopilotKit"]
            VIEWS["Project List · Pipeline View<br/>Document Drawer · Chat Panel"]
        end

        subgraph "Server (API Routes)"
            API_PROJ["/api/projects"]
            API_STATE["/api/projects/[name]/state"]
            API_DOC["/api/projects/[name]/document"]
            API_SSE["/api/events (SSE)"]
        end

        subgraph "Server Libraries"
            FS["fs-reader.ts<br/>path-resolver.ts"]
            WATCH["chokidar<br/>File watcher"]
        end
    end

    subgraph "Project Data (filesystem)"
        CONFIG["orchestration.yml"]
        STATE["state.json<br/>(per project)"]
        DOCS["Project Documents<br/>(markdown)"]
    end

    BACKEND["C# Agent Backend<br/>(AG-UI endpoint)"]

    BROWSER --> HOOKS
    HOOKS --> VIEWS
    HOOKS -->|"fetch"| API_PROJ
    HOOKS -->|"fetch"| API_STATE
    HOOKS -->|"fetch"| API_DOC
    HOOKS -->|"EventSource"| API_SSE
    HOOKS -->|"AG-UI stream"| BACKEND

    API_PROJ --> FS
    API_STATE --> FS
    API_DOC --> FS
    API_SSE --> WATCH

    FS --> CONFIG
    FS --> STATE
    FS --> DOCS
    WATCH -->|"watches"| STATE
    WATCH -->|"watches"| DOCS

    classDef human fill:#1a3a3a,stroke:#4dd0c4,color:#4dd0c4
    classDef agent fill:#2d1b4e,stroke:#c084fc,color:#c084fc
    classDef service fill:#3d2200,stroke:#fb923c,color:#fb923c
    classDef engine fill:#0f2744,stroke:#60a5fa,color:#60a5fa
    classDef data fill:#1e293b,stroke:#94a3b8,color:#94a3b8

    class BROWSER human
    class HOOKS,VIEWS agent
    class API_PROJ,API_STATE,API_DOC,API_SSE,FS,WATCH engine
    class CONFIG,STATE,DOCS data
    class BACKEND service
```

### Data Flow Patterns

| Pattern | Mechanism | Path |
|---------|-----------|------|
| **Initial load** | HTTP fetch | Browser → `useProjects` → `/api/projects` → `fs-reader` → filesystem |
| **Project state** | HTTP fetch | Browser → `useProjects` → `/api/projects/[name]/state` → `readProjectState` → `state.json` |
| **Document view** | HTTP fetch | Browser → Document Drawer → `/api/projects/[name]/document` → `readDocument` → markdown file |
| **Live updates** | SSE (Server-Sent Events) | `chokidar` watches `state.json` + docs → debounced SSE push → `useSSE` → React state update |
| **Chat** | AG-UI stream | Browser → `useCopilotKit` → C# Agent Backend → LLM → streamed response |

### Why Read-Only

The dashboard never writes to `state.json` or project documents. All mutations flow through `pipeline.js` (the single-writer guarantee from the System Overview). The UI observes state changes via the file watcher — when `pipeline.js` writes `state.json`, `chokidar` detects the change and pushes an SSE event to all connected browsers. This means multiple browser tabs stay in sync automatically.

---

## Deployment Topology

```mermaid
graph TB
    subgraph "Docker Compose Stack"
        subgraph "radorch-ui"
            UI["Next.js Dashboard<br/>:3000"]
        end
        subgraph "radorch-agent"
            API["C# Agent Backend<br/>:5000"]
        end
    end

    subgraph "Host Machine"
        PIPE["pipeline.js<br/>(Node.js)"]
        VSCODE["VS Code + Copilot"]
    end

    subgraph "Shared Volumes"
        PROJ["orchestration-projects/<br/>(project data)"]
        IDX["knowledge-index/<br/>(extracted index)"]
    end

    UI -->|"AG-UI"| API
    VSCODE -->|"MCP"| API
    PIPE -->|"writes"| PROJ
    PIPE -->|"triggers"| IDX
    API -->|"reads"| IDX
    API -->|"reads"| PROJ
    UI -->|"reads"| PROJ

    classDef human fill:#1a3a3a,stroke:#4dd0c4,color:#4dd0c4
    classDef service fill:#3d2200,stroke:#fb923c,color:#fb923c
    classDef engine fill:#0f2744,stroke:#60a5fa,color:#60a5fa
    classDef data fill:#1e293b,stroke:#94a3b8,color:#94a3b8
    classDef index fill:#032920,stroke:#34d399,color:#34d399

    class UI human
    class API service
    class PIPE,VSCODE engine
    class PROJ data
    class IDX index
```

The C# agent backend runs as a Docker container alongside the existing Next.js dashboard container. Both mount the project data and knowledge index as shared volumes. The pipeline engine runs on the host machine (inside VS Code's terminal) and triggers index rebuilds on project completion.

### Container Responsibilities

| Container | Base Image | Ports | Volumes |
|-----------|-----------|-------|---------|
| `radorch-ui` | Node.js Alpine | 3000 | `orchestration-projects/` (read) |
| `radorch-agent` | .NET Alpine | 5000 | `orchestration-projects/` (read), `knowledge-index/` (read) |

The installer (`radorch` CLI) generates Docker Compose configuration for both containers and provisions environment variables (LLM endpoint, API keys, paths).

---

## Technology Stack

```mermaid
graph TD
    subgraph "Frontend"
        NEXT["Next.js 14"]
        REACT["React 18"]
        SHAD["shadcn/ui"]
        TW["Tailwind CSS"]
        CK["CopilotKit Hooks<br/>(AG-UI client)"]
    end

    subgraph "Agent Backend"
        ASP["ASP.NET Core"]
        MEAI["Microsoft.Extensions.AI<br/>(IChatClient)"]
        MCP_SDK["ModelContextProtocol<br/>(MCP C# SDK)"]
        AGUI_SDK["Microsoft.Agents.AI<br/>(AG-UI hosting)"]
    end

    subgraph "Pipeline & Tooling"
        NODE["Node.js"]
        PIPE_JS["pipeline.js"]
        EXT_JS["extract-knowledge.js"]
        INST["radorch CLI<br/>(installer)"]
    end

    subgraph "LLM Providers"
        GH["GitHub Models API<br/>(Azure AI Inference)"]
    end

    NEXT --> REACT
    REACT --> SHAD
    SHAD --> TW
    REACT --> CK
    ASP --> MEAI
    ASP --> MCP_SDK
    ASP --> AGUI_SDK
    MEAI --> GH

    classDef human fill:#1a3a3a,stroke:#4dd0c4,color:#4dd0c4
    classDef service fill:#3d2200,stroke:#fb923c,color:#fb923c
    classDef protocol fill:#3b0a1a,stroke:#fb7185,color:#fb7185
    classDef engine fill:#0f2744,stroke:#60a5fa,color:#60a5fa
    classDef llm fill:#2d1b4e,stroke:#c084fc,color:#c084fc

    class NEXT,REACT,SHAD,TW,CK human
    class ASP,MEAI service
    class MCP_SDK,AGUI_SDK protocol
    class NODE,PIPE_JS,EXT_JS,INST engine
    class GH llm
```

### Key Integration Points

| Integration | Protocol | Direction | Notes |
|------------|----------|-----------|-------|
| VS Code → Agent Backend | MCP (Streamable HTTP) | Agent calls tools | Official MCP C# SDK; `[McpServerTool]` attribute-based discovery |
| Dashboard → Agent Backend | AG-UI (HTTP stream) | UI streams chat | CopilotKit headless hooks on frontend; MAF hosting on backend |
| Agent Backend → LLM | MEAI `IChatClient` | Backend calls model | Provider-swappable via single DI registration |
| Pipeline → Knowledge Index | File I/O | Pipeline writes, backend reads | Atomic write (temp + rename); shared volume in Docker |
| Pipeline → State | File I/O | Pipeline reads/writes | `pipeline.js` is sole writer; all others read-only |

---

## Cross-Cutting Concerns

### Configuration

All runtime configuration flows from `orchestration.yml`:

| Setting | Purpose | Consumer |
|---------|---------|----------|
| `projects.base_path` | Root directory for all project data | Pipeline, extractor, dashboard, agent backend |
| `knowledge.index_path` | Where the knowledge index lives | Extractor (write), agent backend (read) |
| `agent.llm_provider` | LLM endpoint + model configuration | Agent backend |
| `agent.port` | Agent backend listen port | Docker compose, MCP client config |

### Security Boundaries

```mermaid
graph LR
    subgraph "Read-Write"
        PIPE["pipeline.js"]
    end

    subgraph "Read-Only"
        UI["Dashboard"]
        AGENT["Agent Backend"]
        EXT["Extractor"]
    end

    subgraph "Data"
        STATE["state.json"]
        DOCS["Documents"]
        IDX["Knowledge Index"]
    end

    PIPE -->|"read-write"| STATE
    PIPE -->|"read-write"| DOCS
    EXT -->|"read"| STATE
    EXT -->|"read"| DOCS
    EXT -->|"write"| IDX
    AGENT -->|"read"| IDX
    AGENT -->|"read"| DOCS
    UI -->|"read"| STATE
    UI -->|"read"| DOCS

    classDef engine fill:#0f2744,stroke:#60a5fa,color:#60a5fa
    classDef human fill:#1a3a3a,stroke:#4dd0c4,color:#4dd0c4
    classDef service fill:#3d2200,stroke:#fb923c,color:#fb923c
    classDef data fill:#1e293b,stroke:#94a3b8,color:#94a3b8
    classDef index fill:#032920,stroke:#34d399,color:#34d399

    class PIPE engine
    class UI human
    class AGENT service
    class EXT engine
    class STATE,DOCS data
    class IDX index
```

**Single-writer guarantee**: `pipeline.js` is the only process that writes `state.json`. The knowledge extractor writes only to the index directory. The agent backend and dashboard are strictly read-only over project data. This eliminates write contention and race conditions without locks.

### Error Handling Philosophy

- **Pipeline errors** → structured error log (`*-ERROR-LOG.md`), pipeline halts, human gate triggered
- **Knowledge index errors** → graceful degradation; agents work without knowledge, queries return empty results
- **Agent backend errors** → standard ASP.NET Core error handling; chat sessions are stateless and resumable
- **MCP tool errors** → MCP protocol error responses; VS Code surfaces them to the user

### Observability

The pipeline produces a complete audit trail by design — every state transition, every document, every review verdict is written to disk. The knowledge system makes this audit trail queryable. No additional telemetry infrastructure is needed for V1.

---

## Evolution Path

This architecture is designed to grow without rewrites:

| Capability | Current State | Next Step | What Changes |
|-----------|---------------|-----------|--------------|
| **Knowledge retrieval** | Structured JSON index, keyword search | Add vector embeddings (SQLite-vec or LanceDB) | Knowledge service gains a similarity search method; MCP tools unchanged |
| **Chat agents** | Brainstormer only | Additional agent types (Research, Planner) | New AG-UI agent registrations in DI; same endpoint |
| **LLM provider** | GitHub Models API | Any MEAI-compatible provider | One DI registration change |
| **Index freshness** | Rebuild on project complete | File watcher for incremental updates | Extractor gains watch mode; index format unchanged |
| **UI graph** | Read-only dependency visualization | Drag-and-drop dependency editing | UI calls pipeline events (`link_project`, `unlink_project`) |
| **Multi-project automation** | Manual project start | Chain runner / continuous queue | Orchestrator layer above pipeline; pipeline API unchanged |
