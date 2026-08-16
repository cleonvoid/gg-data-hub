# Invariants

Rules that have been broken and corrected more than once in this repository.
Read this before changing configuration, data-layer, or authentication code.

## 1. Never substitute one data store for another at runtime

The driver is selected once in `createStore()` (`server/db/index.ts`) and never
changes. Do not add `setStore()`, a proxy wrapper, a `ResilientDataStore`, or any
`catch` that retries an operation against a different store. A Firestore failure
must propagate to the caller and surface as HTTP 503 via `handleRouteError()`.

An automatic switch splits writes across two backends with no way to reconcile
them, and on Cloud Run the JSON store is per-instance memory that vanishes on
restart, so the data loss is silent.

## 2. Never hardcode an environment variable into an npm script

`"dev"` must stay `tsx server.ts`. An inline `DATA_STORE=json` overrides `.env`
and the command line, which makes the Firestore driver untestable locally and
hides the startup check.

This rule applies to npm scripts only. It is NOT a reason to remove
`process.env` reads from application code. Application code should read
environment variables and supply a fallback, as in
`Number(process.env.PORT) || 3000`.

## 3. Never widen an authentication default

`ALLOW_ANON_DEMO` is opt-in: the check is `=== 'true'`, never `!== 'false'`.
An unset or malformed value must never grant access. A token that fails
verification is a hard 401 and must not fall through to the demo path.

## 4. Never replace a failure with plausible-looking data

Every `catch` must either rethrow or log the real error and set state the UI
renders. Do not write `catch {}` or `catch (_e) { /* fall back */ }`. A visible
error is always better than invisible wrong data.

## 5. Do not declare optional variables as empty in `.env.example`

A bare `NAME=` line is read as a required-but-unset secret and blocks the build
with a prompt. Document optional variables as comments only.

## 6. The server must bind the injected PORT

`server.ts` must read `Number(process.env.PORT) || 3000`. Cloud Run injects
`PORT` and terminates containers that do not bind it, so hardcoding the port
breaks deployment. The literal 3000 is a local default only, never the bound
value in production.
