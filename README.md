# DevArena

**DevArena** is a full-stack developer growth and collaboration platform built around verified development activity. It combines developer progress tracking, project and DSA logging, GitHub-backed technology evidence, leaderboards, player discovery, collaboration, secure direct messaging, tournaments, and administrative tools in one application.

> [!IMPORTANT]
> ## A GitHub account is mandatory
> Every new DevArena account must connect a GitHub account and install the DevArena GitHub App before the main application can be opened.
>
> The required onboarding flow is:
>
> **Create/sign in to account → Choose permanent username → Connect GitHub → Grant repository access → Enter DevArena**
>
> Users may grant the GitHub App access to all repositories or only selected repositories. Private repositories can be used when the user explicitly grants the app access to them.

---

## Table of contents

- [What DevArena does](#what-devarena-does)
- [Technology stack](#technology-stack)
- [How the application works](#how-the-application-works)
- [Mandatory GitHub onboarding](#mandatory-github-onboarding)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Run DevArena locally](#run-devarena-locally)
- [Environment configuration](#environment-configuration)
- [Firebase setup](#firebase-setup)
- [GitHub App setup](#github-app-setup)
- [Database setup](#database-setup)
- [Opening the project](#opening-the-project)
- [Useful commands](#useful-commands)
- [How to make DevArena your own](#how-to-make-devarena-your-own)
- [Production deployment checklist](#production-deployment-checklist)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## What DevArena does

DevArena is designed as a developer activity and community platform rather than a simple portfolio website.

Major areas include:

- **Authentication** using Firebase Authentication with DevArena backend sessions.
- **Required onboarding** with a permanent username and mandatory GitHub connection.
- **Dashboard** for developer activity, score, rank, streaks, and contribution history.
- **DSA tracking** for structured problem-solving activity.
- **Project tracking** with work logs, milestones, status, sharing, and GitHub repository verification.
- **GitHub technology analysis** based on repository language data and contribution evidence.
- **Top Tech Stack** derived from eligible GitHub-backed projects.
- **Leaderboard** and progression systems.
- **Players** for discovering and connecting with other developers.
- **Player Hub** for projects, collaboration posts, community interactions, player matching, and direct messages.
- **Secure chat device flows** with Authenticator-based recovery support.
- **Tournaments** for DSA and project competitions.
- **Admin tools** for tournaments, submissions, platform metrics, and presence data.
- **Settings, support, feedback, notifications, activity history, and shared project pages**.

---

## Technology stack

### Frontend

- React 19
- TypeScript
- Vite 8
- React Router
- Firebase Web SDK
- React Hot Toast
- CSS

### Backend

- Node.js
- TypeScript
- Express 5
- Prisma ORM
- PostgreSQL
- JWT
- Firebase ID-token verification
- GitHub APIs / GitHub App integration
- Nodemailer / SMTP
- Helmet
- Express Rate Limit

### Data and external services

- PostgreSQL / Neon-compatible database
- Firebase Authentication
- Firestore as auxiliary profile storage
- GitHub App
- Brevo or another SMTP-compatible email provider
- Cloudinary for profile-image upload features

---

## How the application works

### High-level flow

```mermaid
flowchart TD
    A[Visitor opens DevArena] --> B{Already signed in?}
    B -- No --> C[Login / Signup]
    C --> D[Firebase Authentication]
    D --> E[Backend validates Firebase ID token]
    E --> F[Backend creates/restores DevArena user + JWT session]
    B -- Yes --> G{Required onboarding complete?}
    F --> G
    G -- No --> H[Choose permanent username]
    H --> I[Connect GitHub account]
    I --> J[Install DevArena GitHub App]
    J --> K[Choose repository access]
    K --> L[Complete onboarding]
    G -- Yes --> M[Dashboard]
    L --> M
    M --> N[DSA / Projects / Players / Leaderboard / Tournaments / Player Hub]
```

### Authentication flow

DevArena uses Firebase as the identity layer and PostgreSQL as the application account/data source of truth.

1. The user signs up or signs in.
2. Firebase authenticates the user.
3. The frontend obtains a Firebase ID token.
4. The frontend sends the token to the DevArena backend.
5. The backend verifies that Firebase token against the configured Firebase project.
6. The backend creates or loads the corresponding DevArena user in PostgreSQL.
7. The backend issues the DevArena JWT used by protected API routes.
8. If the user has not finished onboarding, protected pages redirect to `/choose-username`.

Current authentication choices include:

- Email and password
- Google
- GitHub

> [!NOTE]
> **GitHub sign-in and the DevArena GitHub App are different things.**
>
> Firebase's GitHub provider is only an authentication option. The DevArena GitHub App is the repository integration used during mandatory onboarding. A user who signs in with email or Google must still connect GitHub before entering DevArena.

### Project and GitHub flow

When a user attaches a GitHub repository to a DevArena project:

1. The backend validates the repository URL.
2. DevArena checks the connected GitHub identity and GitHub App installation access.
3. The backend requests repository/language information from GitHub.
4. Repository language percentages are calculated from GitHub language byte counts.
5. Contribution evidence is evaluated for technology-stack eligibility.
6. Verified information is stored with the DevArena project.
7. Eligible projects contribute to the user's Top Tech Stack.
8. Repository evidence can be refreshed manually, periodically, or from GitHub webhook activity when webhooks are configured.

### Activity and progression flow

Structured activity such as DSA work and project work is stored in PostgreSQL. Scored activity creates auditable score events that feed areas such as:

- Arena/progression score
- Rank
- Weekly activity
- Streak/activity history
- Dashboard statistics
- Profile statistics
- Leaderboard data

### Player Hub flow

Player Hub provides community functionality including:

- Developer discovery
- Developer work/profile views
- Saved projects
- Collaboration posts and applications
- Community posts, reactions, saves, and comments
- Player matching preferences and recommendations
- Blocking and reporting
- One-to-one direct conversations
- Chat-device registration and recovery flows

---

## Mandatory GitHub onboarding

GitHub is a core requirement of DevArena.

For newly created accounts, onboarding is considered complete only when:

1. A permanent DevArena username has been selected.
2. A GitHub account has been connected.
3. At least one DevArena GitHub App installation has been configured for that connected account.
4. Repository access can be verified successfully.

Until those requirements are satisfied, protected routes redirect the user back to the required setup page.

The onboarding UI follows this sequence:

```text
01  Permanent username
        ↓
02  Connect GitHub
        ↓
    Install GitHub App
        ↓
    Choose all repositories OR selected repositories
        ↓
    Check connection
        ↓
    Continue to DevArena
```

A GitHub account is therefore required even if the user creates the DevArena account with email/password or Google.

---

## Project structure

```text
DevArena/
├── frontend/                    # React + TypeScript + Vite application
│   ├── src/
│   │   ├── app/                 # Router/application wiring
│   │   ├── config/              # Firebase configuration
│   │   ├── features/            # Feature-based UI modules
│   │   │   ├── activity/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── blog/
│   │   │   ├── dashboard/
│   │   │   ├── dsa/
│   │   │   ├── feedback/
│   │   │   ├── friends/
│   │   │   ├── home/
│   │   │   ├── leaderboard/
│   │   │   ├── legal/
│   │   │   ├── player-hub/
│   │   │   ├── profile/
│   │   │   ├── projects/
│   │   │   ├── releases/
│   │   │   ├── settings/
│   │   │   ├── support/
│   │   │   └── tournaments/
│   │   ├── services/            # Frontend API services
│   │   └── shared/              # Shared layouts/components/styles
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # Express + TypeScript API
│   ├── prisma/
│   │   ├── migrations/          # Database migrations
│   │   └── schema.prisma        # PostgreSQL/Prisma schema
│   ├── src/
│   │   ├── database/            # Prisma/database setup
│   │   ├── middleware/          # Auth, admin, chat-device, errors
│   │   ├── modules/             # Backend feature modules
│   │   │   ├── activity/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── blog/
│   │   │   ├── dashboard/
│   │   │   ├── dsa/
│   │   │   ├── feedback/
│   │   │   ├── friends/
│   │   │   ├── fullstack/
│   │   │   ├── github/
│   │   │   ├── leaderboard/
│   │   │   ├── notifications/
│   │   │   ├── platform/
│   │   │   ├── player-hub/
│   │   │   ├── practice/
│   │   │   ├── projects/
│   │   │   ├── realtime/
│   │   │   ├── releases/
│   │   │   ├── settings/
│   │   │   └── tournaments/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── package.json                 # npm workspace scripts
├── package-lock.json
├── .gitignore
└── README.md
```

The repository is an npm workspace containing:

- `@devarena/frontend`
- `@devarena/backend`

---

## Prerequisites

Install/configure the following before running the project:

- **Node.js 20.19+ or Node.js 22.12+**
- npm
- Git
- PostgreSQL database, or a hosted PostgreSQL provider such as Neon
- Firebase project
- GitHub account
- GitHub App configured for your DevArena deployment

For complete email/profile functionality you should also configure:

- SMTP account, such as Brevo SMTP
- Cloudinary account

Check your versions:

```bash
node --version
npm --version
git --version
```

---

## Run DevArena locally

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_REPOSITORY_FOLDER>
```

If you already downloaded the project as a ZIP, extract it and enter the project root:

```bash
cd /path/to/DevArena
```

### 2. Install dependencies

Run this once from the repository root:

```bash
npm install
```

Because the project uses npm workspaces, this installs dependencies for both the frontend and backend.

### 3. Create environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Then fill in your own credentials as described below.

### 4. Generate Prisma Client

```bash
npm run db:generate
```

### 5. Apply database migrations

```bash
npm run db:migrate
```

### 6. Check the database

```bash
npm run db:check
```

### 7. Start the backend

Open Terminal 1 in the project root:

```bash
npm run dev:backend
```

The backend runs on:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/health
```

### 8. Start the frontend

Open Terminal 2 in the project root:

```bash
npm run dev:frontend
```

The frontend runs on:

```text
http://localhost:5173
```

Open that URL in your browser.

---

## Environment configuration

> [!WARNING]
> Never commit real `.env` files, Firebase private credentials, GitHub client secrets, SMTP passwords, database credentials, encryption keys, or webhook secrets.

DevArena uses separate environment files for the frontend and backend.

### `frontend/.env`

The frontend needs browser-safe Firebase configuration.

```env
VITE_API_URL=http://localhost:4000
VITE_API_PROXY_TARGET=http://localhost:4000

VITE_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID

# Optional
VITE_LEGAL_CONTACT_EMAIL=you@example.com
```

During local development, frontend `/api/*` requests are proxied by Vite to the backend. The default proxy target is `http://localhost:4000`.

### `backend/.env`

Use your own values:

```env
# =========================
# Core backend
# =========================
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_PUBLIC_URL=http://localhost:4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require

# =========================
# Authentication / security
# =========================
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
AUTH_OTP_SECRET=REPLACE_WITH_A_DIFFERENT_LONG_RANDOM_SECRET
CHAT_DEVICE_SECRET=REPLACE_WITH_AN_INDEPENDENT_32_PLUS_CHARACTER_SECRET
FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID

# =========================
# GitHub App - required
# =========================
GITHUB_APP_CLIENT_ID=YOUR_GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET=YOUR_GITHUB_APP_CLIENT_SECRET
GITHUB_APP_CALLBACK_URL=http://localhost:4000/api/github/callback
GITHUB_APP_SETUP_URL=http://localhost:4000/api/github/setup
GITHUB_APP_SLUG=YOUR_GITHUB_APP_SLUG
GITHUB_TOKEN_ENCRYPTION_KEY=REPLACE_WITH_AN_INDEPENDENT_LONG_RANDOM_SECRET

# Contribution / verification rules
GITHUB_CONTRIBUTION_MIN_COMMITS=3
GITHUB_CONTRIBUTION_MIN_CHANGED_LINES=200
GITHUB_CONTRIBUTION_MIN_COMMIT_SHARE=0.50
GITHUB_CONTRIBUTION_MIN_CHANGE_SHARE=0.40
GITHUB_OWNER_MIN_COMMITS=1
GITHUB_OWNER_MIN_CHANGED_LINES=20
GITHUB_CONTRIBUTION_COMMIT_SAMPLE=20

# Refresh / webhook configuration
GITHUB_REVERIFY_HOURS=12
GITHUB_MAINTENANCE_MINUTES=60
GITHUB_WEBHOOK_SECRET=
GITHUB_WEBHOOK_URL=http://localhost:4000/api/github/webhook
GITHUB_API_VERSION=2022-11-28

# =========================
# Email / SMTP
# =========================
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_HOST_USER=YOUR_SMTP_USERNAME
EMAIL_HOST_PASSWORD=YOUR_SMTP_PASSWORD
EMAIL_FROM=YOUR_FROM_ADDRESS

# Existing fallback names also supported
BREVO_SMTP_USER=
BREVO_SMTP_PASSWORD=

# =========================
# Cloudinary
# =========================
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# =========================
# Administration
# =========================
ADMIN_EMAILS=admin@example.com

# Optional external tournament judge
TOURNAMENT_JUDGE_URL=
TOURNAMENT_JUDGE_SECRET=

# Optional release automation
AUTOMATION_SECRET=
```

Generate strong local secrets with:

```bash
openssl rand -hex 32
```

Use a different generated value for each independent secret.

---

## Firebase setup

Create your own Firebase project rather than using credentials belonging to another DevArena deployment.

### Required Firebase work

1. Create a Firebase project.
2. Register a Web App.
3. Copy the web configuration into `frontend/.env`.
4. Put the same Firebase project ID into:

```env
FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
```

inside `backend/.env`.

5. Enable **Email/Password** authentication if you want email/password login.
6. Enable **Google** authentication if you want the Google button.
7. Configure the **GitHub Firebase authentication provider** if you want the GitHub login button.
8. Enable/configure Firestore if you want the auxiliary Firestore profile synchronization used by the frontend.

The backend does not need a Firebase service-account private key for the current Firebase ID-token verification implementation.

### Important GitHub distinction

There are two separate GitHub integrations:

```text
Firebase GitHub Provider
    └── Optional way to SIGN IN

DevArena GitHub App
    └── Mandatory repository integration for ONBOARDING
```

Do not configure only the Firebase GitHub provider and expect repository verification to work.

---

## GitHub App setup

The DevArena GitHub App is mandatory for the current onboarding flow.

Create your own GitHub App for your copy/deployment of DevArena.

### Local development URLs

Use values equivalent to:

```text
Frontend/Homepage:       http://localhost:5173
Authorization callback:  http://localhost:4000/api/github/callback
Setup URL:                http://localhost:4000/api/github/setup
Webhook URL:              http://localhost:4000/api/github/webhook
```

A localhost webhook will not normally receive public GitHub webhook deliveries unless you expose the backend through a tunnel. The webhook can therefore remain unconfigured while doing basic local development.

### Repository permissions

The integration is designed to read repository evidence. Configure the GitHub App with the minimum permissions required by your implementation, including:

- **Metadata: Read-only**
- **Contents: Read-only**

Users should be allowed to install the app for:

- All repositories, or
- Selected repositories

A user only gets access to a private repository in DevArena when that repository is included in the GitHub App installation permissions.

### Copy these GitHub App values

Put the app's values into `backend/.env`:

```env
GITHUB_APP_CLIENT_ID=...
GITHUB_APP_CLIENT_SECRET=...
GITHUB_APP_SLUG=...
GITHUB_APP_CALLBACK_URL=http://localhost:4000/api/github/callback
GITHUB_APP_SETUP_URL=http://localhost:4000/api/github/setup
```

The current GitHub integration does not require a GitHub App private-key PEM in the backend environment.

### GitHub connection flow inside DevArena

```mermaid
sequenceDiagram
    participant U as User
    participant D as DevArena
    participant G as GitHub

    U->>D: Connect GitHub
    D->>G: OAuth authorization request
    G-->>D: Authorization callback
    D->>D: Encrypt and store GitHub token
    D-->>U: Continue to GitHub App installation
    U->>G: Select all or selected repositories
    G-->>D: Setup callback with installation
    D->>D: Verify installation belongs to connected user
    D-->>U: GitHub setup ready
```

---

## Database setup

DevArena uses PostgreSQL through Prisma.

Set:

```env
DATABASE_URL=postgresql://...
```

Then run:

```bash
npm run db:generate
npm run db:migrate
npm run db:check
```

### Prisma Studio

To inspect the database using Prisma Studio:

```bash
npm run db:studio
```

### After changing `schema.prisma`

Regenerate Prisma Client:

```bash
npm run db:generate
```

If the schema change includes a migration, create/apply the appropriate migration during development and make sure committed migrations are applied in deployment.

---

## Opening the project

### VS Code

From the project root:

```bash
code .
```

Then use two integrated terminals:

**Terminal 1**

```bash
npm run dev:backend
```

**Terminal 2**

```bash
npm run dev:frontend
```

Open:

```text
http://localhost:5173
```

### First account test

For a clean end-to-end test:

1. Open the landing page.
2. Create a new account using email/password, Google, or GitHub.
3. Choose a permanent username.
4. Connect a GitHub account.
5. Install the GitHub App.
6. Select all repositories or selected repositories.
7. Return to DevArena and check the connection.
8. Continue to the Dashboard.
9. Create a project.
10. Attach a repository to confirm repository verification and language percentages work.

---

## Useful commands

Run all commands from the project root unless noted otherwise.

| Command | Purpose |
| --- | --- |
| `npm install` | Install workspace dependencies |
| `npm run dev:frontend` | Start Vite frontend |
| `npm run dev:backend` | Start Express backend |
| `npm run build` | Build frontend and backend |
| `npm run build:frontend` | Build frontend only |
| `npm run build:backend` | TypeScript-build backend only |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Apply committed Prisma migrations |
| `npm run db:check` | Test database connection |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Run database seed script |
| `npm run scores:rebuild` | Rebuild tracking scores |
| `npm run lint` | Run ESLint |

### Production build check

Before deployment or pushing a major change:

```bash
npm run build
```

A Vite chunk-size message such as `Some chunks are larger than 500 kB` is a warning, not automatically a failed build. A failed build will exit with an actual error.

---

## How to make DevArena your own

Do not reuse another deployment's database, Firebase project, GitHub secrets, SMTP credentials, Cloudinary credentials, encryption secrets, or admin account list.

Use this checklist when turning the repository into your own application.

### 1. Fork or copy the repository

Fork the repository into your own GitHub account or create a new repository from your local copy.

Then point the local Git remote to your repository.

```bash
git remote -v
```

If needed:

```bash
git remote set-url origin <YOUR_REPOSITORY_URL>
```

### 2. Create your own environment

Create your own:

- PostgreSQL database
- Firebase project
- GitHub App
- SMTP account
- Cloudinary account, if image uploads are needed

Never keep production secrets from the original deployment.

### 3. Change branding

Search the frontend for `DevArena` and replace branding where appropriate.

Typical areas to customize include:

- Product name
- Logo
- Landing-page copy
- About page
- Browser title and metadata
- Footer
- Support contact information
- Privacy/Terms information
- Email templates
- GitHub App name
- GitHub App slug

If you rename the npm workspace package names themselves, also update root workspace scripts that reference:

```text
@devarena/frontend
@devarena/backend
```

You do **not** have to rename the workspace package IDs just to change the public brand.

### 4. Create your own Firebase application

Replace every `VITE_FIREBASE_*` value with your Firebase Web App values and set the matching backend `FIREBASE_PROJECT_ID`.

### 5. Create your own GitHub App

Do not use another owner's GitHub client secret.

Update:

```env
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_SLUG=
GITHUB_TOKEN_ENCRYPTION_KEY=
```

Also change callback/setup/webhook URLs to your domains when deploying.

### 6. Create your own database

Point `DATABASE_URL` to your PostgreSQL database and run:

```bash
npm run db:generate
npm run db:migrate
```

### 7. Change administrator accounts

Set your own comma-separated administrator email list:

```env
ADMIN_EMAILS=you@example.com,second-admin@example.com
```

Do not leave an old owner's email as an administrator unless intentionally required.

### 8. Replace email configuration

Configure your own SMTP account:

```env
EMAIL_HOST=
EMAIL_PORT=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
EMAIL_FROM=
```

### 9. Replace security secrets

Generate unique values for:

```env
JWT_SECRET=
AUTH_OTP_SECRET=
CHAT_DEVICE_SECRET=
GITHUB_TOKEN_ENCRYPTION_KEY=
GITHUB_WEBHOOK_SECRET=
AUTOMATION_SECRET=
```

Example:

```bash
openssl rand -hex 32
```

Never copy these values between public projects.

### 10. Review legal/license information

Update your product-specific Terms, Privacy Policy, support contacts, and legal contact email.

The repository contains an MIT license. Preserve license notices as required by that license when copying or redistributing existing code. You may add appropriate notices for your own modifications where applicable.

### 11. Run a complete build

```bash
npm run build
```

Then test a brand-new user account through the complete mandatory onboarding flow.

---

## Production deployment checklist

When moving from localhost to production, update every environment-specific URL.

For example:

```env
FRONTEND_URL=https://your-frontend.example.com
BACKEND_PUBLIC_URL=https://your-api.example.com
GITHUB_APP_CALLBACK_URL=https://your-api.example.com/api/github/callback
GITHUB_APP_SETUP_URL=https://your-api.example.com/api/github/setup
GITHUB_WEBHOOK_URL=https://your-api.example.com/api/github/webhook
```

Then make the corresponding changes in:

- Firebase authorized domains/settings
- GitHub App homepage URL
- GitHub App callback URL
- GitHub App setup URL
- GitHub App webhook URL
- Frontend hosting configuration
- Backend hosting configuration
- Database networking/SSL configuration
- SMTP sender configuration

Recommended deployment checks:

- `npm run build` succeeds.
- Database migrations have been applied.
- `/health` returns a successful backend response.
- Firebase login works from the production domain.
- New users are forced through username + GitHub setup.
- GitHub OAuth returns to the production backend.
- GitHub App installation returns to DevArena successfully.
- Public and explicitly authorized private repositories can be verified.
- GitHub language percentages appear for verified projects.
- SMTP emails are delivered.
- Cloudinary uploads work if enabled.
- Admin access only appears for intended administrator accounts.
- Webhook signatures are validated when webhooks are enabled.

---

## Security notes

- Never commit `.env` files.
- Never expose backend secrets through `VITE_*` variables; Vite variables are sent to the browser.
- Never commit GitHub client secrets, webhook secrets, private keys, database passwords, SMTP passwords, or JWT/encryption secrets.
- Use a unique `JWT_SECRET` in every environment.
- Use a different `GITHUB_TOKEN_ENCRYPTION_KEY` from the JWT secret.
- Use a strong independent `CHAT_DEVICE_SECRET`.
- Rotate any credential that has ever been committed to Git or shared publicly.
- Give the GitHub App only the repository permissions the application actually needs.
- Use HTTPS in production.
- Keep production and development databases separate.
- Run migrations before starting a newly deployed backend version.

---

## Troubleshooting

### `firebaseUid` does not exist in `UserWhereUniqueInput`

If TypeScript reports errors involving `firebaseUid`, confirm that the Prisma `User` model contains the mapped field and regenerate Prisma Client:

```bash
npm run db:generate
npm run build:backend
```

If a committed migration exists for the field, apply it:

```bash
npm run db:migrate
```

### Frontend opens but API requests fail

Make sure the backend is running:

```bash
npm run dev:backend
```

and verify:

```text
http://localhost:4000/health
```

For local Vite development, make sure the frontend proxy points to the backend:

```env
VITE_API_PROXY_TARGET=http://localhost:4000
```

### Firebase authentication fails

Check:

- `VITE_FIREBASE_*` values in `frontend/.env`
- `FIREBASE_PROJECT_ID` in `backend/.env`
- Required Firebase Authentication providers are enabled
- The current domain is authorized in Firebase

### User cannot enter DevArena after signup

This is usually expected when required onboarding is incomplete.

Confirm all three conditions:

```text
Permanent username selected
GitHub account connected
GitHub App installation configured with repository access
```

A GitHub account is mandatory for the current application flow.

### GitHub says integration is not configured

Check these backend variables:

```env
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_SLUG=
GITHUB_TOKEN_ENCRYPTION_KEY=
```

Also confirm the callback and setup URLs match the GitHub App configuration exactly.

### Private repository cannot be verified

Confirm that the repository was included in the user's GitHub App installation. Connecting the GitHub account alone does not grant access to every private repository.

### Database connection fails

Check `DATABASE_URL`, database availability, SSL requirements, and then run:

```bash
npm run db:check
```

### Prisma types look stale after a schema change

Run:

```bash
npm run db:generate
```

Then restart the backend TypeScript process.

---

## License

This repository currently includes an **MIT License**. Review the included `LICENSE` file before copying, modifying, or redistributing the project, and preserve required license notices.

---

## Final setup summary

For a completely fresh DevArena installation:

```text
Clone repository
      ↓
npm install
      ↓
Create frontend/.env + backend/.env
      ↓
Configure PostgreSQL
      ↓
Configure Firebase
      ↓
Configure mandatory GitHub App
      ↓
npm run db:generate
      ↓
npm run db:migrate
      ↓
npm run db:check
      ↓
npm run dev:backend
      +
npm run dev:frontend
      ↓
Open http://localhost:5173
      ↓
Create account
      ↓
Choose permanent username
      ↓
Connect GitHub + grant repository access
      ↓
Enter DevArena
```
