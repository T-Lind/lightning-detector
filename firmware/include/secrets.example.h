#pragma once
// Copy to secrets.h; never commit that file.
#define WIFI_SSID "CHANGE_ME"
#define WIFI_PASSWORD "CHANGE_ME"
#define API_BASE_URL "https://YOUR-WORKER.workers.dev"
#define DEVICE_ID "yard-1"
// Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// This hex-looking string is used as literal UTF-8 text on BOTH sides.
#define DEVICE_SECRET "CHANGE_ME_TO_64_RANDOM_HEX_CHARACTERS"
