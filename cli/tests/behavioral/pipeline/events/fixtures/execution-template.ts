// cli/tests/behavioral/pipeline/events/fixtures/execution-template.ts
// Synthetic single-phase, single-task execution template for behavioral tests.
// NFR-5: state-shape changes are coordinated — update seeded states in each
// test file when this template changes.
export const EXECUTION_TEMPLATE_BODY = `template:
  id: syn-exec
  version: "1.0.0"
  description: "Synthetic execution template for behavioral tests"
nodes:
  - id: gate_mode_selection
    kind: gate
    label: "Gate Mode Selection"
    mode_ref: human_gates.execution_mode
    action_if_needed: gate_task
    approved_event: gate_mode_set
    auto_approve_modes: [task, phase, autonomous]
    depends_on: []
  - id: phase_loop
    kind: for_each_phase
    label: "Phase Execution Loop"
    source_doc_ref: "$.nodes.master_plan.doc_path"
    total_field: total_phases
    depends_on: [gate_mode_selection]
    body:
      - id: task_loop
        kind: for_each_task
        label: "Task Execution Loop"
        source_doc_ref: "$.current_phase.doc_path"
        tasks_field: tasks
        depends_on: []
        body:
          - id: task_gate
            kind: gate
            label: "Task Gate"
            mode_ref: human_gates.execution_mode
            action_if_needed: gate_task
            approved_event: task_gate_approved
            auto_approve_modes: [phase, autonomous]
            depends_on: []
          - id: task_executor
            kind: step
            label: "Execute Task"
            action: execute_task
            events: { started: execution_started, completed: task_completed }
            depends_on: [task_gate]
          - id: code_review
            kind: step
            label: "Code Review"
            action: spawn_code_reviewer
            events: { started: code_review_started, completed: code_review_completed }
            doc_output_field: doc_path
            depends_on: [task_executor]
      - id: phase_gate
        kind: gate
        label: "Phase Gate"
        mode_ref: human_gates.execution_mode
        action_if_needed: gate_phase
        approved_event: phase_gate_approved
        auto_approve_modes: [task, autonomous]
        depends_on: [task_loop]
      - id: phase_review
        kind: step
        label: "Phase Review"
        action: spawn_phase_reviewer
        events: { started: phase_review_started, completed: phase_review_completed }
        doc_output_field: doc_path
        depends_on: [phase_gate]
  - id: final_review
    kind: step
    label: "Final Review"
    action: spawn_final_reviewer
    events: { started: final_review_started, completed: final_review_completed }
    doc_output_field: doc_path
    depends_on: [phase_loop]
  - id: final_approval_gate
    kind: gate
    label: "Final Approval Gate"
    mode_ref: human_gates.after_final_review
    action_if_needed: request_final_approval
    approved_event: final_approved
    auto_approve_modes: []
    depends_on: [final_review]
`;
