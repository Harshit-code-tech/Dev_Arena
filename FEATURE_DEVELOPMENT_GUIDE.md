# DevArena Feature Development Guide

Last updated: 2026-08-28

This guide explains how to add a new feature to DevArena without breaking the
current project structure. Use `PROJECT_STRUCTURE.md` to understand what already
exists; use this file when deciding where new code should go.

## 1. Before creating files

Clarify these points first:

1. Is this a frontend-only feature, backend-only feature, or full-stack feature?
2. Does it need a client route?
3. Does it need an API route?
4. Does it need new database tables or fields?
5. Does it reuse existing shared UI, auth, layout, heatmap, date, or mapping logic?

Do not create folders just because a template allows them. Create the folder
only when the feature actually needs that responsibility.

## 2. Naming rules

- Use PascalCase for frontend source files:
  - `Dashboard.tsx`
  - `DashboardService.ts`
  - `DashboardConstants.ts`
  - `Firebase.ts`
- Keep framework entry files lowercase when that is the ecosystem convention:
  - `main.tsx`
  - `index.ts`
  - `index.html`
- Backend module files stay lowercase and responsibility-based:
  - `feature.routes.ts`
  - `feature.controller.ts`
  - `feature.service.ts`
  - `feature.repository.ts`
  - `feature.types.ts`
- Constants should live in explicit constants files:
  - Frontend: `FeatureConstants.ts`
  - Backend: colocate constants in the module only if they are private to that
    module; move shared constants to `backend/src/shared` only when reused.
- Types/interfaces should not be hidden inside large logic files when reused.
  Prefer:
  - Frontend: `FeatureTypes.ts` or a focused existing types file.
  - Backend: `feature.types.ts`.

## 3. Frontend feature structure

Frontend feature code lives under:

```text
frontend/src/features/<feature>/
```

Use this shape as a guide, not a mandatory template:

```text
frontend/src/features/<feature>/
  pages/
    FeaturePage.tsx
  components/
    FeatureSpecificComponent.tsx
  styles/
    Feature.css
```

Optional folders:

```text
api/        Feature-specific external calls, when needed
context/    Feature-specific React context, when needed
utils/      Pure helpers that are only useful inside this feature
```

Rules:

- Route-level screens go in `pages/`.
- UI pieces that are only used by this feature go in `components/`.
- CSS that only belongs to this feature goes in `styles/`.
- Reusable UI must go in `frontend/src/shared/components`.
- Reusable layout shells must go in `frontend/src/shared/layouts`.
- Reusable hooks must go in `frontend/src/shared/hooks`.
- Reusable types must go in `frontend/src/shared/types`.
- Feature folders should stay practical. If a feature has one page and one CSS
  file, do not create empty `api`, `hooks`, `types`, or `utils` folders.

## 4. Frontend service layer

Frontend services live under:

```text
frontend/src/services/
```

Use frontend services for client-side work that should not live directly inside
React components:

- mapping backend responses into UI-ready objects;
- formatting dates or labels for display;
- calculating progress, summaries, heatmaps, ranks, or derived state;
- normalizing missing or invalid response values;
- reusing the same client-side computation in more than one component.

### Shared API client

All authenticated API calls should use the shared `apiRequest` helper exported
from `frontend/src/services/ApiClient.ts`. This centralizes token handling,
envelope parsing, and error extraction so that individual service files only
define types and thin endpoint wrappers.

Do **not** create new `request()` or `authorizedRequest()` helpers in individual
service files. Import `apiRequest` from `ApiClient` instead.

Example:

```text
frontend/src/services/ApiClient.ts          — shared authenticated request helper
frontend/src/services/ChallengeService.ts   — types + thin endpoint wrappers
frontend/src/services/LeaderboardService.ts — types + thin endpoint wrappers
frontend/src/services/TrackingService.ts    — types + thin endpoint wrappers
frontend/src/services/DashboardService.ts
frontend/src/services/DashboardConstants.ts
```

Keep service functions focused. One function should do one clear job. Prefer
small composition over one large function with many unrelated branches.

A good pattern is:

```ts
function buildFeatureViewModel(response: BackendFeatureResponse): FeatureViewModel {
  const items = mapBackendItems(response.items);
  const summary = buildFeatureSummary(items);

  return {
    items,
    summary,
  };
}
```

Avoid putting JSX, React state, or component event handlers inside service files.
React components should call services and render the result.

## 5. Auth and token handling

Auth token storage is centralized in:

```text
frontend/src/features/auth/api/AuthStorageService.ts
```

Do not read or write auth token storage directly from random pages, services, or
components. Import a helper from `AuthStorageService.ts` instead.

Auth-specific API behavior is split into focused files under:

```text
frontend/src/features/auth/api/
```

Examples:

- `EmailAuthService.ts`
- `SocialAuthService.ts`
- `AuthSessionService.ts`
- `FirebaseUserSyncService.ts`
- `FirestoreUserService.ts`
- `TwoFactorAuthService.ts`
- `PasswordResetService.ts`

`AuthService.ts` is only a barrel export for auth API modules.

## 6. Adding a frontend route

Add client routes in:

```text
frontend/src/app/Router.tsx
```

Use the existing route style:

- public routes are registered directly;
- protected routes must use the existing protected route wrapper;
- app-shell pages should render inside the existing app layout.

If the route needs navigation, update the relevant shared component:

```text
frontend/src/shared/components/Sidebar.tsx
frontend/src/shared/components/Header.tsx
```

Only add navigation when the route should be reachable from the UI.

## 7. Backend feature structure

Backend feature modules live under:

```text
backend/src/modules/<feature>/
```

Use this shape:

```text
backend/src/modules/<feature>/
  feature.routes.ts
  feature.controller.ts
  feature.service.ts
  feature.types.ts
```

Responsibilities:

- `routes`: Express route paths, HTTP methods, and middleware only.
- `controller`: read request data, call the service, send the response.
- `service`: business rules, orchestration, and Prisma queries.
- `types`: request, response, and module domain types.

Controller pattern — every handler follows this shape:

```ts
function userId(req: Request) { return req.user?.id || ""; }

export const handler = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await service.method(userId(req), req.body as InputType);
        res.status(200).json({ success: true, data });
    } catch (error) {
        const result = sendTrackingError(error);
        res.status(result.status).json({ success: false, message: result.message });
    }
};
```

Do not put Prisma queries in controllers. Do not put Express `req` or `res`
objects in services.

Reference implementation: `backend/src/modules/challenges/` demonstrates a
complete module with routes, controller, service, and types for the weekly
competition engine.

## 8. Adding a backend route

Create a router in the feature module:

```ts
import { Router } from "express";

const router = Router();

router.get("/", getFeatureItems);

export default router;
```

Wire it in:

```text
backend/src/app.ts
```

Example:

```ts
app.use("/api/features", featureRoutes);
```

Use existing auth middleware for protected routes. Public routes should be
intentional and documented.

## 9. Database changes

If the feature needs persistence:

1. Update `backend/prisma/schema.prisma`.
2. Create a migration from the `Dev_Arena/` workspace root:

   ```text
   npm run db:migrate
   ```

3. Regenerate Prisma Client if needed:

   ```text
   npm run db:generate
   ```

4. Update seed data only when local development needs default records.

Do not manually edit generated Prisma Client files.

## 10. Environment variables

Backend environment variables belong in `backend/.env`.
Frontend Vite variables belong in `frontend/.env` and must start with `VITE_`.

If a feature adds an environment variable, update:

- `PROJECT_STRUCTURE.md`
- local `.env.example` or setup docs if those files exist later

Never commit real secrets.

## 11. Validation checklist

Before handing off a feature:

```text
npm run build:frontend
npm run build:backend
```

If the feature touches database or backend startup:

```text
npm run db:check
```

If the feature changes Prisma schema:

```text
npm run db:migrate
npm run db:generate
```

Manual checks:

- route loads correctly;
- protected routes redirect correctly when logged out;
- API returns expected status codes;
- frontend handles loading, empty, success, and error states;
- shared components were not duplicated into feature folders;
- direct auth token storage access was not added outside `AuthStorageService.ts`.

## 12. Documentation checklist

When adding or changing a feature, update `PROJECT_STRUCTURE.md` in the same
change:

1. Add or update the client route.
2. Add or update the API endpoint.
3. Update the feature register.
4. Update the data model section if Prisma changed.
5. Update environment variables if any were added.
6. Add new known gaps if the feature is intentionally partial.
7. Update the `Last reviewed` date after checking the implementation.

Update this guide only when the feature-development process itself changes.
