# Notification options — assessment only

Reviewed 2026-10-09. Notifications remain disabled. This review did not create accounts, provider credentials, subscriptions, service workers, webhook destinations, delivery jobs or browser permission prompts. The dashboard's notification panel is informational; its former tab-permission action has been removed.

## Options to evaluate

The following are future integration options, not tested integrations. Confirm current provider capabilities, phone platform, account/license requirements and privacy settings before implementation.

| Option | What it would provide | Work and tradeoffs before enabling |
| --- | --- | --- |
| Pushover | Dedicated phone notifications; its API supports priorities and delivery receipts for emergency-priority messages. | Install/register its client and create separate application/user credentials. Implement a server-side provider adapter. Routine detector messages should use ordinary priority; do not imply an official warning or silently enable repeating emergency alerts. [Official API](https://pushover.net/api). |
| ntfy | Phone/web push with hosted or self-hosted service options and HTTP publishing. | Choose hosting and an authenticated, access-controlled topic. Add its expected message payload and server-side authentication. Self-hosting adds maintenance; iOS delivery has additional upstream requirements. [Publishing and authentication](https://docs.ntfy.sh/publish/), [self-hosting configuration](https://docs.ntfy.sh/config/). |
| Web Push | Notifications associated with this dashboard, including when its page is not loaded. | Add a service worker, explicit opt-in, push subscriptions, server-side key management, expiry/unsubscribe handling and delivery retries. Browser/OS support and installation requirements need testing on the actual phone. More application work than a dedicated push provider. [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API). |
| Home Assistant | Existing home automation rules and Companion app notifications. | Useful if Home Assistant is already running. Use a secured integration path; webhook triggers are local-only by default and a cloud Worker cannot reach a private LAN URL directly. Map the event to an automation and Companion notification. [Webhook triggers](https://www.home-assistant.io/docs/automation/trigger/#webhook-trigger), [Companion notifications](https://companion.home-assistant.io/docs/notifications/notifications-basic/). |

Email would be more suitable for a health summary than frequent storm observations. SMS introduces another provider and delivery costs; it is not the first candidate for this small personal deployment. Neither was configured.

## Delivery design to settle first

These are future requirements, not implemented changes:

- Keep provider credentials in server-side secrets, separate from the dashboard read token and the device ingestion secret.
- Notify only on fresh, timed observations. Do not alert on historical queue recovery, untimed lightning, noise, or a disconnected AS3935.
- Group a burst into one message with a cooldown; let the owner choose whether nearby activity, all activity, station faults or overdue reports matter.
- Add a durable delivery outbox, bounded retries and a clear delivery status. Do not equate an accepted HTTP request with a notification seen by a person.
- Include station name, recorded time, estimated range and a dashboard link. Keep the instrument's limitations visible; detector notifications do not replace official weather alerts.
- Provide a test action only after opt-in, plus a simple disable/unsubscribe control and quiet-hour preferences where appropriate.

The existing optional generic webhook has a durable 10-minute cooldown but no outbox or delivery confirmation. It is not a completed adapter for any provider above. `ALERT_WEBHOOK_URL` remains unset, and no delivery integration is enabled by this repository.
