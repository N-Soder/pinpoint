# Agent notes

Pinpoint is a website-feedback tool: a React dashboard (`src/`), Cloudflare Pages Functions API (`functions/api/`), a Cloudflare D1 database (`db/schema.sql`), and an embeddable vanilla-JS widget (`public/widget.js`). See `README.md` for setup.

- Supabase and Lovable have been fully removed. Do not reintroduce them.
- Never put test files under `functions/` — Cloudflare Pages turns every file there into a route. API tests live in `tests/api/`.
- Local secrets go in `.dev.vars` (gitignored), never in `wrangler.toml` or `.env`.

## Session wrap-up
- At session start: read `HANDOFF.md` if it exists, before anything else.
- Handoff: `HANDOFF.md` (overwrite; git keeps history)
- Tasks: `TODO.md`
- Validation: `npm test && npm run lint && npm run typecheck && npm run build`
- Branch: never commit wrap-ups on the default branch; use `wip/<topic>`
