# DevArena Project Structure and Feature Register

Last reviewed: 2026-07-24

This file is the living technical map for DevArena. Update it whenever a route,
feature, data model, integration, or major directory changes.

## 1. Project summary

DevArena is a developer activity and growth platform organized as an npm
workspace. The `frontend` workspace contains the React/Vite single-page
application; the `backend` workspace contains the Express API, PostgreSQL access
through Prisma, and server integrations. Firebase provides social
authentication via Google and GitHub popups.

### Main stack

| Layer | Technology |
| --- | --- |
| Client | React 19, TypeScript, React Router, Vite |
| API | Express 5, TypeScript, `tsx` |
| Primary database | PostgreSQL/Neon through Prisma |
| Authentication | Custom JWT for email auth; Firebase Auth for Google/GitHub |
| Email | Nodemailer over configurable SMTP |
| Styling | Plain CSS in feature-owned `styles/` folders and `frontend/src/shared/styles` |

### Runtime flow

```text
Browser (Vite :5173)
  |-- /api/* --------------------------------> Express (:4000)
  |                                               |
  |                                               +--> Prisma --> PostgreSQL/Neon
  |
  +-- Google/GitHub authentication ------------> Firebase Auth
```

In development, Vite proxies `/api` to `http://localhost:4000` unless
`VITE_API_PROXY_TARGET` overrides it.

## 2. Repository map

```text
Dev_Arena/
|-- AGENTS.md                  Codex/project working instructions
|-- FEATURE_DEVELOPMENT_GUIDE.md
|                              How to add frontend, backend, and full-stack features
|-- PROJECT_STRUCTURE.md       Current project map, feature register, and known gaps
|-- README.md                  Project overview
|-- frontend/
|   |-- public/                Static images and SVG assets
|   |-- src/
|   |   |-- app/               React app shell, providers, and router
|   |   |-- config/            Firebase client configuration
|   |   |-- features/          Feature-owned frontend code
|   |   |   |-- auth/           Auth pages, auth context, auth API helper, 2FA/password-reset UI
|   |   |   |-- blog/           Blog, new-post, draft pages, draft modal, and blog CSS
|   |   |   |-- dashboard/      Dashboard page, dashboard CSS, and rank utility
|   |   |   |-- home/           Landing, home, about pages, home/about components, and CSS
|   |   |   |-- profile/        Profile page and profile CSS
|   |   |   |-- releases/      Updates page, release timeline component, and updates CSS
|   |   |   `-- support/       Support page and support CSS
|   |   |-- services/          Frontend view-model, mapping, and display computation services
|   |   |-- shared/            Shared layouts, components, hooks, lib, types, and styles
|   |   |   |-- components/     Reusable UI and app-shell components
|   |   |   |-- hooks/
|   |   |   |-- layouts/        Application layout shells
|   |   |   |-- lib/
|   |   |   |-- types/
|   |   |   `-- styles/         Shared/global CSS, plus preserved legacy CSS
|   |   |-- App.tsx            Removed; replaced by `src/app/App.tsx`
|   |   `-- main.tsx           React entry point
|   |-- index.html             Vite HTML entry point
|   |-- package.json           Frontend dependencies and scripts
|   `-- vite.config.ts         Vite client and API proxy config
|-- backend/
|   |-- prisma/
|   |   |-- migrations/        PostgreSQL migration history
|   |   |-- schema.prisma      Database models, enums, relations, and indexes
|   |   `-- seed.js            Database seed data
|   |-- src/
|   |   |-- database/          Shared database client and connection checks
|   |   |-- middleware/        JWT protection and API error handling
|   |   |-- modules/           Feature modules with routes/controllers/services
|   |   |-- scripts/           Maintenance scripts such as DB checks
|   |   |-- shared/            Shared backend types and utilities
|   |   |-- app.ts             Express app, middleware, routes, and handlers
|   |   `-- server.ts          Backend startup and port binding
|   |-- package.json           Backend dependencies and scripts
|   `-- prisma.config.ts       Prisma schema, migration, and datasource config
|-- devarena-nav-guide.md      Older navigation-specific implementation guide
|-- package.json               Root npm workspace commands and tooling
`-- package-lock.json          Shared dependency lockfile
```

### Directory responsibilities

- `frontend/src/app` owns the React app shell, providers, and route table.
- `FEATURE_DEVELOPMENT_GUIDE.md` explains the standard process for adding new
  frontend, backend, and full-stack features.
- `frontend/src/features/auth` owns auth screens, auth context, protected route,
  auth API helper, color 2FA UI, password reset modal, and auth-specific styles.
- `frontend/src/features/auth/api/AuthService.ts` is a small barrel export for
  auth API modules.
- `frontend/src/features/auth/api/AuthConstants.ts` owns auth endpoint paths,
  storage keys, social provider labels, password-strength labels, email regex,
  and color-2FA constants.
- `frontend/src/features/auth/api/AuthTypes.ts` owns shared auth interfaces and
  type aliases used by auth services, context, pages, and auth components.
- `frontend/src/features/auth/api/AuthStorageService.ts` is the only frontend
  module that should read or write auth token storage directly.
- Auth behavior is split into focused files:
  `AuthStorageService.ts`, `AuthSessionService.ts`, `AuthValidationService.ts`,
  `EmailAuthService.ts`, `SocialAuthService.ts`, `FirebaseUserSyncService.ts`,
  `TwoFactorAuthService.ts`,
  `PasswordResetService.ts`, and `AuthResponseService.ts`.
- `frontend/src/features/blog` owns blog listing, new-post editor, drafts page,
  draft modal, and blog/draft-specific CSS.
- `frontend/src/features/dashboard` owns the dashboard page, dashboard-specific
  CSS, and rank calculation utility.
- `frontend/src/features/home` owns the public landing/home/about pages,
  home/about-specific components, and their CSS.
- `frontend/src/features/releases` owns the Updates page, release timeline UI,
  and release/update-specific CSS.
- `frontend/src/features/profile` owns the Profile page and profile-specific CSS.
- `frontend/src/features/support` owns the Support page and support-specific CSS.
- `frontend/src/services` contains frontend service functions that convert API
  responses or client-side data into UI-ready view models and keep reusable
  display calculations out of route components.
- `frontend/src/services/HeatmapService.ts` owns shared contribution heatmap
  helpers used by dashboard and profile.
- `frontend/src/services/DashboardService.ts` owns dashboard view-model
  calculations and retrieves the dashboard bearer token through
  `AuthStorageService.ts` instead of reading browser storage directly.
- `frontend/src/services/ProfileService.ts` owns profile heatmap view-model
  calculations.
- `frontend/src/services/ReleaseService.ts` owns release response mapping and
  date formatting for the updates page.
- `frontend/src/services/BlogService.ts` owns blog/draft response mapping, date
  formatting, and post/draft client operations.
- `frontend/src/shared/layouts/AppLayout.tsx` owns the authenticated app shell.
- `frontend/src/shared/layouts/DashboardLayout.tsx` is preserved as a legacy
  dashboard shell component.
- `frontend/src/shared/components` contains reusable UI and app-shell components
  such as `Header`, `Sidebar`, `TopBar`, `QuickLogModal`, `Pagination`,
  `NotificationPanel`, `ProfileDropdown`, and `PageLoader`.
- `frontend/src/shared/styles/Global.css` contains global app CSS.
- `frontend/src/shared/styles` also contains shared component CSS. The previously
  unused `frontend/src/styles/index.css` was preserved at
  `frontend/src/shared/styles/legacy/LegacyIndex.css`.
- `backend/src/modules` contains backend features. Each module owns route
  definitions, request/response controllers, service logic, module types, and
  repositories where direct Prisma access is needed.
- `backend/src/middleware` contains cross-cutting request behavior.
- `backend/prisma/schema.prisma` is the source of truth for PostgreSQL data shape.
- `backend/src/database/prisma.ts` exports the shared Prisma client and database
  health-check helper.
- `backend/src/shared` contains reusable backend utilities and shared types.
- `backend/src/app.ts` wires Express middleware, health checks, API routes, 404
  handling, and the global error handler.
- `backend/src/server.ts` loads environment variables, verifies the database
  connection, and starts the HTTP listener.
- Feature-specific styles live inside the owning feature. Shared/global styles
  live in `frontend/src/shared/styles`.
- `frontend/src/config/Firebase.ts` owns Firebase app and auth initialization.
  Keep the PascalCase filename to match the frontend naming convention.

## 3. Client routes

| Route | Access | Current behavior | Status |
| --- | --- | --- | --- |
| `/` | Public | Landing/home content | Implemented |
| `/about` | Public | Product information | Implemented |
| `/updates` | Public | Paginated release timeline from `/api/releases` | Implemented |
| `/support` | Public | FAQ and client-side contact form | Partial: form is not submitted to a service |
| `/login` | Public | Responsive email/social login, 2FA, password reset | Implemented |
| `/signup` | Public | Responsive email/social registration | Implemented |
| `/drafts` | Public route | Blog draft list/edit/delete UI | Partial: API requires auth and requests do not attach JWT |
| `/dashboard` | Protected | Scores, season, rank, streak, heatmap, recent activity | Implemented; leaderboard preview is static |
| `/profile` | Protected | Profile stats and contribution heatmap from PostgreSQL | Implemented |
| `/dsa` | Protected | Placeholder screen | Planned |
| `/projects` | Protected | Placeholder screen | Planned |
| `/leaderboard` | Protected | Placeholder screen | Planned |
| `/challenges` | Protected | Placeholder screen | Planned |
| `/settings` | Protected | Placeholder screen | Planned |

`Blog.tsx` and `NewBlog.tsx` exist, but their routes are not currently
registered in `frontend/src/app/Router.tsx`. Links inside those pages refer to
`/blog`, `/blog/new`, and `/blog/drafts`, which are not registered client routes.

## 4. Feature register

### Authentication and account security

- Email registration stores a bcrypt password hash in PostgreSQL.
- Email login issues a 15-day custom JWT.
- Google and GitHub use Firebase popups, then synchronize the user to PostgreSQL
  and issue the same custom JWT used by protected API routes.
- `frontend/src/features/auth/context/AuthContext.tsx` restores a JWT session
  through `GET /api/auth/me` and falls back to an existing Firebase session.
- Protected APIs accept `Authorization: Bearer <token>`.
- Optional color-sequence 2FA uses three selected colors and a shuffled
  nine-color verification grid.
- 2FA fallback and password reset use six-digit email OTPs that expire in ten
  minutes.
- Login and OTP endpoints have IP-based rate limits.
- A remembered device can receive a separate 15-day device JWT.

### Dashboard and progression

- Dashboard statistics are stored on the PostgreSQL `User` record.
- Activity is assembled from DSA, full-stack, project, and practice logs.
- `frontend/src/services/DashboardService.ts` converts dashboard API responses
  into a UI-ready dashboard view model.
- Dashboard API requests get the saved JWT through
  `frontend/src/features/auth/api/AuthStorageService.ts`, keeping auth storage
  access centralized.
- The dashboard service calculates streaks, season points, active days, rank
  display values, most active day, recent activity, and the rolling 53-week
  contribution heatmap.
- `frontend/src/features/dashboard/pages/Dashboard.tsx` renders the dashboard
  view model and no longer owns those calculations directly.
- A day counts toward a streak after at least two logs.
- Season ranks progress from `Unranked` through `Developer`; thresholds are
  defined in `frontend/src/features/dashboard/utils/RankSystem.tsx`.
- Seasons are treated as 14 days by the client, which requests a reset when the
  current season expires.

### Blog and drafts

- The API supports public paginated published posts.
- Authenticated users can list drafts, create posts/drafts, update their own
  posts, delete their own posts, and publish drafts.
- `frontend/src/features/blog/pages/Blog.tsx`,
  `frontend/src/features/blog/pages/NewBlog.tsx`, and
  `frontend/src/features/blog/pages/Drafts.tsx` contain the current blog UI.
- Database CRUD is implemented, but `/blog`, `/blog/new`, and `/blog/drafts`
  are not wired into `frontend/src/app/Router.tsx`, and authenticated client
  requests need JWT headers.

### Releases and updates

- Public, paginated release listing powers
  `frontend/src/features/releases/pages/Updates.tsx`.
- `frontend/src/features/releases/components/UpdatesTimeline.tsx` renders the
  release timeline cards.
- Authenticated create/update/delete endpoints exist.
- Automation can create a release using `AUTOMATION_SECRET` as a bearer token.

### Activity modules

The route contracts and database models exist for these modules, but their
controllers currently return HTTP `501 Not Implemented`:

- DSA logs: Easy/Medium/Hard problems and complexity/notes metadata.
- Full-stack logs: Learning or Building work sessions.
- Practice logs: DSA revision or concept explanation.
- Projects: project details, work logs, and milestones.
- Leaderboard: current week and historical results.
- Weekly challenge: result listing and submission.

The intended scoring rules are recorded in the corresponding controller files.

### Profile and quick logging

- `frontend/src/features/profile/pages/Profile.tsx` fetches user stats and logs
  from the PostgreSQL backend via `GET /api/dashboard/profile`.
- `frontend/src/shared/components/QuickLogModal.tsx` saves a practice log and
  increments the arena score via `POST /api/dashboard/me/quick-log`.
- Firestore has been fully removed from the frontend. Firebase is used solely for
  Google/GitHub authentication popups (`firebase/auth`).

## 5. API map

Unless marked public, endpoints require the custom JWT bearer token.

| Base path | Endpoints | Status |
| --- | --- | --- |
| `/` and `/health` | Service health checks | Implemented, public |
| `/api/auth` | Register, login, social sync, current user, 2FA (protected), OTP, password reset | Implemented in `backend/src/modules/auth` |
| `/api/dashboard` | `GET /me`, `PUT /me`, `POST /me/quick-log`, `GET /profile` | Implemented in `backend/src/modules/dashboard` |
| `/api/blog` | Published list plus authenticated post/draft CRUD | Implemented in `backend/src/modules/blog` |
| `/api/releases` | Public list, protected CRUD, secret-based automation | Implemented in `backend/src/modules/releases` |
| `/api/dsa` | User log CRUD | Scaffolded (`501`) in `backend/src/modules/dsa` |
| `/api/fullstack` | User log CRUD | Scaffolded (`501`) in `backend/src/modules/fullstack` |
| `/api/practice` | User log CRUD | Scaffolded (`501`) in `backend/src/modules/practice` |
| `/api/projects` | Projects, logs, and milestones | Scaffolded (`501`) in `backend/src/modules/projects` |
| `/api/leaderboard` | Current leaderboard and history | Scaffolded (`501`) in `backend/src/modules/leaderboard` |
| `/api/challenge` | Weekly results and submission | Scaffolded (`501`) in `backend/src/modules/challenges` |

## 6. Data model

PostgreSQL models in `backend/prisma/schema.prisma`:

- `User`: identity, profile, verification/2FA fields, and progression stats.
- `DSALog`, `FullstackLog`, `PracticeLog`: categorized developer activity.
- `Project`, `ProjectLog`, `Milestone`: project tracking and progress.
- `WeeklyScore`, `ChallengeResult`: competition and ranking data.
- `Activity`: one activity marker per user/date.
- `Notification`: typed, read/unread user messages.
- `Achievement`, `UserAchievement`: achievement definitions and unlocks.
- `BlogPost`: authored draft or published content.
- `Release`: versioned changelog entries.

Most user-owned records cascade on user deletion. The schema includes indexes
for recent activity, project status, leaderboard ordering, unread notifications,
and blog/release listing.

## 7. Environment configuration

The frontend and backend each load their own local `.env`. These files are
ignored by Git and must not be committed. During the initial workspace split,
both were copied from the previous root `.env`; remove variables unused by each
workspace after confirming local development works.

### Server variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL/Neon connection string; required |
| `JWT_SECRET` | Signs login, 2FA, reset, and device tokens; required in production |
| `PORT` | Express port; defaults to `4000` |
| `AUTOMATION_SECRET` | Protects release automation |
| `EMAIL_HOST` | SMTP host; defaults to Brevo relay |
| `EMAIL_PORT` | SMTP port; defaults to `587` |
| `EMAIL_HOST_USER` | SMTP username |
| `EMAIL_HOST_PASSWORD` | SMTP password |
| `EMAIL_FROM` | Sender address |
| `NODE_ENV` | Enables development error stacks when set to `development` |

### Client variables

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_PROXY_TARGET` (optional development proxy target)

## 8. Common commands

Run commands from the `Dev_Arena/` workspace root.

| Command | Purpose |
| --- | --- |
| `npm install` | Install and link both workspaces |
| `npm run dev:frontend` | Start Vite on port 5173 |
| `npm run dev:backend` | Start the Express API in watch mode on port 4000 |
| `npm run build:frontend` | Build the client for production |
| `npm run build:backend` | Compile the Express TypeScript code |
| `npm run build` | Build frontend and backend sequentially |
| `npm run db:check` | Verify the database connection |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Prisma Studio |

There is currently no automated test suite.

## 9. Known gaps and current baseline

1. Standalone 2FA setup routing is not currently registered in
   `frontend/src/app/Router.tsx`; 2FA setup is reached through signup flow.
2. ~~`setup-2fa` accepts a `userId` in the request body and is not protected by
   auth middleware.~~ **Resolved:** endpoint is now protected and derives user
   from the JWT.
3. The code falls back to the literal JWT secret `fallback_secret` when
   `JWT_SECRET` is absent. Production startup should reject a missing secret.
4. Dashboard summary fields can be updated directly by the client; server-side
   validation/recalculation is needed before treating scores as authoritative.
5. ~~Profile/quick-log functionality still uses Firestore.~~ **Resolved:**
   Profile reads from `GET /api/dashboard/profile` and QuickLogModal writes to
   `POST /api/dashboard/me/quick-log`, both backed by PostgreSQL.
6. Blog page routes are not registered, draft/post API requests do not attach
   bearer tokens, and `/drafts` is exposed as a public client route.
7. The support form only updates local UI state and does not send a message.
8. Leaderboard preview values on the dashboard are hard-coded.
9. No tests or CI validation are defined.

## 10. Maintenance rules

When a feature changes, update this file in the same pull request:

1. Add or change its client route in **Client routes**.
2. Update its implementation state in **Feature register**.
3. Add or change its endpoint in **API map**.
4. Record Prisma model or ownership changes in **Data model**.
5. Add new environment variables and commands to their tables.
6. Remove resolved items and add newly discovered blockers under **Known gaps**.
7. Update `FEATURE_DEVELOPMENT_GUIDE.md` only when the feature-development
   process changes.
8. Update the `Last reviewed` date after checking the implementation, not just
   the route names.

Use these status meanings consistently:

- **Implemented**: wired into the running application with real behavior.
- **Partial**: useful behavior exists, but a required integration is missing.
- **Scaffolded**: routes/models exist, but the feature handler is unfinished.
- **Planned**: only a placeholder or design intent exists.
