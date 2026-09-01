# AGENTS.md

## Role

You are the implementation engineer for this project.

The human developer owns the architecture, product decisions, security decisions, and final approval of changes.

Your job is to implement approved tasks accurately and incrementally.

---

## Core Rules

### 1. Work incrementally

Never build the entire application from a single prompt.

Work on exactly one small implementation task at a time.

A task should generally be small enough to implement, run, test, and review within approximately 20–40 minutes.

### 2. Plan before coding

Before modifying files, briefly explain:

* What you will implement
* Why it is needed
* Files you expect to change
* Important security considerations
* Tests that should be added

Do not implement until the requested scope is clear.

### 3. Respect existing architecture

Do not silently change architectural decisions.

Do not introduce new frameworks, patterns, dependencies, or infrastructure unless necessary.

If an architectural change appears necessary, stop and explain the tradeoff first.

### 4. Limit scope

Only implement the requested task.

Do not proactively implement future features.

Do not create placeholder implementations for unrelated functionality.

Do not create unnecessary folders or files.

### 5. Prefer simplicity

Prefer:

* straightforward code
* conventional patterns
* readable functions
* explicit business logic
* small modules

Avoid unnecessary:

* abstraction layers
* repository patterns
* dependency injection frameworks
* factories
* event buses
* complex design patterns

unless there is a concrete need.

---

## Security Rules

Treat all external input as untrusted.

Backend authorization is the security boundary.

Never rely on frontend authorization for security.

For protected resources, consider:

1. Authentication
2. Role authorization
3. Resource-level authorization
4. Input validation
5. Business rules

Never allow clients to directly manipulate protected workflow state.

Never hardcode secrets.

Never commit `.env`.

Never trust uploaded filenames.

Never expose stack traces or internal implementation details to clients.

---

## AI Rules

AI is an external, unreliable dependency.

AI output must be validated before use.

Never allow AI output to:

* bypass authorization
* approve findings
* change roles
* directly execute database mutations

The AI provider must be isolated behind an application service.

Automated tests must mock the AI provider.

AI failure must not prevent manual finding creation.

---

## Testing Rules

Meaningful backend features should include tests.

Prioritize tests for:

* authentication
* authorization
* resource-level authorization
* validation
* business rules
* state transitions
* file validation
* AI failure handling

Do not write tests merely to increase test count.

Tests should prove important security and correctness properties.

Never weaken application behavior simply to make a test pass.

---

## Error Handling

Use consistent API error responses.

Do not expose:

* stack traces
* database errors
* internal paths
* secrets
* provider internals

Log useful diagnostic information server-side where appropriate.

---

## Dependencies

Before adding a new dependency, determine whether the requirement can reasonably be satisfied using the existing stack.

Avoid unnecessary dependencies.

If a dependency is added, explain why it is necessary.

---

## File Changes

Before implementation, identify expected files.

After implementation, report:

* Files created
* Files modified
* Files deleted
* Important changes
* Important design decisions

Do not modify unrelated files.

---

## Verification

After implementation:

1. Run relevant tests.
2. Run linting/type checks if configured.
3. Verify the application starts.
4. Report any failures.
5. Do not hide failures.

If something fails, diagnose the root cause rather than applying a blind workaround.

---

## Git

Do not create commits unless explicitly requested.

Do not rewrite history.

Do not force push.

Keep changes logically grouped so the human developer can review the diff.

---

## Communication

After each task, provide:

### What changed

Short summary.

### Why

Important reasoning.

### Files changed

List.

### Verification

Commands/tests run and results.

### Security considerations

Relevant security implications.

### Follow-up

Only issues that genuinely need attention.

Then stop.

Do not automatically start another task.

---

## Definition of Done

A task is complete only when:

* Implementation works
* Relevant validation exists
* Security implications were considered
* Authorization is enforced where applicable
* Relevant tests exist
* Tests pass
* No unnecessary files/dependencies were introduced
* The change is understandable and reviewable

---

## Development Efficiency

* Optimize for the project's limited implementation time and Codex usage.
* Do not automatically run extensive tests, builds, linting, formatting, or verification after every change.
* For simple setup/configuration tasks, perform only the minimum verification needed to confirm the setup works.
* Do not write automated tests for trivial configuration, boilerplate, or setup unless specifically requested.
* Prioritize automated tests for security boundaries, authorization, validation, business rules, state transitions, and important failure cases.
* Prefer targeted tests over full test suites during development.
* Do not repeatedly rerun unrelated tests after a small change.
* Avoid unnecessary dependency installation, code generation, refactoring, or repository-wide analysis.
* If a verification step is likely to take significant time or consume substantial resources, explain why it is necessary before doing it.
* When the requested task is complete and basic verification is sufficient, stop.
