# QA results — 6 October 2026

## Corrected defects

- Testing in the connected visible browser found the delay label initially showed 1200 ms while the range input snapped to 1000 ms. The default is now 1500 ms, matching its 500 ms steps, with a regression assertion for the displayed label and actual slider value.

- Delayed API responses could return private data after logout or an admin role change. The API now applies the delay before reading current data and authorizing the request.
- Reading persistent data before awaiting a request body could let a slow upload overwrite another write. Parsing completes before the latest data is read; a slow-upload regression test verifies both writes survive.
- Empty delay values, malformed encoded user IDs, oversized member fields, and unsupported update fields lacked correct validation. These now return HTTP 400.
- Expired or deactivated sessions left the dashboard open. The HTTP interceptor clears the matching session and redirects to login on HTTP 401.
- An older refresh response could overwrite a newer result or restore user state after leaving the dashboard. Responses are now checked against the current refresh, user and component lifetime.
- Duplicate submission handlers could send multiple requests. Login and member mutations now guard pending submissions.
- Mobile navigation and sign-out lost their accessible text when labels were hidden. Buttons now have explicit accessible names.
- Secondary text and status badges failed contrast checks. Their colors now pass the automated checks on tested screens; buttons have visible keyboard focus.
- The horizontally scrolling record table was inaccessible to keyboard scrolling. Its labeled region is now focusable, and the empty-row column count matches the role.
- The old Karma dependency tree had known advisories. The generated root smoke tests were replaced by a reproducible browser QA suite, and unused test dependencies were removed.

## Verification

| Check | Result |
| --- | --- |
| Angular production build and template compilation | Pass |
| Strict TypeScript API type check | Pass |
| API regression suite | 6 regression tests pass |
| Isolated Edge browser QA | 11 scenarios pass |
| Original desktop/mobile browser smoke flow | Pass |
| Automated WCAG A/AA checks | No violations on login, overview, admin directory and mobile record screens |
| Browser uncaught JavaScript errors | None in QA run |
| npm dependency audits | Zero known vulnerabilities in frontend and API |

Browser QA tests use a temporary database and separate local servers, so they do not add test members to the normal demo data. Automated accessibility checks cover machine-detectable issues on these screens; they are not a formal accessibility certification.

## Interactive browser verification

An interactive browser pass covered wrong-role login, successful user/admin login, user-only versus all-admin records, the 5000 ms loading state, session restoration after reload, duplicate email rejection, member creation, empty records for a new user, pausing a member, and rejected login for the paused member. A temporary QA member was left paused in the local development database and is excluded by `.gitignore`; it is not part of the submitted source. The initial slider mismatch was corrected and rechecked.
