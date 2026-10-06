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

- Widget endpoints (`GET /api/pins`, `POST /api/pins`, `PATCH /api/pins/:id`) need no authentication. A project ID gives read and write access to that project's pins.
- The admin dashboard uses a single shared password, and the browser stores it in `localStorage`.
- The app has no built-in rate limiting. Operators should configure Cloudflare rate limiting rules.

Reports showing how to bypass these boundaries are welcome. Examples include reaching admin-only endpoints without the password, or injecting script into the dashboard.
