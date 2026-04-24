---
project: "FIXTURE"
type: master_plan
status: "draft"
created: "2026-04-18"
total_phases: 1
total_tasks: 1
author: "planner-agent"
---

# FIXTURE — Master Plan (malformed)

## Introduction

A preamble section that is valid prose, not a phase heading.

## P1: Single-digit phase id

This phase heading is missing the `P{NN}:` two-digit prefix — the parser should
reject it with a structured ParseError pointing at this line.

### P01-TX: Bad ID

Task id malformed — not matching `P{NN}-T{MM}:`.
