# DevArena GitHub and Messaging Fix Report

## Implemented

### GitHub connection and installation
- GitHub App authorization callback and installation setup callback.
- Backend-only encrypted OAuth access and refresh-token storage.
- Backend-only installation IDs; installation IDs are removed from browser API responses.
- Stored GitHub installation/account records and authorized repository snapshots.
- Connect, reconnect, install/manage access, refresh, and disconnect controls in Settings.
- Remote GitHub authorization revocation during disconnect when possible.
- Signed GitHub webhook verification.

### Repository requirements and verification
- GitHub repository is mandatory for every new project.
- Searchable authorized-repository selector plus exact root-URL fallback.
- Initial Project Status selector.
- Exact root URL validation; profile, issue, pull request, commit, and branch URLs are rejected.
- App-installation membership verification.
- Public and private repository support through installation tokens.
- Effective collaborator permission enforcement: admin, maintain, or write only.
- Archived and disabled repository rejection.
- Duplicate repository prevention using the stable GitHub repository ID.

### Stored repository evidence
- Repository ID and node ID.
- Owner numeric ID and login.
- Repository name and full name.
- Public/private visibility.
- Default branch and repository URL.
- Backend-only installation ID.
- Effective permission and role.
- Verification/check timestamps and last push time.
- Language bytes and percentages.
- Detected technology stack and evidence status.

### Languages and technology detection
- GitHub language endpoint integration and two-decimal percentage calculation.
- Deterministic manifest inspection for JavaScript/TypeScript, Python, Java/Kotlin, Go, Rust, Ruby, PHP, Docker, and Prisma ecosystems.
- Framework/tool detection for React, Vite, Next.js, Express, NestJS, Firebase, Expo, React Native, Flask, Django, FastAPI, PyTorch, TensorFlow, Spring Boot, and more.
- Project cards/details, Shared Project, Player Hub, and PDF export integration.
- Private public-facing projects expose language and technology names without repository identity or internal manifest paths.

### Access rechecks and enforcement
- Rechecks during creation, sharing, every new completion transition, manual refresh, reconnect, stale project loading, and PDF export.
- Hourly server maintenance loop, configurable with `GITHUB_MAINTENANCE_MINUTES`.
- Push, repository, installation, and installation-repository webhook handling.
- Lost access unshares the project and blocks new logs, log edits, milestone changes, milestone points, sharing, and completion while preserving history.
- Specific stored states for disconnected, archived, not found, lost access, and verified repositories.

### Direct Messaging
- Only the internal timeline scrolls; the Player Hub page, header, and composer remain fixed.
- IndexedDB-backed encrypted offline queue.
- Visible encrypting, queued, sending, failed, sent, delivered, and read states.
- Strict queue ordering for retryable failures.
- Automatic reconnect sending and persistent Retry behavior.
- Exact local timestamps instead of relative phrases.
- Existing encryption, delivery/read ticks, notifications, and routes preserved.

### Interface fixes
- Shared Project Back action.
- Shared accessible dropdown with search, keyboard navigation, outside-click close, disabled state, selected state, and error state.
- No native project repository dropdown; Create Project uses the same shared animated dropdown system.
- Verified GitHub evidence replaces placeholder Tech Profile signals.

## Validation completed
- Modified TypeScript and TSX files passed syntax transpilation.
- `git diff --check` passed with no whitespace errors.
- Output package excludes populated `.env`, PEM, and private-key files.

## Validation limitation
- A full `npm install` and production build could not be completed in the patch environment because its package registry returned missing-package errors for locked dependencies. Run the commands in `APPLY_AND_RUN.md` locally after copying the patch.
