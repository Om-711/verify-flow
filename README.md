# Verify Flow

An Angular 20 single-page application with a TypeScript/Node API for managing verification records. The interface includes sign-in, user details, a check-record table, an admin member directory, and a visible async loading demo.

## Run locally

Requires Node.js 22+ and npm. Open two terminals:

```powershell
cd server
npm install
npm run dev
```

```powershell
cd client
npm install
npm start
```

Open `http://localhost:4200`. Angular's dev server proxies `/api` to `http://localhost:3000`.

| Role | User ID | Password |
| --- | --- | --- |
| General User | `USR-001` | `User@123` |
| General User | `USR-002` | `User@123` |
| Admin | `ADM-001` | `Admin@123` |

The login page can fill the first general-user or admin account. Choosing a role is part of the credential check; a user cannot gain admin access by changing the selection. The API filters records by the authenticated user. Admins can see all checks, add users, change roles, and pause or reactivate accounts.

## Async demo

On dashboard load, the profile and record requests start independently with a 1.5-second `delayMs` query parameter. Open **My checks** to set the delay from 0 to 5000 ms and refresh. Each panel displays its own loading state while the rest of the page stays usable. `AuthService.restore()` uses Angular's app initializer to validate a saved session before routing; `UserService` owns the profile, records, and member API calls.

## API and storage

The server uses a local JSON file at `server/data/db.json`, generated on first API use. It persists users and sample records. Passwords are hashed with Node's `scrypt`; API responses never return hashes. Sessions are opaque in-memory tokens and expire on server restart, which is appropriate for this local demo. Set `MPLOYCHEK_DATA_FILE` to use another data file. The API accepts `delayMs=0..5000` on requests and rejects invalid values.

| Endpoint | Access | Purpose |
| --- | --- | --- |
| `POST /api/login` | Public | Authenticate ID, password, role |
| `POST /api/logout` | Signed in | Revoke token |
| `GET /api/me` | Signed in | Current user |
| `GET /api/records` | Signed in | Own checks, or all for admin |
| `GET /api/users` | Admin | Member directory |
| `POST /api/users` | Admin | Add member |
| `PATCH /api/users/:id` | Admin | Change role or active status |

## Verify

```powershell
cd server
npm run typecheck
npm test
```

```powershell
cd client
npm run build
npm test
```

`npm test` from `client` starts an isolated frontend on port 4201 and an API on port 3002 with temporary data, runs the browser QA suite, and cleans up afterward. It needs Edge installed, or a `CHROME_BIN` environment variable pointing to Chrome/Edge. This suite covers account management, session restoration and revocation, overlapping refreshes, error recovery, mobile navigation, and automated accessibility checks. Run `npm run test:e2e` for the original smoke flow with both normal local servers running. The API suite includes invalid input, record isolation, delayed authorization, and concurrent persistence. See `QA_RESULTS.md` for findings and fixes.

## Implementation notes

The UI deliberately keeps the workflow small: a focused sign-in screen, a dashboard with independent loading states, and a separate admin directory. The API owns authorization and record filtering so the client never decides which checks a user may read. The local JSON store keeps the demo easy to run without cloud credentials; the storage boundary is isolated in `server/src/store.ts` so it can be replaced with MongoDB or DynamoDB later.

The design uses a compact green-and-ink palette, generous spacing, keyboard-visible focus, and a responsive table region. The test commands exercise the main workflows and common failure cases.

## Scope

This is a local demonstration with seeded fictional accounts. Before using it in production, replace the JSON store with a database, add session expiry and rate limits, and deploy behind HTTPS. It does not connect to a real background-verification service.
