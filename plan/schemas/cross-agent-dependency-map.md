# Cross-Agent File Dependency Map

> Defines exactly which agents read and write which documents. This is the contract that prevents conflicts and ensures agents have the context they need.

---

## Read/Write Matrix

| Document | Brainstormer | Research | PM | Designer | Architect | Planner | Coder | Reviewer | Orchestrator |
|----------|-------------|----------|-----|----------|-----------|---------|-------|----------|-------------|
| `orchestration.yml` | — | — | — | — | — | R | — | — | R |
| `state.json` | — | — | — | — | — | **RW** | — | — | R |
| `STATUS.md` | — | — | — | — | — | **W** | — | — | R |
| `BRAINSTORMING.md` | **W** | R | R | — | R | R | — | — | R |
| `RESEARCH-FINDINGS.md` | — | **W** | R | R | R | R | — | — | — |
| `PRD.md` | — | **W** | R | R | R | — | R | — |
| `DESIGN.md` | — | — | **W** | R | R | — | R | — |
| `ARCHITECTURE.md` | — | — | — | **W** | R | — | R | — |
| `MASTER-PLAN.md` | — | — | — | **W** | R | — | R | — |
| `PHASE-PLAN.md` | — | — | — | — | **RW** | — | R | — |
| `TASK-HANDOFF.md` | — | — | — | — | **W** | R | R | — |
| `TASK-REPORT.md` | — | — | — | — | R | **W** | R | — |
| `CODE-REVIEW.md` | — | — | — | — | R | — | **W** | — |
| `PHASE-REPORT.md` | — | — | — | — | **RW** | — | R | — |
| `PHASE-REVIEW.md` | — | — | — | — | R | — | **W** | — |

**Legend**: R = Read, W = Write, RW = Read+Write, — = No access

---

## Data Flow Diagram

```
BRAINSTORMING ──→ Research Agent ──→ RESEARCH-FINDINGS
                                        │
                                        ▼
                                  PM Agent ──→ PRD
                                        │       │
                                        ▼       ▼
                              Designer Agent ──→ DESIGN
                                        │         │
                                        ▼         ▼
                              Architect Agent ──→ ARCHITECTURE
                                        │              │
                                        ▼              ▼
                              Architect Agent ──→ MASTER-PLAN
                                                       │
                                                       ▼
                              ┌─── Tactical Planner ◄──┘
                              │         │
                              ▼         ▼
                         PHASE-PLAN  TASK-HANDOFF ──→ Coder ──→ TASK-REPORT
                              │                                      │
                              │         ┌────────────────────────────┘
                              ▼         ▼
                         Reviewer ──→ CODE-REVIEW
                              │
                              ▼
                    PHASE-REPORT ◄── Tactical Planner
                              │
                              ▼
                    PHASE-REVIEW ◄── Reviewer
                              │
                              ▼
                         Orchestrator reads state.json → decides next action
```

---

## Key Rules

1. **Only the Tactical Planner writes state files** (state.json, STATUS.md)
2. **The Coder reads ONLY the TASK-HANDOFF** — nothing else. Self-contained.
3. **The Orchestrator reads ONLY state.json + STATUS.md** — never reads planning docs directly
4. **Each planning agent reads all prior planning docs** — Research reads Brainstorming, PM reads Research+Brainstorming, etc.
5. **The Reviewer reads planning docs + reports** — validates code against the plan
6. **No agent reads another agent's working state** — they communicate through documents only

---

## File Ownership (Sole Writer)

| Document | Sole Writer |
|----------|-------------|
| `state.json` | Tactical Planner |
| `STATUS.md` | Tactical Planner |
| `BRAINSTORMING.md` | Brainstormer — **sole writer** (optional document; not auto-created) |
| `RESEARCH-FINDINGS.md` | Research Agent |
| `PRD.md` | Product Manager Agent |
| `DESIGN.md` | UX Designer Agent |
| `ARCHITECTURE.md` | Architect Agent |
| `MASTER-PLAN.md` | Architect Agent |
| `PHASE-PLAN.md` | Tactical Planner |
| `TASK-HANDOFF.md` | Tactical Planner |
| `TASK-REPORT.md` | Coder Agent |
| `CODE-REVIEW.md` | Reviewer Agent |
| `PHASE-REPORT.md` | Tactical Planner |
| `PHASE-REVIEW.md` | Reviewer Agent |

Every document has exactly ONE writer. No conflicts by design.
