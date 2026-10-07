# Contributing

Thanks for your interest in improving Pinpoint!

## Getting set up

Follow **Local development** in the [README](README.md). In short: run `npm ci`, copy `.dev.vars.example` to `.dev.vars`, then run `npm run db:migrate:local`, `npm run build` and `npm run dev:cf`.

## Before opening a pull request

Run the same checks as CI:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Guidelines:

- Keep changes focused. Open an issue first for larger features or architectural changes.
- Add or update tests in `tests/api/` when you change API behaviour. Never put test files under `functions/`: Cloudflare Pages turns every file there into a route.
- `public/widget.js` runs on third-party sites. Keep it dependency-free, ES5-compatible and ASCII-only (use `\u` escapes), and never write untrusted data with `innerHTML`. Add or update tests in `tests/widget/` when you change it.
- Never commit secrets. `.dev.vars` and `.env*` are git-ignored; production secrets belong in Cloudflare Pages secrets.
- Schema changes go in `db/schema.sql` and must stay safe to re-run (`IF NOT EXISTS`).

## Licence

By contributing, you agree to license your contribution under the project's [AGPL-3.0](LICENSE) licence.

## Security issues

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Do not open a public issue.
