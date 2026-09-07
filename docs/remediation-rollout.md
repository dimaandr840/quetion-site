# Reliability remediation — rollout and remaining work

## Review and compatibility

This branch is not a production deployment. Require passing CI and staging review before merge.

- Tokens without the new credential-version claim intentionally stop working. Existing sessions must sign in again.
- Password changes/reset invalidate access, refresh and MFA tokens; disabled accounts and removed roles are checked on access.
- Authentication counters and refresh-replay revocation now commit on specifically reviewed expected rejection exceptions. Unexpected failures still roll back.
- Account row locks serialize per-account changes. PostgreSQL concurrency/load testing remains required; H2 tests are not proof of PostgreSQL lock behavior.
- Search API adds `unfilteredTotal` and `popularCount`, plus `sort` and `only`. Deploy web/API together. UI pagination is one-based; API pagination is zero-based.
- Large index result sets explicitly fall back to database substring search; fuzzy matching is unavailable in that degraded mode. Candidate processing remains in memory and needs a separate SQL/index pagination redesign for large catalogs.

## Release changes

- Production build starts only after a successful main-branch push CI run from this repository.
- The released commit is the CI head SHA; images are deployed by digest.
- Manual workflow dispatch now only rolls back a previously recorded full 40-character commit SHA. It does not rebuild code.
- `.releases/<sha>` on the VPS records API/web digests. Do not delete or publicly serve this directory. Back it up with operational configuration.
- Existing releases before this mechanism have no manifest. Do not invent one from a mutable tag; retain the prior running images for the first automatic rollback.
- The host must already be provisioned. Deploy updates only api/web/nginx, without dependency recreation or orphan removal; postgres/backups/monitoring remain untouched.
- Failed health checks restore previous application images and tracked configuration. Nginx is recreated to reload mounted configuration. Automatic rollback uses local image IDs with `--pull never`.
- Database migrations are NOT automatically reversed. Future migrations must follow expand/contract compatibility before an older application can be restored.
- `HEALTH_ORIGIN` replaces the single `HEALTH_URL` variable. Checks cover API health, home and search. Set the origin appropriate for the VPS/TLS topology.
- Set repository variables `PUBLIC_ORIGIN`, `MEDIA_PUBLIC_BASE_URL`, and optionally `GA_ID`. These are build-time public configuration, not secrets.
- Existing SSH/GHCR credentials are unchanged. Production environment approval/branch protection must be reviewed in GitHub settings.

## Content consistency

External index/media mutations are deferred until DB commit. Media dimensions and actual image format are validated before decoding. Search rechecks `published` against the DB and bypasses the frontend search fetch cache.

`AfterCommit` is best effort, NOT a durable outbox. A process crash after DB commit or an external failure can still leave index drift or orphaned objects. The follow-up is a durable outbox with retry/idempotency and reconciliation. Meilisearch task completion and atomic index swap also remain open. Do not claim exactly-once delivery.

## Frontend

- Filters have dialog semantics on mobile, focus containment, background inertness, Escape handling and focus restoration.
- Native no-JS filters are outside the CSS-hidden mobile panel. Search has a real GET action.
- Filter controls are disabled while their navigation is pending to avoid overwriting a previous selection with stale props.
- Progress survives blocked/quota-limited localStorage in memory for the current page session.
- Dependency lockfile was regenerated; CI/Docker use Node 24 and `npm ci`.

## Required staging checks

- Login failures persist counters; concurrent attempts cannot lose increments.
- TOTP code replay is rejected, including concurrent requests.
- Password reset invalidates already-issued access/MFA tokens; admin role removal takes effect.
- Unpublish a question while Meilisearch deletion fails: public search must not return its summary.
- Search beyond the first page; combine levels/professions/popularity/sort; confirm disjunctive facets.
- Roll back a deliberately failed application release without touching postgres, backup or monitoring containers.
- Open/close filters with keyboard and touch at 390px, switch to desktop, test Back/Forward, zoom and no-JS mode.
- Inspect light/dark screenshots. Automated type/lint/build checks are NOT visual QA.
- Verify real backup restore, production alerts, analytics consent and frontend runtime error reporting.

## Not part of this corrective patch

No product redesign, account-sync feature, AI feature, live performance certification, full accessibility certification or production backup drill is claimed. Existing full-catalog reads and durable event delivery require further work, not a claim that every audit item is closed.
