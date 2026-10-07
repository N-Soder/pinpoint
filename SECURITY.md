# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report them privately through GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository (**Security → Report a vulnerability**).

Please include:

- a description of the issue and its impact
- steps to reproduce, or a proof of concept
- the affected version or commit

We aim to acknowledge reports within a week. This is a small volunteer project, so fix timelines depend on severity and maintainer availability.

## Scope and known design limitations

The following are intentional trade-offs, documented in the README. They are not vulnerabilities in themselves:

- Widget endpoints (`GET /api/pins`, `POST /api/pins`, `PATCH /api/pins/:id`) need no authentication by default. A project ID gives read and write access to that project's pins, apart from screenshots, which need an admin session. A project can instead require a review link, whose token then gives that access; the token travels in the page URL.
- The admin dashboard uses a single shared password. Sessions are stateless signed cookies, so one cannot be revoked on its own before it expires; changing the password or `SESSION_SECRET` ends them all. Without `SESSION_SECRET` the signing key is derived from the password alone.
- Rate limits are fixed windows per client address (IPv4 address or IPv6 /64), per project and overall. They slow abuse down; they do not stop someone with many addresses from adding pins up to the per-project limit, or from using up the overall sign-in allowance so that nobody can sign in for a while.

Reports showing how to bypass these boundaries are welcome. Examples include reaching admin-only endpoints without a valid session, or injecting script into the dashboard.
