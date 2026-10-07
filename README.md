# Pinpoint — visual website feedback

Pinpoint lets reviewers leave pinned, in-context comments directly on any page of a website. Reviewers click an element, type a comment, and Pinpoint stores the comment with the element's CSS selector, an optional screenshot and some browser metadata. Site owners triage everything from a small admin dashboard.

## How it works

1. **Create a project** in the admin dashboard (`/admin`) with a name and site URL.
2. **Embed the widget**: paste the generated `<script>` tag into your site.
3. **Activate review mode**: append `?review=1` to any page URL.
4. **Leave feedback**: click **💬 Feedback**, then click any element to pin a comment.
5. **Review and resolve** pins in the dashboard, grouped by page and filterable by status.

## Tech stack

| Part | Technology |
|------|------------|
| Admin UI | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| API | [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/) (`functions/api/`) |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite), schema in `db/schema.sql` |
| Widget | `public/widget.js`: vanilla JS, no build step. Screenshots use [html2canvas](https://html2canvas.hertzen.com/), loaded from cdnjs with Subresource Integrity |

## Requirements

- Node.js 22.12 or later (see `.nvmrc`) and npm
- A Cloudflare account, for deployment only. Local development runs fully offline through Wrangler.

## Local development

```bash
npm ci
cp .dev.vars.example .dev.vars    # then set ADMIN_PASSWORD
npm run db:migrate:local          # create tables in the local D1 database
npm run build
npm run dev:cf                    # full stack (UI + API + D1) at http://localhost:8787
```

For frontend-only work with hot reload, run `npm run dev` (port 8080) alongside a Wrangler dev server on port 8787. Vite proxies `/api` to it.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server (UI only, proxies `/api` to `localhost:8787`) |
| `npm run dev:cf` | Serve `dist/` with Pages Functions and local D1 via Wrangler |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Build, then serve with Wrangler |
| `npm run deploy` | Build, then upload to the Pages project named in `wrangler.toml` |
| `npm run lint` | ESLint (app, Functions and widget) |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Vitest tests: API (`tests/api/`, against in-memory SQLite), widget (`tests/widget/`, in jsdom) and dashboard client (`src/`) |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply `db/schema.sql` to the local or production D1 database |

## Deployment (Cloudflare Pages)

1. Create a D1 database with `npx wrangler d1 create pinpoint-db` and put its ID in `wrangler.toml`.
2. Apply the schema with `npm run db:migrate:remote`.
3. Create a Pages project and set `name` in `wrangler.toml` to its name. Either connect it to your repository (build command `npm run build`, output directory `dist`) so pushes deploy, or deploy from your machine with `npm run deploy`.
4. Set the secrets:
   - `npx wrangler pages secret put ADMIN_PASSWORD` (required; use a long random value)
   - `npx wrangler pages secret put SESSION_SECRET` (recommended; generate one with `openssl rand -base64 48`)
   - `npx wrangler pages secret put NTFY_TOPIC` (optional; sends [ntfy.sh](https://ntfy.sh) push notifications for new pins)
   - `npx wrangler pages secret put CONTACT_EMAIL` (optional; shows a contact address on the landing page)
5. Optional: add a Cloudflare [rate limiting rule](https://developers.cloudflare.com/waf/rate-limiting-rules/) in front as well. The app limits sign-in attempts and new pins itself (see [Security model](#security-model)); a Cloudflare rule turns excess requests away before they reach it, but only on hostnames in your own zone, not on the project's `pages.dev` address.

When you update an existing deployment, run `npm run db:migrate:remote` before `npm run deploy`. The schema only ever adds to what is there, so it is safe to re-run.

## Configuration

| Name | Where | Required | Description |
|------|-------|----------|-------------|
| `ADMIN_PASSWORD` | Pages secret / `.dev.vars` | yes | Shared password for the admin dashboard. If it is unset, all admin requests are denied. |
| `SESSION_SECRET` | Pages secret / `.dev.vars` | recommended | Random value of at least 32 characters used to sign admin sessions. Setting or changing it signs everyone out. If it is set but shorter than 32 characters, sign-in is refused. |
| `NTFY_TOPIC` | Pages secret / `.dev.vars` | no | ntfy.sh topic name. Anyone who knows a topic name can read it, so use a long random name. |
| `CONTACT_EMAIL` | Pages secret / `.dev.vars` | no | Address shown on the landing page for people who want to try your instance. The section is hidden when unset. |
| `DB` | `wrangler.toml` | yes | D1 binding |

## Widget

```html
<script src="https://your-pinpoint-host/widget.js?project=PROJECT_ID"></script>
```

The widget does nothing unless the page URL has a `review=` parameter and the script `src` contains `project=`. In review mode, existing pins for the page appear as numbered markers (red for open, grey for resolved). Clicking a marker shows the comment and lets the reviewer resolve it.

## Security model

Read this before you deploy:

- **The admin dashboard** uses a single shared password, checked server-side against `ADMIN_PASSWORD`. Signing in sets a signed session cookie that lasts 7 days. The cookie is `HttpOnly`, so page scripts cannot read it, and the password itself is never stored in the browser. Sessions are stateless: signing out clears the cookie, and changing `ADMIN_PASSWORD` or `SESSION_SECRET` ends every session. Set `SESSION_SECRET`: without it the session key is derived from the password alone, so anyone who obtains a session cookie can test password guesses against it offline. Either way, use a unique, long random password.
- **Widget endpoints are anonymous by design.** Anyone who knows a project ID can list that project's pins (comments, author names and screenshots), add pins, and mark pins resolved or open. The project ID is in the embed snippet, so **anyone who can see your site's HTML can read its feedback.** Only embed the widget where that is acceptable, for example on staging sites, or add the snippet only for reviewers. Each pin stores the page URL including its query string and `#fragment`. Parameters that look like credentials (names such as `token`, `code`, `key` or `signature`, and values shaped like a signed token) are removed, along with `review=`, by the widget before sending and again by the API. This goes by name, so it cannot catch a token in the path or under an unusual name: avoid leaving feedback on pages such as password-reset or magic links.
- **Rate limits are built in**, counted in the database so they apply on every hostname:
  - sign-in: 10 attempts per client per 15 minutes, and 100 in total. While the total is reached nobody can sign in, though existing sessions keep working; that is the price of a limit that guessing from many addresses cannot get around.
  - new pins: 60 per client per 10 minutes, and 300 per project per hour.
  - resolve and reopen: 120 per client per 10 minutes.

  A client is an IPv4 address or an IPv6 /64. Counters store a keyed hash, not the address, and are deleted after a day. The numbers are constants in `functions/api/_ratelimit.js`. If the `rate_limits` table is missing, limits are not enforced and an error is logged on each request.
- Listing projects, creating projects and deleting anything require an admin session. Admin requests that name a different origin are refused.

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Database schema

See [`db/schema.sql`](db/schema.sql). `projects` holds the ID, name, site URL and creation time. `pins` holds each comment, its CSS selector, element text, screenshot, author, browser, viewport, click offsets, resolved flag and creation time. Pins are deleted along with their project. `rate_limits` holds the short-lived counters behind the built-in rate limits.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). If you run a modified version of Pinpoint as a network service, you must offer its source code to the service's users. Third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
