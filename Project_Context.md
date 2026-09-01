# Property Inspection Findings

## Project Goal

Build a small but production-minded property inspection findings application
for a software engineering take-home assignment.

The project has approximately 12 focused implementation hours.

The purpose is to demonstrate:

- Authentication
- Authorization
- Resource-level authorization
- API validation
- Secure file handling
- Business rules
- Automated testing
- Error handling
- Clean architecture
- AI integration

AI is an assistant, not the decision maker.

## Stack

Frontend:
- React
- Vite

Backend:
- Node.js
- Express

Database:
- PostgreSQL
- Prisma

Validation:
- Zod

Authentication:
- JWT
- bcrypt/Argon2

Testing:
- Unit tests
- Integration/API tests
- Critical E2E tests

AI:
- External AI provider
- Isolated behind an AI service abstraction

## Roles

ADMIN
- Manage users
- Manage properties
- Assign inspectors

INSPECTOR
- View assigned properties
- Start inspections
- Upload photos
- Generate AI finding drafts
- Edit findings
- Submit findings
- Correct rejected findings
- Resubmit findings

REVIEWER
- Review submitted findings
- Approve
- Reject
- Provide rejection reason

## Finding Workflow

DRAFT → SUBMITTED → APPROVED

or

SUBMITTED → REJECTED → SUBMITTED

Backend must enforce valid transitions.

Frontend must never be considered a security boundary.

## Authorization

Use:

RBAC + resource-level authorization

Backend must verify:

1. Authentication
2. Role
3. Resource access
4. Business rules

Protect against IDOR-style access.

## AI

Input:
- Photo
- Optional observation

Output:
- area
- category
- issue
- severity
- description
- recommendedAction

AI output is untrusted external input.

Validate it before use.

AI failure must allow manual entry.

Tests must mock the AI provider.

## Image Upload

Allowed:
- JPEG
- PNG
- WEBP

Maximum approximately 5 MB.

Never trust client filenames.

Use server-generated filenames.

## Security

Required:

- Password hashing
- JWT expiration
- Authentication middleware
- RBAC
- Resource authorization
- Backend validation
- File validation
- Safe filenames
- Environment variables
- Restricted CORS
- ORM/parameterized queries
- Safe error responses
- No secrets in Git

## Important Architecture Principle

Prefer simple, conventional architecture.

Do not introduce unnecessary:
- design patterns
- abstractions
- dependencies
- services
- folders

The project is intentionally small.

## Testing Principle

Testing happens alongside implementation.

For each meaningful feature:

Implement
→ secure
→ test
→ verify
→ continue

Prioritize:
- authentication
- authorization
- resource access
- validation
- state transitions
- AI failure handling
- file validation

## Scope

Do NOT build:

- complex analytics
- chat
- notifications
- mobile app
- advanced search
- complex inspection builder
- large design system
- extensive reporting

Cut UI polish before engineering fundamentals.

## Development Philosophy

The application should be small but production-minded.

The developer must understand and be able to explain the code.

Codex is an implementation accelerator, not the architect.