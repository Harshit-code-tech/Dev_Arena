# DevArena GitHub Integration — Apply and Run

## 1. Replace only the changed files

Copy the files from the patch ZIP into the same paths in your latest DevArena project. Do not copy any `.env` from an old ZIP.

## 2. Rotate exposed credentials first

The source ZIP contained populated environment files. Rotate the database password, JWT secret, SMTP password, Cloudinary secret, GitHub App client secret, GitHub App private key, and any other real secret before deployment.

## 3. Configure the GitHub App

In GitHub App settings:

- Callback URL: `http://localhost:4000/api/github/callback` for local development.
- Setup URL: `http://localhost:4000/api/github/setup` for local development.
- Webhook URL: `http://localhost:4000/api/github/webhook` locally only when using a public tunnel; use the deployed HTTPS backend URL in production.
- Webhook secret: generate a long random value and put the same value in `GITHUB_WEBHOOK_SECRET`.
- Repository permissions:
  - Metadata: Read-only.
  - Contents: Read-only. This is needed for deterministic manifest/technology detection.
- Subscribe to events:
  - Push
  - Repository
  - Installation
  - Installation repositories
- Installation availability: Any account.

For production, replace all three local backend URLs with the deployed HTTPS backend domain.

## 4. Configure backend environment variables

Copy `backend/.env.example` to `backend/.env`, then fill every required value. Keep the GitHub private key as escaped `\n` lines if your host stores one-line environment values.

Generate secure values in PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Use separate generated values for `JWT_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY`, and `GITHUB_WEBHOOK_SECRET`.

## 5. Install and migrate without resetting existing data

Back up the database first. From the project root:

```powershell
npm install
npm run db:generate
cd backend
npx prisma migrate deploy
cd ..
```

The migration file is already included, so do not generate a second migration with the same changes. `migrate deploy` applies pending migrations without offering to reset the database.

For a disposable local development database only, `npm run db:migrate` is acceptable. If Prisma reports drift and asks to reset a database containing data, answer **No** and use the `migrate deploy` commands above instead.

## 6. Start DevArena

Open two terminals at the project root.

Terminal 1:

```powershell
npm run dev:backend
```

Terminal 2:

```powershell
npm run dev:frontend
```

Open `http://localhost:5173`.

## 7. Connect and test GitHub

1. Sign in to DevArena.
2. Open Settings → Repository evidence.
3. Select Connect GitHub.
4. Select Install GitHub App.
5. Choose all repositories or selected repositories.
6. Return to Settings and select Refresh and recheck access.
7. Open Projects → Create project.
8. Choose a repository from the searchable selector.
9. Select Verify repository evidence.
10. Confirm languages and detected technologies appear.
11. Create the project.

Test one public and one private repository. For the private project, confirm the public Shared Project and Player Hub display `Private repository` without exposing its owner/name or URL.

## 8. Production deployment order

1. Deploy the backend with the new environment variables.
2. Run `npx prisma migrate deploy` from the deployed backend workspace, then run `prisma generate` as part of the build/install process.
3. Update GitHub App callback, setup, and webhook URLs to the deployed backend HTTPS URL.
4. Deploy the frontend.
5. Reconnect GitHub once from Settings and manage repository access once so installation/account records are synchronized.

## 9. Webhook note for local development

GitHub cannot call `localhost`. Push-driven refreshes require either the deployed backend or a temporary HTTPS tunnel. Manual refresh and request-time stale rechecks work without a webhook during local development.
