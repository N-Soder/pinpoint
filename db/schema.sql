-- Pinpoint D1 schema
-- Apply locally:  wrangler d1 execute pinpoint-db --local  --file=db/schema.sql
-- Apply remotely: wrangler d1 execute pinpoint-db --remote --file=db/schema.sql

CREATE TABLE IF NOT EXISTS projects (
  id          TEXT    NOT NULL PRIMARY KEY,  -- client-generated UUID v4
  name        TEXT    NOT NULL,
  site_url    TEXT    NOT NULL,
  created_at  INTEGER NOT NULL               -- Unix ms (Date.now())
);

CREATE TABLE IF NOT EXISTS pins (
  id                  TEXT    NOT NULL PRIMARY KEY,
  project_id          TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_url            TEXT    NOT NULL,
  element_selector    TEXT    NOT NULL,
  element_text        TEXT,
  element_screenshot  TEXT,                        -- base64 JPEG data URL, capped ~200 KB
  comment             TEXT    NOT NULL,
  author              TEXT,
  browser             TEXT,
  viewport            TEXT,
  x_offset            REAL,
  y_offset            REAL,
  resolved            INTEGER NOT NULL DEFAULT 0,  -- SQLite boolean: 0 = false, 1 = true
  created_at          INTEGER NOT NULL             -- Unix ms
);

-- Projects that require a review link (functions/api/_review.js). A row means
-- the project's pins are only available with this token or to an admin; no
-- row means the project ID alone is enough.
CREATE TABLE IF NOT EXISTS review_tokens (
  project_id  TEXT    NOT NULL PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  token       TEXT    NOT NULL,
  created_at  INTEGER NOT NULL               -- Unix ms
);

-- Counters for the built-in rate limiter (functions/api/_ratelimit.js).
-- A key is a limit name plus a keyed hash of what it counts (a client address
-- or a project); no address is stored. Rows are swept after a day.
CREATE TABLE IF NOT EXISTS rate_limits (
  key           TEXT    NOT NULL PRIMARY KEY,
  window_start  INTEGER NOT NULL,             -- Unix ms
  count         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pins_project_id ON pins(project_id);
CREATE INDEX IF NOT EXISTS idx_pins_resolved    ON pins(resolved);
CREATE INDEX IF NOT EXISTS idx_pins_page_url    ON pins(page_url);
