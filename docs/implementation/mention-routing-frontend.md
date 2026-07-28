# Mention Routing And Frontend

The `@` feature is an explicit invitation signal, not a command. It helps the
room decide who should wake while preserving the agent's freedom to speak, stay
silent, redirect, or reject a handoff later.

## Contract

```text
composer selection
  -> inserts @agent_id into visible text
  -> sends mentions: AgentId[] in the POST body
  -> runtime validates mentions against registered seed agents
  -> LivingRoomLoop records mentions on message.created
  -> wake policy boosts mentioned agents
  -> each invited agent still returns its own intention
```

Textual mentions remain valid because the loop also scans message content for
`@agent_id`. The structured `mentions` array exists for auditability and for UI
flows that should not rely on brittle prompt parsing.

## Frontend Shape

- The composer owns the mention picker, not the settings panel.
- Clicking the `@` tool opens a compact agent picker above the composer.
- Typing `@` opens the same picker and filters by id, name, or initial posture.
- Choosing an agent inserts `@agent_id ` at the cursor and shows a small chip.
- Sent messages display mention chips in the message metadata.

The picker only lists room agents already exposed by `/api/room/state`; provider
secrets, local paths, and raw runtime diagnostics stay in settings or server
state.

## Runtime Rules

- Unknown mention ids are dropped before entering the loop.
- Duplicate mentions are collapsed.
- Mentions are stored on `message.created.payload.mentions`.
- `wake.candidates_selected.payload.candidates[].reasons` includes `mentioned`
  when the mention influenced routing.
- Mentioned agents are invited within the active wake budget; they are never
  forced to produce a visible message.

## Tests

The implementation is covered at three levels:

- `room-loop.test.ts` proves explicit mention payloads outrank unmentioned
  agents under a one-agent wake budget.
- `server-runtime.test.ts` proves HTTP/runtime mentions are projected back to
  the UI and recorded in ledger events.
- `frontend-chat.test.ts` guards the composer picker, structured payload, and
  message mention rendering.
