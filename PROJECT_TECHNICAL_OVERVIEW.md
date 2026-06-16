# Predictive CRM Project - Technical and Functional Overview

## 1. Project Summary

This project is a full-stack predictive CRM platform designed to centralize lead management, structure the commercial process, monitor sales activity, and progressively integrate artificial intelligence for lead scoring and conversion prediction.

The application is organized into three major parts:

- a `frontend` web application built with React and Vite
- a `backend` API built with NestJS and Prisma
- an `ia` module built in Python for dataset export, model training, inference, and FastAPI exposure

The current system already supports the operational CRM core:

- authentication and user profile management
- role-based access control
- lead lifecycle management
- pipeline visualization
- task management
- interaction tracking
- notifications
- dashboard and reporting
- audit trail of modifications
- AI prediction integration in the lead detail view

The project is not only a CRUD CRM. It is structured around business workflows for sales teams, management, marketing teams, and AI-assisted prioritization.

## 2. Global Objectives of the System

The platform addresses the following business goals:

- centralize leads and commercial data in one system
- assign leads to responsible users
- structure the sales process with clear stages
- track tasks and interactions around each lead
- notify users about important events
- provide dashboards and visibility on commercial activity
- prepare and integrate predictive AI for conversion probability
- secure access to data according to user role

## 3. Repository Structure

```text
CRM/
|- backend/     NestJS API + Prisma + PostgreSQL access
|- frontend/    React application
|- ia/          Python AI pipeline and FastAPI service
|- PROJECT_TECHNICAL_OVERVIEW.md
```

### `backend/`

Contains the business API, security, database access, dashboard logic, file upload, notifications, and role-aware business rules.

### `frontend/`

Contains all user interfaces: login, dashboard, leads, pipeline, tasks, profile, settings, and user management.

### `ia/`

Contains the machine learning workflow:

- data extraction from PostgreSQL
- dataset generation
- CatBoost training
- threshold optimization
- prediction CLI
- FastAPI microservice for inference

## 4. Main Technologies Used

## 4.1 Frontend Technologies

- React 19
- TypeScript
- Vite
- React Router
- `@hello-pangea/dnd` for drag and drop in the pipeline
- `framer-motion` for motion and interface transitions
- `lucide-react` for icons
- `socket.io-client` for live notifications

## 4.2 Backend Technologies

- NestJS 10
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication with Passport
- class-validator and class-transformer for DTO validation
- Multer for file upload
- Socket.IO for notifications
- Swagger for API documentation in non-production mode

## 4.3 AI Technologies

- Python 3
- pandas
- CatBoost
- scikit-learn
- FastAPI
- Uvicorn
- psycopg2 or PostgreSQL connection through parsed `DATABASE_URL`

## 4.4 Infrastructure and Runtime

- PostgreSQL database
- Docker Compose available in backend for local database bootstrapping
- HTTP communication between React, NestJS, and FastAPI
- WebSocket communication for real-time notifications

## 5. Main Actors of the System

The application is designed around several actors.

### 5.1 Administrator

Main responsibilities:

- manage users
- view all leads
- create, update, archive, unarchive, and delete leads
- manage tasks globally
- access all dashboard data
- export AI data
- supervise the whole system

### 5.2 Sales User

Main responsibilities:

- work on personally assigned leads
- update owned leads
- move owned leads in the pipeline
- add interactions on owned leads
- manage relevant tasks
- view lead prediction in the lead detail
- follow dashboard and operational activity

### 5.3 Marketing User

Main responsibilities:

- create new leads
- import leads from CSV
- manage lead acquisition sources
- create tasks related to leads
- consult commercial data allowed by role

### 5.4 Executive User

Main responsibilities:

- consult dashboards and global commercial data
- view the pipeline in read-only mode
- create and assign tasks for sales users
- export AI data
- follow performance without full admin powers

### 5.5 External System

This actor represents integrations or inbound capture mechanisms.

Main responsibilities:

- send leads to the CRM through the webhook endpoint

### 5.6 AI Service

This is an internal technical actor rather than a human actor.

Main responsibilities:

- receive features for a lead
- compute conversion probability
- return score and qualitative label

## 6. Roles and Access Control

The system enforces access control at several levels:

- route level in the frontend
- controller level in the backend
- service level in the backend
- data filtering according to lead owner or task assignee

### 6.1 Supported Roles

- `ADMIN`
- `SALES`
- `MARKETING`
- `EXECUTIVE`

### 6.2 Access Matrix Overview

| Area | ADMIN | SALES | MARKETING | EXECUTIVE |
|---|---|---|---|---|
| Login and profile | Yes | Yes | Yes | Yes |
| Dashboard | Yes | Yes | Yes | Yes |
| Leads page | Yes | Yes | Yes | Yes |
| Pipeline view | Yes | Yes | No | Yes, read-only |
| Tasks page | Yes | Yes | Yes | Yes |
| Users management | Yes | No | No | Read list only for assignment support |
| Lead import CSV | Yes | No | Yes | No |
| Lead export AI | Yes | Yes, only own leads | No | Yes |
| Delete lead | Yes | No | No | No |
| Archive and unarchive lead | Yes | No | No | No |
| Assign task to other users | Yes | No | No | Yes |
| Create task for sales | Yes | Limited | Limited | Yes |

### 6.3 Role-Aware Data Filtering

Important business filtering rules include:

- sales users mainly see their own assigned leads in backend filtering
- executives can access management views but are intentionally limited on direct operational editing in some areas
- AI export is restricted so sales users can only export their own assigned leads
- task assignment is restricted to users with role `SALES`

## 7. Core Business Entities

The database schema is centered around operational CRM data.

### 7.1 User

Represents an authenticated application user.

Key fields:

- `id`
- `email`
- `passwordHash`
- `firstName`
- `lastName`
- `phone`
- `role`
- `profilePhotoPath`
- `createdAt`
- `updatedAt`

### 7.2 Lead

Represents a prospect in the sales process.

Key fields:

- `id`
- `firstName`
- `lastName`
- `email`
- `phone`
- `company`
- `source`
- `stage`
- `score`
- `conversionProbability`
- `notes`
- `ownerId`
- `consentDate`
- `dataOrigin`
- `isAnonymized`
- `createdAt`
- `updatedAt`

### 7.3 Interaction

Represents a commercial interaction linked to a lead.

Key fields:

- `id`
- `type`
- `content`
- `leadId`
- `userId`
- `createdAt`

### 7.4 Task

Represents a commercial action or follow-up item.

Key fields:

- `id`
- `title`
- `description`
- `type`
- `status`
- `priority`
- `progress`
- `dueDate`
- `completedAt`
- `leadId`
- `assignedToId`
- `createdById`
- `overdueNotifiedAt`
- `reminderNotifiedAt`
- `createdAt`
- `updatedAt`

### 7.5 TaskAttachment

Represents a file uploaded to a task.

Key fields:

- `id`
- `taskId`
- `uploadedById`
- `originalName`
- `mimeType`
- `size`
- `storagePath`
- `createdAt`

### 7.6 AuditLog

Represents traceability of modifications.

Key fields:

- `id`
- `userId`
- `action`
- `entityType`
- `entityId`
- `oldValue`
- `newValue`
- `createdAt`

### 7.7 Notification

Represents a user notification.

Key fields:

- `id`
- `userId`
- `title`
- `content`
- `read`
- `createdAt`

## 8. Business Enums and Workflow States

### 8.1 Lead Stages

The lead pipeline is localized in French:

- `Nouveau`
- `Contacte`
- `Qualifie`
- `Proposition`
- `Gagne`
- `Perdu`

These stages are used consistently in backend storage and frontend display.

### 8.2 Interaction Types

- `EMAIL`
- `CALL`
- `MEETING`
- `NOTE`

### 8.3 Task Types

The task model was explicitly changed so that task type represents a commercial action instead of a role:

- `CALL`
- `EMAIL`
- `MEETING`
- `TODO`

### 8.4 Task Status

- `OPEN`
- `IN_PROGRESS`
- `DONE`
- `CANCELED`

### 8.5 Task Priority

- `LOW`
- `MEDIUM`
- `HIGH`

## 9. Backend Architecture

The backend follows a modular NestJS architecture with a clear separation of concerns.

### 9.1 Global Backend Components

- `main.ts` bootstraps the app, enables CORS, validation, filters, Swagger, and global interceptors
- `app.module.ts` imports all functional modules
- `PrismaModule` and `PrismaService` centralize database access
- global exception filter hides technical details from end users
- request ID middleware adds traceability to requests
- audit interceptor logs write operations

### 9.2 Backend Modules

- `AuthModule`
- `LeadsModule`
- `InteractionsModule`
- `TasksModule`
- `NotificationsModule`
- `UsersModule`
- `DashboardModule`
- `IaService` used by leads

## 10. Backend Functionalities by Module

## 10.1 Authentication Module

### Main functionalities

- bootstrap first admin account when no user exists
- login with JWT
- logout
- admin registration of users
- current user profile retrieval
- current user profile update
- current user profile photo upload
- current user profile photo retrieval
- password change

### Security characteristics

- password hashing with bcrypt
- JWT accepted from bearer token or HTTP-only cookie
- invalid credentials hidden behind generic error
- DTO validation on inputs

### Endpoints

| Method | Endpoint | Purpose | Main Access |
|---|---|---|---|
| POST | `/auth/bootstrap` | Create first admin if system is empty | Public, guarded by empty-system logic |
| POST | `/auth/login` | Login and issue JWT | Public |
| POST | `/auth/logout` | Logout and clear cookie | Authenticated |
| POST | `/auth/register` | Create a user | ADMIN |
| GET | `/auth/me` | Get current user | Authenticated |
| PATCH | `/auth/me` | Update current user profile | Authenticated |
| POST | `/auth/me/photo` | Upload current user profile photo | Authenticated |
| GET | `/auth/me/photo` | Read current user profile photo file | Authenticated |
| POST | `/auth/change-password` | Change password | Authenticated |

## 10.2 Leads Module

This is the central business module of the application.

### Main functionalities

- create leads
- list leads with pagination and search
- filter visibility according to role
- update lead information
- change lead stage
- archive and unarchive leads
- delete leads
- import leads from CSV
- ignore duplicates during CSV import by email or phone
- return import summary with added, existing, and error counts
- create notifications on important events
- receive leads from a protected webhook
- export AI dataset
- expose lead activity timeline
- expose lead AI prediction
- keep audit trail of modifications

### Important business rules

- `limit` in lead pagination is capped to `100` to avoid abuse
- duplicate CSV entries are ignored instead of overwriting existing leads
- some actions are restricted to lead owner or admin
- archived leads are logically anonymized through `isAnonymized`
- sales AI export is restricted to their own leads

### Endpoints

| Method | Endpoint | Purpose | Main Access |
|---|---|---|---|
| GET | `/leads` | Paginated lead listing | Authenticated, filtered by role |
| POST | `/leads` | Create a lead | ADMIN, SALES, MARKETING |
| GET | `/leads/:id` | Get one lead | Authenticated with service-level access control |
| PATCH | `/leads/:id` | Update lead | Role-aware, owner-aware |
| DELETE | `/leads/:id` | Delete lead | ADMIN |
| POST | `/leads/import` | Import CSV file | ADMIN, MARKETING |
| POST | `/leads/webhook` | Create lead from external system | Webhook secret required |
| POST | `/leads/:id/archive` | Archive lead | ADMIN |
| POST | `/leads/:id/unarchive` | Restore archived lead | ADMIN |
| GET | `/leads/export-ai` | Export AI dataset | ADMIN, EXECUTIVE, SALES with filtering |
| GET | `/leads/:id/activity` | Get audit history for one lead | Authenticated with access checks |
| GET | `/leads/:id/prediction` | Get AI prediction for one lead | Authenticated with access checks |

## 10.3 Interactions Module

### Main functionalities

- create interaction on a lead
- list interactions with pagination and filtering
- read one interaction
- update one interaction
- delete one interaction

### Business rules

- interactions are attached to leads
- creation is limited mainly to operational roles
- update and delete are controlled by creator or admin

### Endpoints

| Method | Endpoint | Purpose | Main Access |
|---|---|---|---|
| POST | `/interactions` | Create interaction | ADMIN, SALES |
| GET | `/interactions` | List interactions | Authenticated with role filtering |
| GET | `/interactions/:id` | Read one interaction | Authenticated with access checks |
| PATCH | `/interactions/:id` | Update interaction | Creator or ADMIN |
| DELETE | `/interactions/:id` | Delete interaction | Creator or ADMIN |

## 10.4 Tasks Module

### Main functionalities

- create tasks
- list tasks with filters, sorting, and pagination
- get task statistics
- read one task
- update task
- delete task
- upload, list, download, and delete task attachments
- expose task activity history
- run background reminders for overdue and near-due tasks

### Business rules

- task types are `CALL`, `EMAIL`, `MEETING`, `TODO`
- tasks can only be assigned to users with role `SALES`
- executive users can create tasks for sales but are limited in later modification flows
- access to tasks depends on creator, assignee, lead ownership, and admin privileges
- uploads are restricted by MIME type and size

### Endpoints

| Method | Endpoint | Purpose | Main Access |
|---|---|---|---|
| POST | `/tasks` | Create task | ADMIN, SALES, MARKETING, EXECUTIVE |
| GET | `/tasks` | List tasks | Authenticated with role filtering |
| GET | `/tasks/stats` | Task KPI summary | Authenticated |
| GET | `/tasks/:id` | Get one task | Authenticated with access checks |
| PATCH | `/tasks/:id` | Update task | Role-aware, creator/assignee/admin logic |
| DELETE | `/tasks/:id` | Delete task | Role-aware |
| GET | `/tasks/:id/activity` | Get task audit/activity | Authenticated with access checks |
| GET | `/tasks/:id/attachments` | List task attachments | Authenticated with access checks |
| POST | `/tasks/:id/attachments` | Upload attachment | Role-aware |
| DELETE | `/tasks/attachments/:attachmentId` | Delete attachment | Role-aware |
| GET | `/tasks/attachments/:attachmentId/download` | Download attachment | Authenticated with path safety |

## 10.5 Notifications Module

### Main functionalities

- list user notifications
- mark notifications as read
- send direct notifications
- send broadcast notifications to the whole team
- push notifications in real time through Socket.IO

### Business rules

- each user only reads and updates their own notifications
- broadcast creation is done transactionally to avoid partial notification distribution

### Endpoints

| Method | Endpoint | Purpose | Main Access |
|---|---|---|---|
| GET | `/notifications` | List current user notifications | Authenticated |
| PATCH | `/notifications/:id/read` | Mark notification as read | Authenticated owner |

## 10.6 Users Module

### Main functionalities

- create users
- list users
- read user profile by id
- update users
- delete users

### Business rules

- management is reserved to admins
- executives can read the list of users to support task assignment workflows

### Endpoints

| Method | Endpoint | Purpose | Main Access |
|---|---|---|---|
| POST | `/users` | Create user | ADMIN |
| GET | `/users` | List users | ADMIN, EXECUTIVE |
| GET | `/users/:id` | Read one user | ADMIN |
| PATCH | `/users/:id` | Update user | ADMIN |
| DELETE | `/users/:id` | Delete user | ADMIN |

## 10.7 Dashboard Module

### Main functionalities

- global KPI overview
- pipeline distribution
- source distribution
- performance by owner
- trends over time
- recent activity
- conversion view by stage

### Business rules

- sales users see only their own business scope
- other roles can access global aggregations
- some heavy aggregations are pushed to the database using Prisma `groupBy`

### Endpoints

| Method | Endpoint | Purpose | Main Access |
|---|---|---|---|
| GET | `/dashboard/overview` | Main KPIs | Authenticated |
| GET | `/dashboard/pipeline` | Leads by stage | Authenticated |
| GET | `/dashboard/by-source` | Leads by source | Authenticated |
| GET | `/dashboard/by-owner` | Performance by owner | Authenticated |
| GET | `/dashboard/trends` | Time-based trend data | Authenticated |
| GET | `/dashboard/activity` | Recent activity | Authenticated |
| GET | `/dashboard/stage-conversion` | Stage conversion view | Authenticated |

## 10.8 Health Endpoint

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Simple backend health check |

## 11. Frontend Architecture and Interfaces

The frontend is a React single-page application using route protection, a shared API client, and a shared auth context.

### Core frontend architecture

- `AuthContext` stores the logged-in user and session state
- `client.ts` centralizes HTTP requests and error handling
- `App.tsx` defines protected routes and route-level role restrictions
- `AppLayout.tsx` provides sidebar, top bar, search, and navigation shell
- `NotificationBell.tsx` provides API plus WebSocket notification UI
- `ToastProvider.tsx` provides modern in-app notifications instead of browser alerts
- `ErrorBoundary.tsx`, `AppErrorPage.tsx`, and `NotFoundPage.tsx` provide professional error handling

## 12. Main UI Interfaces Developed

## 12.1 Login Interface

Main interface elements:

- email input
- password input
- authentication error display
- loading state

Main purpose:

- allow authenticated access to the CRM

## 12.2 Dashboard Interface

Main interface elements:

- KPI cards
- stage distribution
- leads by source
- performance by owner
- recent activity
- refresh action

Main purpose:

- provide a management and monitoring entry point for the application

## 12.3 Leads Interface

This is one of the richest interfaces in the project.

Main interface elements:

- leads table
- search bar
- pagination
- create lead modal
- edit lead modal
- CSV import action
- AI export action
- archive and delete actions according to role
- lead side panel
- task creation modal inside lead detail
- interactions section
- audit history section
- AI prediction block

Main purpose:

- central operational screen for lead handling

## 12.4 Pipeline Interface

Main interface elements:

- Kanban columns by stage
- drag and drop cards
- score and probability display
- filters
- lead side panel

Main purpose:

- visualize the commercial pipeline and stage progression

Important note:

- executives have read-only access to the pipeline UI
- drag and drop is restricted to authorized roles

## 12.5 Tasks Interface

Main interface elements:

- task list view
- task kanban view
- task filters
- task statistics
- create modal
- detail and edit modal
- attachment upload and download
- activity history

Main purpose:

- organize commercial actions and follow-up execution

## 12.6 Users Interface

Main interface elements:

- users table
- create user modal
- edit user modal
- delete action

Main purpose:

- provide user administration for admins

## 12.7 Profile Interface

Main interface elements:

- profile avatar
- upload photo button
- current user name
- email
- editable first name
- editable last name
- editable phone
- role
- profile update action
- profile photo upload status feedback

Main purpose:

- display and edit current profile information without exposing forbidden internal identifiers

## 12.8 Settings Interface

Main interface elements:

- update name fields
- change password
- logout

Main purpose:

- allow self-service profile and security updates

## 12.9 Error Interfaces

Main interface elements:

- custom application error page
- centered not-found page
- graceful API failure behavior

Main purpose:

- replace framework default errors with professional UI

## 13. Key Functionalities Already Implemented

The codebase currently implements the following important business features.

### 13.1 Authentication and Session

- user login
- JWT-based session
- cookie and bearer token support
- current profile retrieval
- current profile edition
- current profile photo upload
- password change
- logout

### 13.2 Lead Management

- create lead
- update lead
- delete lead
- archive lead
- unarchive lead
- view lead detail
- track lead owner
- manage lead stage
- protect archived leads

### 13.3 Lead Import and Export

- CSV import of leads
- duplicate detection by email or phone
- insert-only import strategy
- summary of added, existing, and error records
- team-wide notification after import
- AI dataset export

### 13.4 Pipeline Management

- stage-based pipeline
- drag and drop stage movement
- pipeline filtering
- show all leads according to backend visibility rules
- stage naming aligned with the database

### 13.5 Interaction Management

- add interaction on a lead
- classify interaction by type
- list history of interactions
- link interaction to author

### 13.6 Task Management

- create task from general task page
- create task from lead side panel
- assign tasks only to sales users
- use commercial action types instead of role-like task types
- update task status and progress
- upload task attachments
- download task attachments
- reminders for overdue or upcoming tasks

### 13.7 Notifications

- in-app notification list
- real-time notification reception
- mark as read
- broadcast team notifications

### 13.8 Audit and Traceability

- audit logging of write operations
- lead history panel
- task activity retrieval
- request ID support for debugging

### 13.9 Dashboard and Analytics

- KPI overview
- stage distribution
- source distribution
- owner performance
- trends and activity timeline

### 13.10 AI Prediction

- export historical training dataset
- train CatBoost model
- optimize decision threshold
- save model and reports
- expose FastAPI `/predict`
- backend feature engineering
- show AI block in lead detail view

## 14. AI Module Overview

The AI module is already integrated as a separate technical subsystem.

## 14.1 AI Pipeline Components

### `export_leads.py`

Purpose:

- connect to PostgreSQL
- extract historical leads
- aggregate features from leads, interactions, and tasks
- build a supervised CSV dataset with target `converted`

### `train_model.py`

Purpose:

- load dataset
- prepare features
- handle class imbalance using `class_weights`
- train `CatBoostClassifier`
- optimize threshold
- compute metrics
- save model and reports

Outputs:

- `ia/models/lead_conversion_catboost.cbm`
- `ia/reports/training_metrics.json`
- `ia/reports/feature_importance.csv`

### `predict_lead.py`

Purpose:

- load model and training report
- accept lead features
- compute probability
- convert probability to score out of 100
- generate qualitative label `Faible`, `Moyenne`, `Élevée`

### `api.py`

Purpose:

- expose `GET /health`
- expose `POST /predict`
- load model once at startup
- enable CORS
- optionally protect access with API key

## 14.2 AI Features Used

Current model features include:

- `source`
- `has_company`
- `owner_role`
- `interaction_count`
- `call_count`
- `email_interaction_count`
- `meeting_interaction_count`
- `task_count`
- `completed_task_count`
- `open_task_count`
- `overdue_task_count`
- `call_task_count`
- `email_task_count`
- `meeting_task_count`
- `todo_task_count`
- `avg_task_progress`
- `days_since_last_activity`
- `days_since_creation`

## 14.3 Current Model Metrics

According to the current training report:

- model type: `CatBoostClassifier`
- train size: `218`
- test size: `55`
- class weights: `[1.0, 1.8312]`
- best threshold: `0.0311`
- accuracy: `0.7091`
- precision: `0.5556`
- recall: `1.0000`
- F1-score: `0.7143`
- ROC-AUC: `0.7936`

Interpretation:

- the model is already usable as a prototype decision support tool
- recall is very strong, meaning the model catches all positives in the test split
- precision is moderate, meaning false positives still exist
- the threshold is currently very low, favoring sensitivity over strict precision

## 14.4 Current AI Integration Path

The runtime prediction chain is:

`React -> NestJS -> FastAPI -> CatBoost model`

Detailed flow:

1. the user opens a lead detail in the React interface
2. the frontend calls `GET /leads/:id/prediction`
3. the NestJS backend loads the lead and derives business features
4. the backend calls `POST http://localhost:8000/predict`
5. FastAPI computes the result from the trained model
6. the backend returns a simplified payload to the frontend
7. the frontend displays score, probability, and label

## 15. Security Measures Implemented

Security is a major aspect of the project and is present in multiple layers.

### 15.1 Authentication Security

- JWT-based authentication
- bearer token support
- HTTP-only cookie support
- bcrypt password hashing
- protected endpoints with guards

### 15.2 Authorization Security

- role-based access control with decorators and guards
- service-level ownership checks
- restricted task assignment
- restricted export visibility for AI dataset

### 15.3 Input Validation

- DTO validation with class-validator
- global whitelist and forbidden non-whitelisted properties
- transformed validated input types
- bounded pagination limits

### 15.4 Error Handling and Exposure Control

- custom exception filter
- no raw technical error pages exposed to end users
- request IDs attached to error responses
- professional frontend error pages

### 15.5 File Upload Security

- MIME type restrictions
- file size limit
- controlled task upload directory
- controlled profile photo upload directory
- path traversal protection on download

### 15.6 Webhook Security

- secret-based protection
- secure comparison using `crypto.timingSafeEqual`

### 15.7 Transactional Safety

- notification broadcast creation grouped in Prisma transaction
- protects against partial delivery in database writes

### 15.8 Data Protection Logic

- logical anonymization for archived leads
- role-aware data access restrictions
- hidden profile internal identifier in the profile UI

## 16. Real-Time and Background Processes

The application is not limited to request-response behavior.

### Real-time notifications

- Socket.IO gateway
- authentication on websocket connection
- user-specific rooms
- immediate UI refresh in notification bell

### Background reminders

- periodic task reminder runner
- overdue task detection
- near-due task detection
- notification creation for responsible users

## 17. API Communication Model

### Frontend to Backend

The frontend always communicates with the NestJS API through a shared `fetch` wrapper.

Main characteristics:

- JSON-oriented communication
- unified `ApiError`
- credentials sent with requests
- shared base URL configuration

### Backend to Database

The backend uses Prisma to communicate with PostgreSQL.

Main characteristics:

- typed queries
- relation loading
- aggregation queries
- transaction support

### Backend to AI Service

The backend calls FastAPI with HTTP POST.

Main characteristics:

- timeout control
- optional API key
- normalized AI response contract
- graceful failure through service unavailability errors

### Backend to Frontend via WebSocket

Notifications are pushed in real time using Socket.IO.

## 18. Main User Interfaces and Business Workflows

Several cross-cutting workflows are already implemented.

### 18.1 Lead Creation Workflow

1. user opens lead creation form
2. frontend submits lead data
3. backend validates DTO
4. backend creates lead in database
5. lead becomes available in list and pipeline depending on role

### 18.2 CSV Import Workflow

1. marketing or admin uploads CSV
2. backend parses each row
3. backend checks whether email or phone already exists
4. existing records are ignored
5. new records are inserted
6. summary is returned
7. team notification is created

### 18.3 Lead Update Workflow

1. authorized user edits lead
2. backend validates access and changes
3. audit information is recorded
4. frontend refreshes detail panel and history

### 18.4 Task Creation Workflow

1. user opens task form
2. user selects type, due date, lead, and assignee
3. backend verifies business rules
4. assignee must be a sales user
5. task is created and becomes visible in task views

### 18.5 AI Prediction Workflow

1. user opens lead detail
2. frontend requests prediction from backend
3. backend computes features from current lead state
4. backend calls FastAPI model
5. frontend displays probability, score, and label

## 19. Strengths of the Current Implementation

The current codebase already demonstrates several strong engineering qualities.

- clean separation between frontend, backend, and AI
- real role-based restrictions beyond simple UI hiding
- audit and traceability support
- professional error handling
- bounded pagination and safer server behavior
- secure webhook secret comparison
- transactional notification broadcast
- background reminder processing
- AI integration already connected to the CRM UI

## 20. Current Limitations and Ongoing Nature of the Project

Since the project is still evolving, some elements should be presented as current implementation status rather than final production maturity.

Important current-state observations:

- the AI model is already integrated but should still be improved for precision and threshold tuning
- some AI-related export contracts may still require harmonization between frontend expectations and backend payload shape
- the pipeline currently mixes stored lead fields and live AI prediction concepts, which may evolve further
- the project is functional and advanced, but still open to iterative optimization

## 21. Suggested Academic Positioning

For an academic report, this project can be positioned as:

- a predictive CRM platform with role-based business workflows
- a web information system combining operational CRM and machine learning
- a progressive architecture where AI is introduced as a decision-support layer on top of an existing CRM core

## 22. Conclusion

This project is a complete and evolving predictive CRM platform that already covers the essential operational needs of lead management, sales pipeline control, tasks, interactions, notifications, dashboards, role-based access, auditability, and AI-assisted lead prediction.

Its architecture is modular and coherent:

- React handles the user experience
- NestJS enforces business rules and security
- Prisma structures database access
- PostgreSQL stores operational CRM data
- Python and FastAPI provide predictive intelligence

From a technical and academic perspective, the project is rich because it combines:

- full-stack web engineering
- secure API design
- role-based business logic
- real-time communication
- file management
- auditability
- data preparation and machine learning integration

This makes it a strong foundation both for continued development and for academic reporting.
