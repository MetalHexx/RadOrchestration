---
project: "MONITORING-UI"
status: "draft"
author: "product-manager-agent"
created: "2026-03-09T00:00:00Z"
inputs:
  brainstorming: "MONITORING-UI-BRAINSTORMING.md"
  research: "MONITORING-UI-RESEARCH-FINDINGS.md"
---

# MONITORING-UI — Product Requirements

## Problem Statement

The orchestration system produces rich structured state as projects move through the pipeline, but there is no visual interface to monitor that state. Developers and colleagues must read raw JSON and markdown files to understand project status, which is slow, error-prone, and inaccessible to non-technical stakeholders. A real-time, read-only monitoring dashboard would make project progress immediately visible, scannable, and shareable — without requiring any changes to the underlying orchestration system.

## Goals

- **G1 — Instant status visibility**: Any user can determine a project's current pipeline tier, active step or phase, and any blocking issues within 5 seconds of opening the dashboard.
- **G2 — Real-time updates**: The dashboard reflects changes to project state within 2 seconds of the underlying data being written, with no manual page refresh required.
- **G3 — Multi-project navigation**: Users can browse all projects in the system and switch between them in a single click, regardless of project status or lifecycle stage.
- **G4 — In-context document access**: Users can read any project artifact (plans, reports, reviews, handoffs) directly within the dashboard without navigating the filesystem or opening a separate editor.
- **G5 — Configuration transparency**: Users can view the current pipeline configuration in a structured, human-readable format without reading raw configuration files.
- **G6 — Zero-risk observation**: The dashboard is strictly read-only — it never writes to, modifies, or risks corrupting any orchestration data.

## Non-Goals

- **NG1**: Writing to project state, status files, or any orchestration artifact through the UI.
- **NG2**: Editing pipeline configuration through the UI.
- **NG3**: Approving human gates or triggering pipeline actions through the UI.
- **NG4**: Supporting multiple workspaces or remote/cloud deployment.
- **NG5**: Authentication, authorization, or access control of any kind.
- **NG6**: Mobile-responsive layout — desktop-first is sufficient for the local development use case.
- **NG7**: Integration with the agent system (e.g., spawning agents, sending messages to Copilot).
- **NG8**: Editing documents in the inline viewer — display is read-only.

## Open Question Decisions

The brainstorming document raised four open questions. The following decisions are recommended and inform the requirements below:

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| OQ-1 | Workspace root configuration | Configure via environment variable (e.g., `.env.local`) | Explicit configuration avoids fragile assumptions about the working directory. An environment variable is the standard mechanism for local app configuration and is gitignore-friendly. |
| OQ-2 | Malformed or incomplete state data | Show a degraded project card with a warning indicator | Hiding the project entirely would confuse users who know the folder exists. A degraded card with a clear warning communicates the problem without breaking the overall project list. |
| OQ-3 | Mermaid diagram support in document viewer | Plain markdown rendering first; Mermaid diagrams as a stretch goal (P2) | Plain markdown covers 100% of document types. Mermaid diagrams appear in only a few documents (architecture, pipeline). Adding Mermaid rendering later is additive and non-breaking. |
| OQ-4 | Theme preference | System-preference toggle with dark mode as the default | Dark mode is the preferred environment for developer tools. A system-preference toggle respects user OS settings while providing a sensible default. |

## User Stories

| # | As a... | I want to... | So that... | Priority |
|---|---------|-------------|-----------|----------|
| US-1 | Developer | See a real-time dashboard of the current project's pipeline status | I can monitor progress without reading raw JSON files | P0 |
| US-2 | Developer | See a checklist of all planning steps with their completion status | I know exactly where a project is in the planning pipeline | P0 |
| US-3 | Developer | See a visual breakdown of all phases and their task progress | I can quickly identify which phase is active and how many tasks are complete | P0 |
| US-4 | Developer | See individual task status, retry count, and error information | I can identify problems and blocked tasks at a glance | P0 |
| US-5 | Developer | Browse a list of all projects in the system and switch between them | I can monitor multiple projects without changing configuration or navigating the filesystem | P0 |
| US-6 | Developer | See projects without initialized state displayed with a neutral indicator | I know those projects exist but haven't entered the pipeline yet | P1 |
| US-7 | Developer | Have the dashboard update automatically when project state changes on disk | I don't need to manually refresh the page while the pipeline is running | P0 |
| US-8 | Developer | Click on any document reference in the dashboard and read its rendered content | I can review task handoffs, reports, code reviews, and planning documents without leaving the dashboard | P0 |
| US-9 | Developer | See document metadata (author, status, verdict, dates) alongside the rendered content | I get context about a document without reading its raw frontmatter | P1 |
| US-10 | Developer | View the pipeline configuration in a structured, categorized display | I understand the active limits, error handling rules, git strategy, and human gate settings | P1 |
| US-11 | Developer | See active blockers and aggregate error counts prominently displayed | I am immediately aware of any pipeline issues requiring attention | P0 |
| US-12 | Developer | See the pipeline tier as a color-coded badge on each project | I can visually distinguish planning, execution, review, complete, and halted states across the project list | P0 |
| US-13 | Developer | Toggle between light and dark mode, with system preference as the default | The dashboard is comfortable to use in my preferred environment | P2 |
| US-14 | Developer | See human gate status and approval state on the dashboard | I know when a project is waiting for human approval | P1 |
| US-15 | Developer | See a degraded card with a warning when a project's state data is malformed | I understand that data is corrupt or incomplete rather than wondering why a project is missing | P1 |
| US-16 | Colleague | View the dashboard to understand project progress without needing to learn the orchestration file structure | I can follow along with project status in meetings or async check-ins | P1 |

## Functional Requirements

| # | Requirement | Priority | Notes |
|---|------------|----------|-------|
| FR-1 | The system shall display a project dashboard showing the current pipeline tier (planning, execution, review, complete, halted) as a prominently styled badge. | P0 | Maps to `pipeline.current_tier` |
| FR-2 | The system shall render a planning steps checklist showing each of the five planning steps (research, PRD, design, architecture, master plan) with their individual status (not started, in progress, complete, failed, skipped). | P0 | Maps to `planning.steps.*` |
| FR-3 | The system shall display the planning approval status (approved / not approved) alongside the planning checklist. | P0 | Maps to `planning.human_approved` |
| FR-4 | The system shall render a phase progress view showing all phases with their status, title, task count, and completion ratio. | P0 | Maps to `execution.phases[]` |
| FR-5 | The system shall render an expandable task list within each phase showing each task's status, title, retry count, last error, and error severity. | P0 | Maps to `execution.phases[].tasks[]` |
| FR-6 | The system shall display review verdict and review action for each task that has been reviewed. | P1 | Maps to `review_verdict`, `review_action` |
| FR-7 | The system shall display phase-level review verdict and review action for each phase that has been reviewed. | P1 | Maps to `phase_review_verdict`, `phase_review_action` |
| FR-8 | The system shall display final review status and approval state when the project reaches the review tier. | P1 | Maps to `final_review.*` |
| FR-9 | The system shall display an error summary section showing total retries, total halts, and a list of all active blockers. | P0 | Maps to `errors.*` |
| FR-10 | The system shall display project limits (max phases, max tasks per phase, max retries per task) somewhere accessible on the dashboard. | P2 | Maps to `limits.*` |
| FR-11 | The system shall display a project sidebar listing all project directories found under the configured projects base path. | P0 | Derived from `orchestration.yml → projects.base_path` |
| FR-12 | Each project in the sidebar shall display the project name and a pipeline tier badge derived from its state data. | P0 | — |
| FR-13 | Projects without state data shall appear in the sidebar with a neutral "not initialized" indicator rather than being hidden. | P1 | Per OQ-2 decision |
| FR-14 | Projects with malformed or unparseable state data shall appear in the sidebar with a warning indicator and display a degraded card with an error message when selected. | P1 | Per OQ-2 decision |
| FR-15 | Selecting a project in the sidebar shall load that project's dashboard in the main content area. | P0 | — |
| FR-16 | The system shall push real-time state updates to the browser when any project's state data changes on disk, without requiring a manual page refresh. | P0 | File-system watching, server-to-client push |
| FR-17 | The system shall update only the affected project's dashboard data when a change is detected, not reload all projects. | P1 | Targeted updates for efficiency |
| FR-18 | The system shall automatically reconnect the real-time update stream if the connection is lost. | P1 | — |
| FR-19 | The system shall render any document referenced from the project state as a clickable link in the dashboard. | P0 | 13 distinct document types (see research findings) |
| FR-20 | Clicking a document link shall open an inline viewer that displays the rendered markdown content without navigating away from the dashboard. | P0 | Drawer, modal, or panel overlay |
| FR-21 | The document viewer shall extract and display document metadata (frontmatter fields such as author, status, verdict, dates) in a structured header above the rendered content. | P1 | — |
| FR-22 | The document viewer shall render standard markdown and GitHub-Flavored Markdown (tables, task lists, fenced code blocks). | P0 | — |
| FR-23 | The document viewer shall render Mermaid diagrams embedded in markdown documents. | P2 | Stretch goal per OQ-3 decision |
| FR-24 | Document links for documents that do not exist on disk shall appear as disabled or visually inactive, with a tooltip or label indicating the document is not yet available. | P1 | `null` or missing doc paths |
| FR-25 | The system shall provide a configuration viewer displaying the parsed pipeline configuration in a structured, categorized layout with logical groupings: project storage, pipeline limits, error handling, git strategy, and human gates. | P1 | — |
| FR-26 | The configuration viewer shall clearly indicate which human gate settings are hard defaults (cannot be overridden) versus configurable. | P2 | `after_planning` and `after_final_review` are hard defaults |
| FR-27 | The system shall support both v1 and v2 state data schemas, normalizing field name differences (e.g., `title` vs `name`, `phase_doc` vs `plan_doc`) so the dashboard renders consistently regardless of schema version. | P0 | Research findings document both schema versions |
| FR-28 | The system shall read the workspace root path from an environment-based configuration mechanism. | P0 | Per OQ-1 decision |
| FR-29 | The system shall provide a theme toggle supporting light mode, dark mode, and system-preference auto-detection, with dark mode as the default. | P2 | Per OQ-4 decision |
| FR-30 | The system shall display the human gate mode (ask, phase, task, autonomous) on the project dashboard. | P1 | Maps to `pipeline.human_gate_mode` |
| FR-31 | The system shall display project metadata (name, description, created date, last updated date) in the dashboard header. | P0 | Maps to `project.*` |
| FR-32 | Planning step entries with a completed output document shall display that document as a clickable link in the checklist. | P1 | Maps to `planning.steps.*.output` |

## Non-Functional Requirements

| # | Category | Requirement |
|---|----------|------------|
| NFR-1 | Performance | The dashboard shall render the initial project view within 2 seconds of selecting a project in the sidebar. |
| NFR-2 | Performance | Real-time state updates shall appear in the browser within 2 seconds of the underlying file being written to disk. |
| NFR-3 | Performance | The system shall handle workspaces with up to 20 concurrent projects without degradation in sidebar load time or update latency. |
| NFR-4 | Reliability | The real-time connection shall automatically reconnect after a transient disconnection without user intervention, with no data loss (full state is re-sent on reconnect). |
| NFR-5 | Reliability | If the server process exits, the dashboard shall display a clear "disconnected" indicator rather than showing stale data silently. |
| NFR-6 | Reliability | The system shall handle malformed state data gracefully by displaying a degraded view with a warning — never crash or show an unhandled exception. |
| NFR-7 | Accessibility | All interactive elements (sidebar links, document links, toggle controls) shall be keyboard-navigable. |
| NFR-8 | Accessibility | Status indicators shall not rely solely on color to convey meaning — text labels or icons must accompany color-coded badges. |
| NFR-9 | Accessibility | The dashboard shall meet WCAG 2.1 Level AA contrast ratios in both light and dark themes. |
| NFR-10 | Security | The application shall never write to, modify, or delete any file on the filesystem. All filesystem access is strictly read-only. |
| NFR-11 | Security | The application shall only serve on localhost and shall not bind to external network interfaces by default. |
| NFR-12 | Security | The document viewer shall sanitize rendered markdown to prevent script injection from document content. |
| NFR-13 | Maintainability | The system shall cleanly separate data access (filesystem reads, file watching) from presentation logic, enabling future changes to the data source without rewriting UI components. |
| NFR-14 | Compatibility | The dashboard shall function correctly in the latest stable versions of Chrome, Firefox, and Edge. |
| NFR-15 | Resource Efficiency | File watchers shall be cleaned up immediately when a client disconnects or the connection is closed, preventing memory leaks from abandoned watchers. |
| NFR-16 | Usability | The dashboard shall use a professional, clean visual design suitable for developer tooling, with a consistent component library and design language throughout. |

## Assumptions

- A-1: The orchestration system's file structure and state schema are stable and will not undergo breaking changes during the initial build of the dashboard.
- A-2: The dashboard will run on the same machine as the orchestration workspace, with direct filesystem access to project files.
- A-3: File change events from the operating system are reliable and timely for the purpose of triggering UI updates.
- A-4: The number of concurrent projects in a workspace will remain under 20 for the foreseeable future.
- A-5: All project documents are valid UTF-8 encoded markdown files.
- A-6: The dashboard will be used by a single user at a time in a local development context — no concurrent-user scaling is required.
- A-7: Both v1 and v2 state schemas will coexist in the workspace; no migration tooling will be provided to upgrade v1 to v2.

## Risks

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| R-1 | State schema changes in a future orchestration version break the dashboard's data model | High | Design the data normalization layer to be version-aware and fail gracefully with degraded rendering for unrecognized fields |
| R-2 | File watcher events are unreliable or delayed on certain operating systems (e.g., Windows network drives) | Med | Document supported environments; rely on local filesystem only; provide a manual refresh fallback |
| R-3 | Large documents (architecture docs, final reviews) cause slow rendering in the inline viewer | Med | Implement lazy loading for document content; render on demand when the viewer is opened, not on dashboard load |
| R-4 | Rapid successive file writes during active pipeline execution cause excessive re-renders | Med | Debounce file change events before pushing updates to the client |
| R-5 | Malformed state data causes dashboard crashes instead of graceful degradation | High | Validate all state data at the parsing boundary; wrap rendering in error boundaries; display degraded views for invalid data |
| R-6 | Users mistakenly believe the dashboard can control the pipeline and file issues when gate approvals don't work | Low | Display a clear "read-only monitoring" label in the UI header; disable any elements that might suggest write capability |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to status comprehension | Under 5 seconds from dashboard load to understanding a project's current state | User observation — can the user verbally state the project tier, active step, and any blockers within 5 seconds? |
| State update latency | Under 2 seconds from file write to browser display update | Timed measurement: write a state file change, measure time until the dashboard visually reflects it |
| Document viewer load time | Under 1 second to render a typical project document | Measured from click on document link to full render in the viewer |
| Project switching speed | Under 500ms to load a new project's dashboard after clicking in the sidebar | Measured from sidebar click to stable dashboard render |
| Error resilience | Zero unhandled crashes when encountering malformed state data, missing files, or disconnected streams | Automated test suite: inject malformed data, verify degraded rendering without exceptions |
| Feature coverage | 100% of state.json fields visible somewhere in the dashboard | Audit checklist: every field in the state schema maps to a visible UI element |
