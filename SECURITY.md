# Security and public/private boundaries

The public repository contains source, examples, tests, generic build guides and licensed mechanical references. Each replica must supply its own credentials and deployment identifiers.

Keep these private:

- Wi-Fi passwords, `DEVICE_SECRET`, dashboard `READ_TOKEN`, GitHub/Cloudflare access credentials and webhook credentials.
- `firmware/include/secrets.h`, local `.dev.vars`/`.env` files, generated configuration and provisioning records.
- Compiled firmware and full-flash backups: they can embed Wi-Fi passwords and ingestion secrets, even when the source tree looks clean.
- Raw serial/device logs, actual service/account/database/device IDs and location information when sharing a build report.

The login page can be public; status/history APIs require the read token. Ingestion uses a different HMAC secret. Do not make the sensor readings public by embedding a token in dashboard JavaScript. The Git ignore list is a convenience, not a substitute for reviewing staged files.

Remembered access lives in browser local storage after validation. Anyone able to use or compromise that browser profile may read the station. Use tab-only access on shared computers; sign out clears saved access. Rotate exposed secrets in Cloudflare and rebuild firmware after an ingestion/Wi-Fi secret change. Clearing a browser's storage does not rotate the server token.

The repository provides one station per Worker; multi-user roles, remote firmware updates and a notification delivery outbox are not implemented. Preserve HTTPS certificate validation and isolate synthetic events from production. Optional webhooks remain unconfigured.

Use GitHub's **Report a vulnerability** action on the repository Security tab for sensitive disclosures. Do not put tokens, passwords, private logs or exact location into public issues. Public issues are appropriate for reproducible non-sensitive bugs.
