PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS events (
  device_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  detected_at INTEGER,
  received_at INTEGER NOT NULL,
  distance_raw INTEGER,
  energy INTEGER,
  battery_mv INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  PRIMARY KEY (device_id, seq)
);
CREATE INDEX IF NOT EXISTS events_time ON events(device_id, detected_at);
CREATE INDEX IF NOT EXISTS events_received ON events(device_id, received_at);
CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  last_seen INTEGER NOT NULL,
  firmware TEXT NOT NULL,
  rssi INTEGER NOT NULL,
  dropped_total INTEGER NOT NULL,
  rejected_total INTEGER NOT NULL,
  storage_ok INTEGER NOT NULL,
  sensor_ok INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS alert_state (
  device_id TEXT PRIMARY KEY,
  last_notified INTEGER NOT NULL DEFAULT 0
);
