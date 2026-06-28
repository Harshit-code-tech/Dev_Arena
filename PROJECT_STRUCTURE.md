# DevArena Project Structure and Feature Register

Last reviewed: 2026-06-20

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
| Legacy/secondary data | Firebase Firestore (`users` and `logs`) |
| Email | Nodemailer over configurable SMTP |
| Styling | Plain CSS files grouped in `src/styles` |

### Runtime flow

```text
Browser (Vite :5173)
  |-- /api/* --------------------------------> Express (:4000)
  |                                               |
  |                                               +--> Prisma --> PostgreSQL/Neon
  |
  +-- Google/GitHub authentication ------------> Firebase Auth
  +-- legacy profile/quick-log data -----------> Firestore
```

In development, Vite proxies `/api` to `http://localhost:4000` unless
`VITE_API_PROXY_TARGET` overrides it.

## 2. Repository map

```text
Dev_Arena/
|-- frontend/
|   |-- public/                Static images and SVG assets
|   |-- src/
|   |   |-- Auth/              Desktop and mobile auth screens
|   |   |-- components/        Shared UI and feature components
|   |   |-- config/            Firebase client configuration
|   |   |-- context/           Global authentication state
|   |   |-- layouts/           Authenticated application shell
|   |   |-- pages/             Route-level React screens
|   |   |-- styles/            Global and component/page CSS
|   |   |-- utils/             Client utilities and rank calculations
|   |   |-- App.tsx            Client route table and lazy-loaded pages
|   |   `-- main.tsx           React entry point and providers
|   |-- index.html             Vite HTML entry point
|   |-- package.json           Frontend dependencies and scripts
|   `-- vite.config.ts         Vite client and API proxy config
|-- backend/
|   |-- prisma/
|   |   |-- migrations/        PostgreSQL migration history
|   |   |-- schema.prisma      Database models, enums, relations, and indexes
|   |   `-- seed.js            Database seed data
|   |-- src/
|   |   |-- controllers/       Express request handlers and feature logic
|   |   |-- middleware/        JWT protection and API error handling
|   |   |-- routes/            Express API route definitions
|   |   |-- scripts/           Maintenance scripts such as DB checks
|   |   |-- utils/             Server utilities such as email delivery
|   |   |-- db.ts              Shared Prisma client and DB health check
|   |   `-- server.ts          Express entry point and API registration
|   |-- package.json           Backend dependencies and scripts
|   `-- prisma.config.ts       Prisma schema, migration, and datasource config
|-- devarena-nav-guide.md      Older navigation-specific implementation guide
|-- package.json               Root npm workspace commands and tooling
`-- package-lock.json          Shared dependency lockfile
```

### Directory responsibilities

- `frontend/src/pages` contains full screens mounted by `App.tsx`.
- `frontend/src/components` contains reusable UI or self-contained widgets.
- `backend/src/routes` only maps HTTP methods and paths to middleware/controllers.
- `backend/src/controllers` currently validates requests and performs feature or
  database work; business logic will move into feature services in the next
  refactoring phase.
- `backend/src/middleware` contains cross-cutting request behavior.
- `backend/prisma/schema.prisma` is the source of truth for PostgreSQL data shape.
- Each page/component stylesheet currently lives in `frontend/src/styles`.

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
| `/colorsetup` | Public | Color-sequence 2FA UI | Partial: route does not select setup mode |
| `/dashboard` | Protected | Scores, season, rank, streak, heatmap, recent activity | Implemented; leaderboard preview is static |
| `/profile` | Protected | Profile stats and contribution history | Partial: still reads Firestore |
| `/dsa` | Protected | Placeholder screen | Planned |
| `/projects` | Protected | Placeholder screen | Planned |
| `/leaderboard` | Protected | Placeholder screen | Planned |
| `/challenges` | Protected | Placeholder screen | Planned |
| `/settings` | Protected | Placeholder screen | Planned |

`Blog.tsx` and `NewBlog.tsx` exist, but their routes are currently commented out
in `App.tsx`. Links inside those pages refer to `/blog`, `/blog/new`, and
`/blog/drafts`, which are not registered client routes.

## 4. Feature register

### Authentication and account security

- Email registration stores a bcrypt password hash in PostgreSQL.
- Email login issues a 15-day custom JWT.
- Google and GitHub use Firebase popups, then synchronize the user to PostgreSQL
  and issue the same custom JWT used by protected API routes.
- `AuthContext` restores a JWT session through `GET /api/auth/me` and falls back
  to an existing Firebase session.
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
- The client calculates streaks, season points, active days, ranks, and a
  rolling 53-week contribution heatmap.
- A day counts toward a streak after at least two logs.
- Season ranks progress from `Unranked` through `Developer`; thresholds are
  defined in `frontend/src/utils/rankSystem.tsx`.
- Seasons are treated as 14 days by the client, which requests a reset when the
  current season expires.

### Blog and drafts

- The API supports public paginated published posts.
- Authenticated users can list drafts, create posts/drafts, update their own
  posts, delete their own posts, and publish drafts.
- Database CRUD is implemented, but the main blog client routes are not wired
  into `App.tsx` and authenticated client requests need JWT headers.

### Releases and updates

- Public, paginated release listing powers the Updates page.
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

- `frontend/src/pages/Profile.tsx` reads the Firestore `users` and `logs`
  collections.
- `frontend/src/components/QuickLogModal.tsx` writes to Firestore and increments
  Firestore user stats.
- These paths have not yet been migrated to the PostgreSQL activity APIs.

## 5. API map

Unless marked public, endpoints require the custom JWT bearer token.

| Base path | Endpoints | Status |
| --- | --- | --- |
| `/` and `/health` | Service health checks | Implemented, public |
| `/api/auth` | Register, login, social sync, current user, 2FA, OTP, password reset | Implemented; see known gaps |
| `/api/dashboard` | `GET /me`, `PUT /me` | Implemented |
| `/api/blog` | Published list plus authenticated post/draft CRUD | Implemented |
| `/api/releases` | Public list, protected CRUD, secret-based automation | Implemented |
| `/api/dsa` | User log CRUD | Scaffolded (`501`) |
| `/api/fullstack` | User log CRUD | Scaffolded (`501`) |
| `/api/practice` | User log CRUD | Scaffolded (`501`) |
| `/api/projects` | Projects, logs, and milestones | Scaffolded (`501`) |
| `/api/leaderboard` | Current leaderboard and history | Scaffolded (`501`) |
| `/api/challenge` | Weekly results and submission | Scaffolded (`501`) |

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

1. The `/colorsetup` route renders `Color2FA` without the `isSetup` prop, so it
   defaults to verification mode without a login challenge.
2. `backend/src/routes/auth.routes.ts` registers `POST /forgot-password` twice; the first
   unthrottled registration is matched before the rate-limited one.
3. `setup-2fa` accepts a `userId` in the request body and is not protected by
   auth middleware. It should derive the user from a verified token.
4. The code falls back to the literal JWT secret `fallback_secret` when
   `JWT_SECRET` is absent. Production startup should reject a missing secret.
5. Dashboard summary fields can be updated directly by the client; server-side
   validation/recalculation is needed before treating scores as authoritative.
6. Profile/quick-log functionality still uses Firestore while the dashboard and
   core schema use PostgreSQL, creating two activity sources.
7. Blog page routes are commented out, draft/post API requests do not attach
   bearer tokens, and `/drafts` is exposed as a public client route.
8. The support form only updates local UI state and does not send a message.
9. Leaderboard preview values on the dashboard are hard-coded.
10. No tests or CI validation are defined.

## 10. Maintenance rules

When a feature changes, update this file in the same pull request:

1. Add or change its client route in **Client routes**.
2. Update its implementation state in **Feature register**.
3. Add or change its endpoint in **API map**.
4. Record Prisma model or ownership changes in **Data model**.
5. Add new environment variables and commands to their tables.
6. Remove resolved items and add newly discovered blockers under **Known gaps**.
7. Update the `Last reviewed` date after checking the implementation, not just
   the route names.

Use these status meanings consistently:

- **Implemented**: wired into the running application with real behavior.
- **Partial**: useful behavior exists, but a required integration is missing.
- **Scaffolded**: routes/models exist, but the feature handler is unfinished.
- **Planned**: only a placeholder or design intent exists.
