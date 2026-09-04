# DevArena Project Structure and Feature Register

Last reviewed: 2026-09-04

This file is the living technical map for DevArena. Update it whenever a route,
feature, data model, integration, or major directory changes.

## 1. Project summary

DevArena is a developer activity and growth platform organized as an npm
workspace. The `frontend` workspace contains the React/Vite single-page
application; the `backend` workspace contains the Express API, PostgreSQL access
through Prisma, and server integrations. Firebase provides social
authentication and some legacy Firestore data.

### Main stack

| Layer | Technology |
| --- | --- |
| Client | React 19, TypeScript, React Router, Vite |
| API | Express 5, TypeScript, `tsx` |
| Primary database | PostgreSQL/Neon through Prisma |
| Authentication | Custom JWT for email auth; Firebase Auth for Google/GitHub |
| Legacy/secondary data | Firebase Firestore (`users`) for social-profile synchronization |
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
  +-- optional legacy profile metadata --------> Firestore
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
|   |   |   |-- auth/           Auth pages, auth context, email OTP/password-reset UI
|   |   |   |-- blog/           Blog, new-post, draft pages, draft modal, and blog CSS
|   |   |   |-- dashboard/      Dashboard page, dashboard CSS, and rank utility
|   |   |   |-- dsa/            DSA, revision, and learning tracking page and CSS
|   |   |   |-- projects/       Project and Full Stack Open tracking page and CSS
|   |   |   |-- home/           Landing, home, about pages, home/about components, and CSS
|   |   |   |-- profile/        Profile page and profile CSS
|   |   |   |-- friends/        Players network page (legacy internal folder name) and CSS
|   |   |   |-- leaderboard/    Arena leaderboard page and CSS
|   |   |   |-- player-hub/     Player Hub placeholder route and CSS
|   |   |   |-- settings/       Profile, preferences, notification, account, and player controls
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
  auth API helper, email OTP UI, password reset modal, and auth-specific styles.
- `frontend/src/features/auth/api/AuthService.ts` is a small barrel export for
  auth API modules.
- `frontend/src/features/auth/api/AuthConstants.ts` owns auth endpoint paths,
  storage keys, social provider labels, password-strength labels, email regex,
  and email-OTP endpoint constants.
- `frontend/src/features/auth/api/AuthTypes.ts` owns shared auth interfaces and
  type aliases used by auth services, context, pages, and auth components.
- `frontend/src/features/auth/api/AuthStorageService.ts` is the only frontend
  module that should read or write auth token storage directly.
- Auth behavior is split into focused files:
  `AuthStorageService.ts`, `AuthSessionService.ts`, `AuthValidationService.ts`,
  `EmailAuthService.ts`, `SocialAuthService.ts`, `FirebaseUserSyncService.ts`,
  `FirestoreUserService.ts`, `EmailAuthService.ts`,
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
  `NotificationPanel`, `RankBadge`, and `PageLoader`.
- The authenticated application sidebar includes Dashboard, DSA, Projects,
  Players, Leaderboard, Challenges, Tournaments, Player Hub, Profile, and
  a bottom Quick Log action.
- `frontend/src/shared/styles/Global.css` contains global app CSS.
- `frontend/src/shared/styles` also contains shared component CSS. The previously
  unused `frontend/src/styles/index.css` was preserved at
  `frontend/src/shared/styles/legacy/LegacyIndex.css`.
- `backend/src/modules` contains backend features. Each module owns route
  definitions, request/response controllers, service logic, module types, and
  repositories where direct Prisma access is needed.
- `backend/src/middleware` contains cross-cutting request behavior.
- `backend/prisma/schema.prisma` is the source of truth for PostgreSQL data shape.
- `ScoreEvent` records idempotent points by source and powers deterministic score rebuilds.
- `backend/src/database/prisma.ts` exports the shared Prisma client and database
  health-check helper.
- `backend/src/shared` contains reusable backend utilities and shared types.
- `backend/src/app.ts` wires Express middleware, health checks, API routes, 404
  handling, and the global error handler.
- `backend/src/server.ts` loads environment variables, verifies the database
  connection, and starts the HTTP listener.
- Feature-specific styles live inside the owning feature. Shared/global styles
  live in `frontend/src/shared/styles`.
- `frontend/src/config/Firebase.ts` owns Firebase app/auth/db initialization.
  Keep the PascalCase filename to match the frontend naming convention.

## 3. Client routes

| Route | Access | Current behavior | Status |
| --- | --- | --- | --- |
| `/` | Public | Landing page with live Developer Pulse | Implemented |
| `/about` | Public | Product information | Implemented |
| `/updates` | Public | Paginated release timeline from `/api/releases` | Implemented |
| `/support` | Public | FAQ and client-side contact form | Partial: form is not submitted to a service |
| `/login` | Public | Email/social login, mandatory email OTP for password accounts, password reset, and grey route-curtain transition | Implemented |
| `/signup` | Public | Email/social registration, mandatory email OTP for password accounts, rocket launch, and grey route-curtain transition | Implemented |
| `/shared/projects/:shareSlug` | Public | Safe public view of an explicitly shared project | Implemented |
| `/drafts` | Public route | Blog draft list/edit/delete UI | Partial: API requires auth and requests do not attach JWT |
| `/dashboard` | Protected | Scores, season, rank, heatmap, and nearby leaderboard positions | Implemented |
| `/profile` | Protected | Profile stats, contribution history, and unified recent scored activity | Implemented |
| `/dsa` | Protected | DSA problems, revision, and learning logs with weighted scoring | Implemented |
| `/projects` | Protected | Projects, sharing, milestones, sessions, and Full Stack Open tracking | Implemented |
| `/players` | Protected | Global player directory, email invites, requests, and connected players | Implemented |
| `/friends` | Protected | Legacy redirect to `/players` | Implemented |
| `/leaderboard` | Protected | Current user summary, real top 10, and player-rank search | Implemented |
| `/challenges` | Protected | Active weekly competition, task submission, and results | Implemented |
| `/player-hub` | Protected | Routed, responsive placeholder for the future community hub | Scaffolded |
| `/settings` | Protected | Profile/privacy, identity, preferences, notifications, data controls, and player management | Implemented |

`Blog.tsx` and `NewBlog.tsx` exist, but their routes are not currently
registered in `frontend/src/app/Router.tsx`. Links inside those pages refer to
`/blog`, `/blog/new`, and `/blog/drafts`, which are not registered client routes.

## 4. Feature register

### Authentication and account security

- Successful Login expands a grey route curtain from the exact email, Google, or GitHub action used. Signup launches the rocket first, expands the same curtain from its top-screen impact point, and wipes upward after navigation to reveal the Dashboard.
- Social-account synchronization preserves an existing DevArena profile image instead of replacing it with the provider photo on every login.

- Email registration stores a bcrypt password hash in PostgreSQL.
- Email signup and email/password login require a one-time six-digit email OTP before a custom JWT is issued.
- Google and GitHub use Firebase popups, then synchronize the user to PostgreSQL
  and issue the same custom JWT used by protected API routes.
- `frontend/src/features/auth/context/AuthContext.tsx` restores a JWT session
  through `GET /api/auth/me` and falls back to an existing Firebase session.
- Protected APIs accept `Authorization: Bearer <token>`.
- Authentication and password-reset OTPs are hashed at rest, expire in ten minutes, are one-time use, enforce resend cooldowns, and limit incorrect attempts.
- Login and OTP endpoints have IP-based rate limits.
- Remembered email/password sessions receive a 15-day JWT; non-remembered sessions receive a shorter JWT.

### Dashboard and progression

- Dashboard statistics are stored on the PostgreSQL `User` record.
- Activity is assembled from auditable `ScoreEvent` records created by DSA,
  full-stack, project, practice, challenge, and quick-log actions.
- `frontend/src/services/DashboardService.ts` converts dashboard API responses
  into a UI-ready dashboard view model.
- Dashboard API requests get the saved JWT through
  `frontend/src/features/auth/api/AuthStorageService.ts`, keeping auth storage
  access centralized.
- The backend scoring service authoritatively rebuilds Arena Score, season
  points, active days, rank, streak, weekly score buckets, and contribution
  dates. The frontend service maps those values into rank progress, recent
  activity, and the rolling 53-week contribution heatmap.
- Dashboard stats include a weekly consistency rating (Low / Moderate /
  Consistent) based on the current week's active days (§14).
- `frontend/src/features/dashboard/pages/Dashboard.tsx` renders the dashboard
  view model and no longer owns those calculations directly.
- A day counts as active when it contains at least one scored activity.
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

### Players, navigation, and app shell

- The authenticated application uses a fixed, non-scrolling left sidebar with Dashboard, DSA, Projects, Players, Leaderboard, Challenges, Tournaments, Player Hub, Profile, and a bottom Quick Log action.
- `/players` shows all other registered users before a query is entered and filters by name, email, or permanent username.
- Player rows include privacy-aware profile imagery, name, username, relationship state, and two deterministic placeholder technology tags. The tags are intentionally replaceable by a future AI-derived profile model.
- The network system supports email invitations, incoming/outgoing requests, connected-player removal, email alerts, in-app notifications, and the legacy `/friends` redirect.

### Activity modules

The structured tracking modules are implemented end to end:

- `/dsa` combines DSA problem logs, revision sessions, and concept-learning logs.
- `/projects` combines long-running projects with Full Stack Open learning/building logs.
- DSA scores Easy/Medium/Hard entries at 1/3/5 base progress points with daily
  diminishing returns, and rejects duplicate problems.
- Practice scores revision/concept explanation at 2/3 points.
- Full-stack separates Full Stack Open course progress from practical work;
  Learning scores 2 points and Building scores 4 points.
- Projects score work sessions, milestone completion, and project completion
  through an evidence-based formula. Milestones carry size-based progress points:
  Minor = 2, Major = 5, Release = 8 (§11 of `docs/scoringupdate.md`).
  Milestone and project completion awards are persisted once, so reopening and
  completing the same item cannot farm or move points into a later week.
- New log forms use the server/current date automatically; existing backend date validation remains for compatibility, and editable log records lock after 24 hours.
- Exact same-day duplicates are blocked for full-stack, practice, and project
  sessions; DSA additionally blocks duplicate problem names or URLs across all time.
- `ScoreEvent` is the auditable scoring source. Each mutation rebuilds Arena Score,
  current-season points, rank, streak, active days, contribution dates, and weekly scores.
- `frontend/src/services/TrackingService.ts` centralizes tracking view types.
- `frontend/src/services/ApiClient.ts` centralizes authenticated API requests;
  all service files (`TrackingService`, `LeaderboardService`, `ChallengeService`)
  import `apiRequest` from this shared client instead of maintaining their own
  fetch wrappers.
- `frontend/src/services/ChallengeService.ts` provides typed API wrappers for
  active competition viewing, code submission, and results querying.
- Leaderboard: current week competition-based ranking with tie-breaking.
  The primary ranking metric is `competitionScore` (from `ChallengeResult`).
  Users without a current-week competition result receive position 0 with a
  graceful fallback instead of a 404 error.
- Leaderboard: current week and historical results.
- Weekly challenge: competition listing, code submission, and result aggregation.
- Admin endpoints support creating competitions, adding tasks with authoritative
  metadata, adding test cases, activating competitions, and aggregating results
  into ChallengeResult records.

The intended scoring rules are recorded in the corresponding controller files.

### Profile and quick logging

- `frontend/src/features/profile/pages/Profile.tsx` reads authoritative score,
  activity, rank, recent-log, and contribution data through the dashboard API.
- `frontend/src/shared/components/QuickLogModal.tsx` submits a specific activity
  to `POST /api/dashboard/quick-log`, which creates a General score event with
  zero points (Quick Log scoring was removed per the scoring redesign).
- Quick-log completion broadcasts `devarena:activity-updated` so dashboard and
  profile views refresh without a full page reload.

## 5. API map

Unless marked public, endpoints require the custom JWT bearer token.

| Base path | Endpoints | Status |
| --- | --- | --- |
| `/` and `/health` | Service health checks | Implemented, public |
| `/api/auth` | Register, login, social sync, current user, email OTP verification/resend, password reset | Implemented in `backend/src/modules/auth`; see known gaps |
| `/api/dashboard` | `GET /me`, restricted `PUT /me`, `POST /quick-log` | Implemented in `backend/src/modules/dashboard` |
| `/api/blog` | Published list plus authenticated post/draft CRUD | Implemented in `backend/src/modules/blog` |
| `/api/releases` | Public list, protected CRUD, secret-based automation | Implemented in `backend/src/modules/releases` |
| `/api/dsa` | User DSA log CRUD, duplicate prevention, weekly summary | Implemented |
| `/api/fullstack` | Course-progress/practical-work CRUD, weighted scoring, weekly summary | Implemented |
| `/api/practice` | Revision/learning CRUD and weekly summary | Implemented |
| `/api/projects` | Projects, work sessions, milestones, status, and scoring | Implemented |
| `/api/leaderboard` | Current-user summary, top 10, nearby ranks, and player search | Implemented |
| `/api/challenge` | `GET /`, `POST /submit`, `GET /results`, admin CRUD for competitions/tasks/test-cases/activation/aggregation | Implemented in `backend/src/modules/challenges` |
| `/api/friends` | Player overview, global search, requests, email invitations, and removal | Implemented (legacy API namespace) |
| `/api/settings` | Profile/privacy preferences, verified identity changes, export, and account deletion | Implemented |
| `/api/notifications` | Notification list and read-state updates | Implemented |
| `/api/public` | Public platform pulse and shared-project data | Implemented |

## 6. Data model

PostgreSQL models in `backend/prisma/schema.prisma`:

- `User`: identity, profile, email verification fields, and progression stats.
- `AuthOtpChallenge`: hashed one-time signup/login email challenges with expiry, resend cooldown, attempt limits, and consumption state.
- `DSALog`, `FullstackLog`, `PracticeLog`: categorized developer activity with
  activity timestamps. Current frontend forms no longer expose manual activity dates. `FullstackLog` distinguishes course progress
  from practical work.
- `Project`, `ProjectLog`, `Milestone`: project tracking and progress, including
  immutable completion-award timestamps for anti-abuse scoring. Milestones carry
  a `MilestoneSize` (Minor/Major/Release) with differentiated progress values.
- `ScoreEvent`: idempotent, source-linked points used for score rebuilding and
  activity history.
- `WeeklyScore`, `ChallengeResult`: category totals, competition, and ranking data.
- `WeeklyCompetition`, `CompetitionTask`, `CompetitionTestCase`,
  `CompetitionSubmission`: the weekly competition engine schema. Competitions
  contain tasks with authoritative metadata (expected complexity, accepted tiers,
  scoring weights); test cases validate submissions; submissions track per-user
  code, evaluation status, correctness, and efficiency.
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
| `JWT_SECRET` | Signs login, email-OTP challenge, and password-reset tokens; required in production |
| `PORT` | Express port; defaults to `4000` |
| `AUTOMATION_SECRET` | Protects release automation |
| `EMAIL_HOST` | SMTP host; defaults to Brevo relay |
| `EMAIL_PORT` | SMTP port; defaults to `587` |
| `EMAIL_HOST_USER` | SMTP username |
| `EMAIL_HOST_PASSWORD` | SMTP password |
| `EMAIL_FROM` | Sender address |
| `AUTH_OTP_SECRET` | HMAC secret used to hash authentication and password-reset OTPs |
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
| `npm run scores:rebuild` | Recalculate score events into user, activity, and weekly totals |

There is currently no automated test suite.

## 9. Known gaps and current baseline

1. The code falls back to the literal JWT secret `fallback_secret` when
   `JWT_SECRET` is absent. Production startup should reject a missing secret.
2. Blog page routes are not registered, draft/post API requests do not attach
   bearer tokens, and `/drafts` is exposed as a public client route.
3. The support form only updates local UI state and does not send a message.
4. Player technology tags are derived from verified project evidence; future player matching still requires its ranking model and feedback loop.
5. No tests or CI validation are defined.
6. The weekly competition engine infrastructure is built (create, submit, aggregate)
   but automatic code evaluation against test cases is not yet implemented.
7. Automatic achievement unlocking (Phase 4) is not yet implemented.
8. AI Coach / inactivity feedback (Phase 5) is not yet implemented.
9. Rank decay is deferred until automatic competition evaluation is operational.
