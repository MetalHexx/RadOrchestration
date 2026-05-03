# Agents

The orchestration system ships eight agents, each with a defined role, scoped tool access, and a narrow write surface. Except for the Brainstormer, agents are not directly invoked by users — operators interact via slash commands and the pipeline routes work to the right agent. The Brainstormer is user-invocable via `/rad-brainstorm`.

## Model Routing

| Agent | Model |
|-------|-------|
| Brainstormer | sonnet |
| Orchestrator | opus |
| Planner | opus |
| Coder-Junior | haiku |
| Coder | sonnet |
| Coder-Senior | opus |
| Reviewer | sonnet |
| Source Control | haiku |

The three Coder tiers exist to route tasks between haiku, sonnet, and opus by complexity — junior for straightforward changes, default for typical work, senior for complex or high-stakes work.

## Agent Details

### Brainstormer

The Brainstormer works directly with the human in a conversational loop — asking probing questions, surfacing trade-offs, and converging on a well-defined scope before any pipeline work begins. It operates outside the main pipeline and produces `BRAINSTORMING.md` as the formal handoff to planning.

### Orchestrator

The Orchestrator reads the pipeline state file on every event and dispatches the right agent at the right time. When a review comes back with changes requested, it reads the review document, judges the findings, and authors corrective task handoffs that send the Coder back to fix only what matters. Its write surface is intentionally narrow — it never writes project source code or tests.

### Planner

The Planner authors `REQUIREMENTS.md` and `MASTER-PLAN.md` from the `BRAINSTORMING.md` and any user-supplied context. When authoring the plan, it pulls in domain skills already present in your repository — anything you have already authored as a skill in your repo is picked up automatically and shapes the resulting plan. This is how the pipeline adapts to your existing work rather than generating a generic plan.

### Coder-Junior

Coder-Junior executes one task end-to-end from a self-contained task handoff. For code tasks, it follows a mechanical RED-GREEN cycle: write a failing test first, implement until the test passes, then run the full suite to confirm no regressions. Assigned to straightforward tasks where the implementation steps are explicit and the scope is narrow.

### Coder

Coder executes one task end-to-end from a self-contained task handoff. For code tasks, it follows the same RED-GREEN cycle as the other Coder tiers: failing test first, implement until green, full suite last. Assigned to typical work that fits a mid-tier model.

### Coder-Senior

Coder-Senior executes one task end-to-end from a self-contained task handoff, following the same RED-GREEN cycle. Assigned to complex or architecturally significant tasks where deeper reasoning is warranted.

### Reviewer

The Reviewer reads the task output against the requirement audit and produces a structured review document. Its quality pass may flag speculative additions and pattern duplication when they appear; it does not prescribe implementation style beyond what the requirements specify. Review findings drive corrective task handoffs when changes are needed.

### Source Control

Source Control is a thin wrapper for git commit, push, and pull-request creation. Commit messages are built from task metadata. Failures are logged and never block the pipeline from continuing.

## Next Steps

- [Skills](skills.md) — Explore the skills agents use
