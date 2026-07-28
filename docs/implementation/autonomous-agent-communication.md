# Autonomous Agent Communication

This note records the implementation boundary for adapting A2A-style agent-agent communication into species.

A2A reference concepts used:

- Agent Card / capability discovery: species keeps capability and persona discovery in the registered agent set and context packet construction, rather than adding a network-facing card endpoint in this pass.
- Message / Part: visible agent speech remains `message.created`; compact refs are carried through `contextRefs` and bounded context packets instead of copying full payloads through hidden chains.
- Task / state: `agent.invited`, `agent.invitation_responded`, `agent.intention_recorded`, `handoff.proposed`, and `handoff.responded` form the social task state in RoomLedger. Handoff is still a proposal, not control transfer.
- Artifact: follow-up work stays reference-based through ledger refs and context packet refs.
- Push notification / subscription: secondary wake is the in-room equivalent. It is public, rate-limited, and recorded as ledger events.

Implemented behavior:

- User messages without mentions still use open-room wake selection.
- User messages with mentions wake only registered mentioned agents.
- `invite_other`, `propose_handoff`, and agent messages that explicitly mention another agent can create bounded secondary wake requests.
- Invited agents keep freedom to speak, stay silent, or respond to the invitation itself with accept, reject, delegate, or challenge via `respond_invitation`.
- Delegated invitation responses create a new room-visible invitation from the delegating agent to the redirected target. This is a fresh social knock, not control transfer, and the target may still speak, stay silent, reject, challenge, or delegate.
- Secondary wake has a per-turn seen set and a two-round limit, and it shares the speaker budget with the original turn.
- Speech deferred by speaker budget becomes a weak recovery signal for later open-room wake. The recovery invitation carries refs to the deferred intention and budget event, so the agent can inspect what was unheard. It helps an unheard agent receive a future knock, but it does not assign them a speaker role or bypass direct mentions.
- Recovery refs are also assembled as bounded `deferred_intention` context fragments. These fragments explain what was unheard and why it was delayed, without turning recovery into a command to speak.
- All invitations, invitation responses, handoffs, responses, and visible messages are written to RoomLedger; runtime message projection exposes agent-agent social events as `Room Ledger` system messages for the frontend.
