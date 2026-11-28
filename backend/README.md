# Administrator service

The live source is the D1 `documents` row named `branches`. The frontend remains on GitHub Pages and reads the public `/api/branches` endpoint. Updates require a valid administrator session, matching origin, matching revision, and server-side field validation. Only upsert/delete operations are sent, avoiding a full directory upload on every change. The update uses an atomic `WHERE revision = ?` write.

Worker Secrets contain `ADMIN_USERNAME`, `ADMIN_PASSWORD_SALT`, and `ADMIN_PASSWORD_HASH`. The hash is PBKDF2-SHA256 with 100,000 iterations, a random salt represented as a hex string, and 32 output bytes represented as hex. Neither a plaintext password nor any GitHub credential is deployed. Login returns a random eight-hour session kept only in browser memory; D1 stores its SHA-256 hash. Passwords and sessions must never be added to this repository.

Deployment uses the installed `cf` CLI; no Wrangler configuration is used:

1. Apply `schema.sql` to the configured D1 database if provisioning a fresh instance.
2. Run `node build.mjs` in this directory. This prepares a complete Workers Build Output manifest without secrets.
3. Preview `cf deploy --prebuilt --dry-run`.
4. Deploy with `cf deploy --prebuilt --secrets-file <temporary-private-secrets-file>`. Remove the temporary file after successful verification. Existing database records are retained across deployments; `branches.json` is used only when initializing an empty database.

For a fresh account, replace the database/account identifiers in `build.mjs` and `cloudflare.config.ts`, and update the service URL and allowed origin in the frontend, CSP and Worker.

Use `node --test backend/worker.test.mjs tools/admin-data.test.mjs` from the repository root. Tests use an in-memory SQLite database and never change production branch records.

After dashboard edits, retrieve the current public document before editing offline spreadsheets, importing new workbooks, or regenerating GIS snapshots. Publishing a changed `branches.json` in GitHub alone does not replace the live D1 data.
