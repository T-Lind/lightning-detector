# Contributing

Issues and pull requests are welcome. Include board/sensor revisions, expected behavior, and a minimal reproduction with credentials and personal deployment data removed. For hardware changes, include measured dimensions, tuning frequency and actual current rather than inferring them from nominal specs.

Run from the repository root:

```powershell
npm.cmd ci --prefix cloudflare
npm.cmd test --prefix cloudflare
python tools/check_links.py
python tools/check_fit.py
python tools/check_board_fasteners.py
python -m platformio run -d firmware -e feather -e bench -e tune -e boardcheck -e sensorcheck
```

Builds use inert examples unless you create ignored provisioning headers. Never commit them or compiled images. Copy the Wrangler template before local integration testing; see [cloud setup](docs/cloud-setup.md). Synthetic observations belong in a local test database.

Preserve nullable capture times, overhead/out-of-range meanings, duplicate acknowledgment behavior, visible fault/overdue states and verified TLS. Keep bench/diagnostic images distinct from normal sensing firmware. Changes to partitions, queue serialization or sequence identity need an explicit migration plan for deployed devices.

Firmware/cloud tests do not establish real lightning performance, battery lifetime or weather sealing. Document those limits honestly and preserve third-party attribution. Changes to notifications require an opt-in design and delivery testing.
