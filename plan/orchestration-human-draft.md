# Agent Orchestration System
We're going to plan a system that can orchestrate multiple agents to work together to achieve a common goal. This system will allow us to define tasks, assign them to different agents, and manage the workflow between them.

## Orchestration Files:

### File Structure:
docs/projects/<PROJECT-NAME>/
├── <PROJECT-NAME>-BRAINSTORMING.md                 
├── <PROJECT-NAME>-PRD.md                         
├── <PROJECT-NAME>-DESIGN.md                     
├── <PROJECT-NAME>-ARCHITECTURE.md               
├── <PROJECT-NAME>-MASTER-PLAN.md                
├── <PROJECT-NAME>-STATUS.md                     
├── phases/
│   └── <PROJECT-NAME>-PHASE-##-<NAME>.md
├── tasks/
│   └── <PROJECT-NAME>-TASK-P##-T##-<NAME>.md
└── reports/
    └── <PROJECT-NAME>-TASK-REPORT-P##-T##.md
    └──  <PROJECT-NAME>-PHASE-REPORT-P##.md   

### BRAINSTORMING.md (TEMPLATE):
This is an optional document that captures the brainstormed and refined project idea. It can be created through a collaborative brainstorming session with the Brainstormer Agent, or manually by anyone on the team. It contains validated ideas, scope boundaries, and enough context to guide the planning automation process.

### PRD.md (TEMPLATE):
The Product Requirements Document (PRD) is a high-level document that describes the feature requirements. It outlines the user needs, the problem statement, and what problems we need to solve or feature we need to add. This document is created by the Product Manager Agent and serves as a blueprint for the development process.

### DESIGN.md (TEMPLATE):
The Design document contains the user experience design for the feature.  It sources from our local design system, design tokens, breakpoint definitions, and accessibility guidelines and reusable components to come up with a plan for the component / layout design.  This document is created by the UX Designer Agent and serves as a guide for the development team to implement the design.

### ARCHITECTURE.md (TEMPLATE):
The Architecture document contains the technical specifications for the project. This includes the architecture of the system, the technologies that will be used, and any other technical details that are necessary for the development process.  It considers the application structure from backend to front end and the different layers between them.  It'll reference the Design document for any UI/UX considerations. This document is created by the Architect Agent and serves as a guide for the development team to implement the technical aspects of the project.  It is high level document and does not go into the implementation details of the system, but rather focuses on the overall structure and design of the system.  It should reference key files and define contracts that 2 parallel agents can abide by.  Modules, endpoints, domain elements and classes should be defined in this document, but the implementation details of those modules and classes should be left to the development team to figure out.

### MASTER-PLAN.md (TEMPLATE):
The Master Plan document serves as the single source of truth for the project. It contains all the information from the previous documents (PRD, Design, Architecture).  It provides an executive summary of the project, the goals, the requirements, the design, and the architecture.  It breaks down the project into phases.  But these phases are written at a technical high level and reference links to elements in the previous documents (PRD, Design, Architecture).  The phases should be decribed in a high level way and reference direct links to the relevant sections in the previous documents (PRD, Design, Architecture) for the details.  We should create a link to the soon-to-be-created phase document.  This document is created by the Architect Agent and serves as a guide for Tactical Planner Agent to understand the overall plan for the project and how all the different elements fit together.  It should be a high signal to noise document that provides a clear and concise overview of the project, while also providing links to the detailed information in the previous documents for For the Tactical Planner to dive deeper into the specifics.

### PHASE-PLAN.md (TEMPLATE):
The Phase Plan document breaks down the project into high level tasks. Each phase should have a specific goal and a set of task descriptions that don't have any code details, just what the task needs to accomplish at a super high level.  The document and tasks have canonical reference links to the relevant sections in the previous documents (PRD, Design, Architecture) for the details.  The document should describe a phase task execution outline.  Since we're going to be orchestrating multiple agents to work on the same phase, we need to have a clear outline of how the phase will be executed.  This includes the order of tasks, the dependencies between tasks, and any other relevant information that can help guide the execution of the phase.  Phase documents are built on the fly by the tactical planner agent at the start of each phase loop.  

### TASK-HANDOFF.md (TEMPLATE):
The Task Handoff document represents a single task in a phase.  It's really the only document we hope a subagent actually needs to read in and should contain a compiled down set of instructions that don't require the agent to read any other docs.  For example, it doesn't need to read the STYLE_GUIDE.md file.  It is given a reference to styles.scss and the name of the style or design token.  Same thing with components.  The task is a very high signal to noise document that does not need to reference any canonical documents therefore reducing subagent context bloat.  The agent will have skills, so its going to know about the design system so it can make smart decisions in the face of a poorly defined task.


### TASK-REPORT.md (TEMPLATE):
The task report document is the output of a task.  It contains the results of the task, any relevant information that can help guide the next steps in the phase, and any other relevant information that can help guide the execution of the phase.  This document is created by the agent that executed the task and serves as a guide for the Tactical Planner Agent to understand the results of the task and how it can inform the next steps in the phase.  


### Skills:
We'll design atomic, composable skills for our agents to leverage for the job at hand.  For example, we don't have a backend agent and a front end agent.  We have a generic coding agent that can reference a backend skill or frontend skill or a design skill.  Skills are generally available to any agent to use as they see fit.  This allows us to have a more flexible and adaptable system, while also ensuring that we're leveraging the expertise of our agents in the most effective way possible.  Skills are assignable at the agent level or at the task level.  For example, we can have a coding agent that has both backend and frontend skills, but for a specific task, we can assign it only the frontend skill to ensure that it's focused on the task at hand.  This allows us to have a more granular level of control over how our agents are executing their tasks and ensures that they're leveraging the right skills for the right tasks.  Tasks will define skills as required or optional.  Required skills are skills that are necessary for the successful completion of the task, while optional skills are skills that can be leveraged to improve the quality of the work or to make the process more efficient, but are not strictly necessary for the completion of the task.  This allows us to have a more flexible and adaptable system, while also ensuring that we're leveraging the expertise of our agents in the most effective way possible.

The subagent orchestration system will also be a skill based system.  The orchestrator agent will have a set of skills that it can leverage to manage the overall orchestration process.  The tactical planner agent will have a set of skills that it can leverage to create the phase plans and task handoff documents.  The coding agents will have a set of skills that they can leverage to execute the tasks and return reports.  The review agents will have a set of skills that they can leverage to review the code and provide feedback.  By having a skill-based system, we can ensure that our agents are leveraging their expertise in the most effective way possible, while also allowing for flexibility and adaptability in how they execute their tasks.

#### Example Skills:
- Create PRD file skill: This skill allows an agent to generate a Product Requirements Document (PRD) based on the input provided. It can leverage templates and best practices to create a comprehensive and well-structured PRD.

- Create Architecture Document skill: This skill allows an agent to generate an Architecture document based on the input provided. It can leverage templates and best practices to create a comprehensive and well-structured Architecture document.

- Create Design Document skill: This skill allows an agent to generate a Design document based on the input provided. It can leverage templates and best practices to create a comprehensive and well-structured Design document.

- Create Master Plan Document skill: This skill allows an agent to generate a Master Plan document based on the input provided. It can leverage templates and best practices to create a comprehensive and well-structured Master Plan document.

- Create Phase Plan Document skill: This skill allows an agent to generate a Phase Plan document based on the input provided. It can leverage templates and best practices to create a comprehensive and well-structured Phase Plan document.

- Create Task Handoff Document skill: This skill allows an agent to generate a Task Handoff document based on the input provided. It can leverage templates and best practices to create a comprehensive and well-structured Task Handoff document.

- Run Tests skill: This skill allows an agent to run tests based on the input provided. It can leverage testing frameworks and best practices to ensure that the tests are comprehensive and effective.

- Review Code skill: This skill allows an agent to review code based on the input provided. It can leverage best practices and coding standards to ensure that the code is of high quality and meets the requirements defined in the planning documents.

- Generate Task Report skill: This skill allows an agent to generate a Task Report document based on the input provided. It can leverage templates and best practices to create a comprehensive and well-structured Task Report document that contains the results of the task and any relevant information that can help guide the next steps in the phase.

- Review Report skill: This skill allows an agent to generate a Review Report document based on the current state of the project and results of the previous tasks and any missed acceptance criteria. It can leverage templates and best practices to create a comprehensive and well-structured Review Report document that contains the results of the review and any relevant information that can help guide the next creation of the next phase plan and task handoff documents.

- Open to other suggestions here, but lets stick to the basics for creating our orchestration system and we can always add more skills as we go along and identify the needs for them.





## Agents:
Agents will be defined as experts in what they need to do for a given job or task.  They are specialized in their role, but leverage their knowledge through a system of composable skills that allow them to be flexible and adaptable in their approach to executing tasks.  

- Planning Agent: This agent is responsible for managing the overall planning process. It takes the initial idea and creates the PRD, Design, Architecture, and Master Plan documents.  It leverages the skills of the Research Agent, Product Manager Agent, UX Designer Agent, and Architect Agent to create these documents.  The Planning Agent ensures that the planning process is efficient and effective, and that the resulting documents are comprehensive and well-structured.  It prefers to link canonical sources and references as opposed to over-duplication.  It also ensures that the planning process is aligned with the overall goals of the project and that it provides a clear roadmap for the development process.

- Research Agent: Researches the code base, web sites, documentation and any other relevant sources to gather information that can help refine the idea and identify potential challenges and opportunities.

- Product Manager Agent: Takes the output from the Research Agent and creates a detailed PRD that outlines the features, functionalities, and requirements of the product. This agent will also identify any potential risks and mitigation strategies.

- UX Designer Agent: Takes the output from the Product Manager Agent and creates a user experience design for the product. This can include wireframes, mockups, and prototypes that will help visualize how the feature will look and function.

- Architect Agent: Takes the output from the Product Manager Agent and UX Designer Agent and creates the technical specifications for the project. This will include the architecture of the system, the technologies that will be used, and any other technical details that are necessary for the development process.  
  - It considers the application structure from backend to front end and the different layers between them.

- Orchestrator Agent: This agent is responsible for managing the overall orchestration process.  It kicks off the phase execution loops and ensures that the Tactical Planner Agent has all the information it needs to create the phase plans and task handoff documents.  It also manages the workflow between the different agents and ensures that the tasks are executed in the correct order and that any dependencies between tasks are properly managed.  It also ensures that the task reports generated by the Coding Agents are properly collected and used to inform the next steps in the phase.  The Orchestrator Agent is essentially the conductor of the orchestra, ensuring that all the different agents are working together harmoniously to achieve the overall goals of the project.  The orchestator calls upon the Tactical Planner to do the Planning.  Then the orchestrator calls upon the coding agents to execute the tasks.  Then it calls upon the review agents to review the code.  It manages the workflow between these different agents and ensures that everything is running smoothly and efficiently.  The orchestrator uses the STATUS.md file to keep track of the current state of the project and to ensure that all agents have access to the information they need to do their jobs effectively.  This is a read-only agent and does not write to any files, but rather manages the workflow and ensures that all agents are working together effectively.



- Tactical Planner Agent: 
The Tactical Planner is responsible for creating the phase plans on each phase loop.  Every time in plans a new phase document, it reads the master, design, archictecture and prd documents to create a phase plan that is relevant to the current state of the project.  It creates the phase plan document and the task handoff documents for each task in the phase.  These phase plans are created on the fly and respect the requirements of the planning docs, but is also grounded in the current state of the project.  The tactical planning reads the task reports left behind by other agents to understand the current state of the project and make informed decisions about how to plan the next steps in the phase.  The is is the step where we're analyzing execution order that will help us optimize for parallization and efficiency.  Task handoff documents are created on an even tighter loop.  The Tactical planner is generating the next set of tasks based on the current state of the project and the results of the previous tasks.  So it's creating these task handoff documents on the fly as well.  This allows us to be very flexible and adaptive in our planning process, while also ensuring that we're always working towards the overall goals of the project.

- Coding Agent: These agents are responsible for executing the tasks that are defined in the phase plans. They will read the task handoff documents and execute the tasks based on the instructions provided. They will also generate task reports that contain the results of the tasks, which will be used by the Tactical Planner Agent to inform the next steps in the phase.

- Review Agent: These agents are responsible for reviewing the code that is generated by the Coding Agents. They will ensure that the code meets the requirements defined in the planning documents and that it adheres to best practices and coding standards. They will also provide feedback to the Coding Agents to help them improve their code.  They will reference the design and architecture documents to ensure that the code is aligned with the overall design and architecture of the system and catching any deviations from the plan early on in the process.  It should check for architectural consistency, design consistency, code quality, test coverage and any other relevant factors that can help ensure that the code is of high quality and meets the requirements defined in the planning documents.  If a review agent identifies any issues with the code, it will generate a task report that contains the details of the issues and any relevant information that can help guide the next steps in the phase.  The Tactical Planner Agent will then use this information to inform the next steps in the phase and ensure that any issues are addressed in a timely manner.  Very bad situations could raise an escalation that would require human intervention, but the goal is to minimize these situations as much as possible by having a robust review process in place.













## Orchtestration Pipelines:
This is going to be a 3-tier system:  Planning, Phase Execution, Review.  Each tier will have a specific role in the orchestration process.

### Planning Pipeline:
In this tier, we're going to have multiple sub-phases that will help us go from Idea -> PRD -> UX Design (optional) -> Technical Specifications (Architecture) -> Master document.

#### Step 1: Idea Generation
In this sub-phase, we will generate ideas for the project. This can be done through brainstorming sessions, code research, tool research or any other method that helps us come up with innovative ideas.

This is a human in the loop phase, where we will leverage the creativity and expertise of our team members to come up with ideas that can be turned into a successful feature.

The output of this phase is a rough draft of the idea that we can then refine and develop further in the next sub-phases.

#### Step 2: Product Requirements Document (PRD)
Once we have a solid idea, we will create a Product Requirements Document (PRD). This document will outline the features, functionalities, and requirements of the product. It will serve as a blueprint for the development process.

This step begins the first steps of the automation process.  



#### Step 3: UX Design (Optional)
In this step, we will create the user experience design for the product. 

This can include wireframes, mockups, and prototypes that will help us visualize how the feature will look and function.  

This step will leverage the local design system, design tokens, breakpoint definitions, and accessibility guidelines and reusable components to come up with a plan for the component / layout design.  

This phase could identity new components that need to be added to the design system, and could also identify new design tokens that need to be added to the design system.

#### Step 4: Technical Specifications (Architecture)
In this step, we will create the technical specifications for the project. This will include the architecture of the system, the technologies that will be used, and any other technical details that are necessary for the development process.

#### Step 5: Master Document
In this step, we will create a master document that will serve as the single source of truth for the project. This document will include all the information from the previous steps, as well as any additional information that is necessary for the development process.

### Execution Pipeline:
In this tier, we will have the Orchestrator Agent that will be responsible for managing the overall orchestration process.  It will kick off the phase execution loops and ensure that the Tactical Planner Agent has all the information it needs to create the phase plans and task handoff documents. Each phase goes through a Code -> Test -> Review cycle.

### Step 1: Generate Current Phase Doc
At the start of each phase loop, the Tactical Planner Agent will generate a new phase document that outlines the tasks that need to be completed in the current phase. This document will be based on the Master Plan and will take into account the current state of the project by reading the task reports left behind by other agents.

#### Step 2: Generate Task 1 from Phase Doc
The Tactical Planner Agent will then generate the first task handoff document for the first task in the phase. This document will contain all the information that the agent needs to execute the task, without requiring it to read any other documents.  More than 1 task can be generated at this step if the tasks are independent and can be executed in parallel.

#### Step 3: Coding Agents Execute Tasks
The relevant agents will then execute the tasks based on the task handoff documents. These agents will be responsible for writing code, running tests, and any other activities that are necessary to complete the tasks.

#### Step 4: Collect Report + Validate Repo/Build/Test State
After the agents have executed the tasks, they will generate task reports that contain the results of the execution. These reports will be collected and used to validate the state of the repository, the build, and the tests. This step ensures that the project is progressing as expected and that any issues are identified and addressed promptly.


### Final Review Pipeline:
After all the phases have been executed, we will have a final review process to ensure that everything is in order and that the project meets the requirements defined in the planning documents. This will involve a comprehensive review of the code, the tests, and any other relevant factors that can help ensure that the project is of high quality and meets the requirements defined in the planning documents. If any issues are identified during this review process, a final report will be generated that contains the details of the issues and any relevant information that can help guide the next steps in the project. The project ends at this point and time for human review and decision making about next steps, whether it's launching the feature, going back to the planning phase to address any issues, or any other relevant next steps.


#### Planning Pipeline:
PRD → Design → Architecture → Master Plan

#### Execution Pipeline:
Generate current Phase Doc
    ↓
Generate Task 1 from phase doc
    ↓
Agent executes
    ↓
Collect report + validate repo/build/test state
    ↓
Generate next task from:
  - phase doc
  - previous task result
  - current project state
    ↓
Repeat until phase exit criteria are met
    ↓
Run Phase Review --> Generate Phase Report --> Reasses Master Plan and Other planning docs to adjust as necessary
    ↓
Repeat and start next phase loop

#### Final Review Pipeline:
After all phases are complete → Run Final Review → Generate Final Report → Human Decision on next steps



