# Cloudflare setup

The Worker serves the dashboard and authenticated `/api/*`; D1 stores observations. This is one station per Worker. Use your own Cloudflare account and new secrets. No existing account/database/service is referenced by the public template.

Commands use PowerShell and Node 22+. From the repository root:

```powershell
cd cloudflare
npm.cmd ci
Copy-Item wrangler.example.jsonc wrangler.jsonc
Copy-Item .dev.vars.example .dev.vars
```

The actual config and secret files are ignored by Git. The template's all-zero database UUID is a placeholder. `DEVICE_ID` defaults to `yard-1` and must match firmware. `DEVICE_LABEL` is shown publicly on the login shell; use a non-sensitive label.

## Local preview

Generate two **different** 32-byte random values (64 hex characters) and put them into `.dev.vars` as `DEVICE_SECRET` and `READ_TOKEN`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
npm.cmd run db:local
npm.cmd run dev
```

Run the generator separately for each secret. Open `http://127.0.0.1:8787` and enter the read token. The ingestion key is used as literal UTF-8 text on both server and device, not decoded hex bytes.

For a synthetic observation in the local database, use a second terminal:

```powershell
cd cloudflare
$env:DEVICE_SECRET = 'your-local-ingestion-secret'
npm.cmd run test:event
Remove-Item Env:DEVICE_SECRET
```

The simulator defaults to localhost. Synthetic data is not hardware validation; keep it out of real history. The optional `node scripts/integration.js` uses deliberately known test values: DEVICE_SECRET is 64 `a` characters and READ_TOKEN is 64 `b` characters. Configure a **local-only test database** with those values to run it. Never use these dummy keys on an Internet endpoint; production secrets must be different from local ones.

## Create a deployment

In `cloudflare`:

```powershell
npx.cmd wrangler login
npx.cmd wrangler whoami
npx.cmd wrangler d1 create lightning-v1
```

Choose the account intentionally, especially if you have personal and work accounts. Add its `account_id` to your ignored `wrangler.jsonc` and replace `database_id` with the UUID returned by D1 creation. Choose a Worker name available in that account; set your device ID/label. Check inherited `CLOUDFLARE_ACCOUNT_ID`/API credentials do not redirect deployment elsewhere.

Generate **new, distinct production values** for DEVICE_SECRET and READ_TOKEN. Initialize the remote schema, upload secrets using the prompts, and deploy:

```powershell
npm.cmd run db:remote
npx.cmd wrangler secret put DEVICE_SECRET
npx.cmd wrangler secret put READ_TOKEN
npm.cmd run deploy
```

Paste values at the prompts; avoid putting production secrets into command lines, tracked files, screenshots or issues. The result gives your HTTPS `workers.dev` address. The static login shell is public. Verify `/api/status` and `/api/history` reject unauthenticated reads, then log in with the read token. Provision firmware with the same DEVICE_ID and DEVICE_SECRET and the returned **base URL without a trailing slash**. There is no home-router port forwarding.

Preview URLs are disabled by the template. No notification destination is configured. Static assets are self-contained, with no CDN, map service or third-party chart library.

## TLS root for firmware

Inspect your actual deployed hostname's certificate chain using a trusted browser certificate viewer or `openssl s_client -connect HOST:443 -servername HOST -showcerts`. Identify its root CA; do not assume every deployment always uses the same chain. Obtain the PEM root from the CA's official site, review issuer/subject/fingerprint/validity, then from the repository root:

```powershell
python tools/install_ca.py path/to/reviewed-root.pem
```

This writes ignored `firmware/include/tls_ca.h`. Use a root trust anchor, not the site's short-lived leaf certificate. Verify the real hostname on the Feather with a valid clock. Wrong roots, invalid dates and hostname mismatches must fail. The example header is intentionally empty: incomplete configuration retains the queue, without an insecure TLS fallback. NTP must be reachable for fresh send time and certificate-date checks.

## Dashboard access and data

**Remember this browser** is checked by default. An accepted token is saved in the site's local storage for repeat visits in the same browser profile. Unchecking uses tab-only session storage. Sign out clears both stores; other remembered tabs return to login when saved access changes. Blocked storage falls back to tab/page access with an explanatory message. Private browsing, cleared data, another profile/device or token rotation can require login again. Save access only in a browser you trust.

The dashboard checks once per minute while visible; health reports from the device normally arrive every six hours. Its last successful cloud check is separate from the station's last report. Connection failures mark retained readings stale; a sensor/storage fault or >12-hour overdue report makes activity unknown.

History loads in 200-row pages, displays 20 matching rows and caps a tab at 2,000 loaded records. JSON export includes all loaded records. The **Distance over time** scatter plot uses detection times from loaded history for the last 24 hours, preserves overhead/beyond-40 km semantics and does not infer a direction or predicted track. Untimed/missing/invalid ranges are counted separately. Unloaded or uncaptured events cannot appear.

The voltage-based battery estimate is rounded to 5% and is not a measured state of charge. USB charging, absence of a battery, load, temperature and ADC calibration affect it; see [power](power.md).

## Retention, outages and costs

A daily scheduled handler deletes observations older than 30 days. Use D1 export/Time Travel tooling for backups, reviewing your account's actual retention entitlement. No always-available LAN dashboard is hosted by the sleeping Feather; on Internet failure it buffers observations and retries.

A modest single station may fit free Workers/D1 quotas, but this is not a billing guarantee. Row-write billing includes index work. Check current [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) before deploying.

## Notifications

Notifications are disabled; the browser is not prompted and no delivery integration is provisioned. See [options](notifications.md) before future work. The optional server-side `ALERT_WEBHOOK_URL` sends generic JSON for fresh timed lightning with a ten-minute durable cooldown. A provider usually needs an adapter and authentication. A failed request retains the cooldown; there is no outbox, receipt or guaranteed delivery. Do not configure it while running synthetic tests.
