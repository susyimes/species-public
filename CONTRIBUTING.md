# Contributing

Species welcomes focused bug reports, design discussion, tests, and small
implementation changes.

## Before opening a change

For substantial behavior or protocol changes, open a discussion or issue first.
Species deliberately distinguishes hard resource and side-effect boundaries
from agent-chosen social order. Changes that silently assign fixed roles, force
speech, make memory unquestionable, or bypass side-effect review conflict with
the project principle.

## Development

Use Node.js 20 or newer:

```bash
npm ci
npm run audit:public
npm test
```

Browser integration tests look for Chrome, Chromium, or Edge. CI requires those
tests to run rather than silently skip.

Keep pull requests narrow, explain any event-schema or boundary change, and add
tests for both the intended path and the denied path. Do not commit:

- provider credentials or real room content
- `.env`, `.species/`, logs, build output, or dependency directories
- private machine paths or internal handoff notes
- third-party logos or artwork without documented redistribution rights

By submitting a contribution, you agree that it is licensed under the Apache
License 2.0.
