# Security policy

Species `v0.1.x` is experimental local research software. Security fixes are
made on the latest `main` branch and may be included in a patch release. Older
snapshots are not supported.

## Report a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use the repository's **Security → Report a vulnerability** flow to submit a
private report. Include:

- the affected commit or release
- the smallest reproducible example
- the expected and observed security boundary
- any known impact or data exposure

Do not include live credentials, private room content, or unrelated personal
data. You should receive an acknowledgement through GitHub within seven days,
but this project does not currently promise a remediation SLA or bounty.

## Security boundaries

The local HTTP API has no built-in authentication and listens on loopback by
default. YOLO spaces can execute arbitrary commands and are not an
operating-system sandbox. Model output must be treated as untrusted input.
Local capability results may become part of provider-bound prompts.

See the safe-defaults section in [README.md](README.md) before enabling remote
binding, private-memory reads, unrestricted filesystem reads, or YOLO spaces.
