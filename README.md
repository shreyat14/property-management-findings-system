# Property Inspection Findings System

A full-stack property inspection management system that centralizes property assignments, inspections, findings, photos, AI-assisted documentation, and review workflows.

## Features

* JWT-based authentication
* Role-Based Access Control (RBAC)
* Resource-level authorization
* Property and inspector management
* Property assignments
* Inspection creation and completion
* Finding creation and editing
* Finding photo uploads
* Gemini-powered AI finding suggestions
* Reviewer approval and rejection workflow
* Finding status lifecycle: Draft → Submitted → Approved / Draft
* Automated backend and frontend tests

## User Roles

### Admin

* Create properties
* Create inspectors
* Assign inspectors to properties

### Inspector

* View assigned properties
* Create inspections
* Create and edit findings
* Upload finding photos
* Use AI assistance
* Submit findings for review
* Complete inspections

### Reviewer

* Review submitted findings
* View inspection and property context
* Approve findings
* Reject findings and return them to the Inspector for correction

## AI Workflow

AI is used only as an assistant during finding creation.

```text
Photo + Observation
        ↓
   Gemini Analysis
        ↓
   AI Suggestion
        ↓
Inspector Review/Edit
        ↓
  Create Finding
```

AI never directly creates or modifies a Finding.

## Tech Stack

* **Frontend:** React, Vite
* **Backend:** Node.js, Fastify
* **Database:** PostgreSQL, Prisma
* **Authentication:** JWT
* **AI:** Google Gemini
* **Testing:** Node.js Test Runner

## Project Structure

```text
Property_Management_Findings_System/
├── frontend/
├── backend/
└── README.md
```

## Getting Started

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Configure the required environment variables in `.env` files. Do not commit secrets.

## Testing

### Backend

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
npm test
npm run lint
npm run build
```

## Finding Workflow

```text
DRAFT
  ↓
SUBMITTED
  ├──→ APPROVED
  │
  └──→ DRAFT
        ↓
     Edit
        ↓
    Resubmit
```
