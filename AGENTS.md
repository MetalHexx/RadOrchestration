# Repo Rules
You must always follow these rules when editing or running the orchestration system from this repository.

## Canonical vs Runtime Test Code
- The root [skills](./skills/) folder is canonical source.
- The root [agents](./agents) folder is canonical source.
- The [.claude](./.claude/) is runtime compiled for testing. 
- The [.github](./.github) is runtime compiled for testing.

## Never EXECUTE the pipeline from the Canonical source!
- When invoking the orchestration pipeline to execute a project, never read or invoke the files from the canonical source.
- Never read or invoke skills from the canonical source
- Never read or invoke agents from the canonical source
- The canonical source is uncompiled and will return the wrong orchRoot for any non-Claude harness.

## Only EDIT the Canonical Source!
- When making code changes to improve the Rad Orchestration system, only edit the canonical source!
- Editing files the runtime compiled test files is incorrect! 

## DO NOT Add Requirements in Canonical Source
- When making changes to the rad orchestration pipeline and markdown files, do not leave requirements (FR-N, NFR-N, AD-N, DD-N) in the files. These should only be used in project planning documents, not actual code or documentation. The only exception is that we're making changes to the rad-create-plans or rad-code-review skills which leverage requirements as part of project planning and code review.