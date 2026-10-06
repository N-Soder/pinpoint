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
| Admin UI | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
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
| `npm run lint` | ESLint (app, Functions and widget) |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Vitest tests: API (`tests/api/`, against in-memory SQLite) and dashboard client (`src/`) |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply `db/schema.sql` to the local or production D1 database |

## Deployment (Cloudflare Pages)

1. Create a D1 database with `npx wrangler d1 create pinpoint-db` and put its ID in `wrangler.toml`.
2. Apply the schema with `npm run db:migrate:remote`.
3. Create a Pages project connected to your repository. Use the build command `npm run build` and the output directory `dist`.
4. Set the secrets:
   - `npx wrangler pages secret put ADMIN_PASSWORD` (required; use a long random value)
   - `npx wrangler pages secret put NTFY_TOPIC` (optional; sends [ntfy.sh](https://ntfy.sh) push notifications for new pins)
5. **Strongly recommended:** add a Cloudflare [rate limiting rule](https://developers.cloudflare.com/waf/rate-limiting-rules/) for `POST /api/auth/verify` and `POST /api/pins`. The app has no built-in rate limiting.

## Configuration

| Name | Where | Required | Description |
|------|-------|----------|-------------|
| `ADMIN_PASSWORD` | Pages secret / `.dev.vars` | yes | Shared password for the admin dashboard. If it is unset, all admin requests are denied. |
| `NTFY_TOPIC` | Pages secret / `.dev.vars` | no | ntfy.sh topic name. Anyone who knows a topic name can read it, so use a long random name. |
| `DB` | `wrangler.toml` | yes | D1 binding |

## Widget

```html
<script src="https://your-pinpoint-host/widget.js?project=PROJECT_ID"></script>
```

The widget does nothing unless the page URL contains `review=` and the script `src` contains `project=`. In review mode, existing pins for the page appear as numbered markers (red for open, grey for resolved). Clicking a marker shows the comment and lets the reviewer resolve it.

## Security model

Read this before you deploy:

- **The admin dashboard** uses a single shared password, checked server-side against `ADMIN_PASSWORD`. The browser keeps the password in `localStorage` and sends it as a bearer token. Use a unique, long random password.
- **Widget endpoints are anonymous by design.** Anyone who knows a project ID can list that project's pins (comments, author names and screenshots), add pins, and mark pins resolved or open. The project ID is in the embed snippet, so **anyone who can see your site's HTML can read its feedback.** Only embed the widget where that is acceptable, for example on staging sites, or add the snippet only for reviewers. Each pin stores the page URL including its query string and `#fragment` (only `review=` is removed). Don't leave feedback on pages whose URL contains tokens, such as password-reset or magic links.
- Listing projects, creating projects and deleting anything require the admin password.

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Database schema

See [`db/schema.sql`](db/schema.sql). The schema has two tables. `projects` holds the ID, name, site URL and creation time. `pins` holds each comment, its CSS selector, element text, screenshot, author, browser, viewport, click offsets, resolved flag and creation time. Pins are deleted along with their project.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only). If you run a modified version of Pinpoint as a network service, you must offer its source code to the service's users. Third-party components are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
