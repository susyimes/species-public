# Chief Architect Review

Date: 2026-06-17

Status: accepted with contract corrections.

This review covers the implementation detail documents created from the roadmap:

- `kernel-ledger-loop.md`
- `context-memory-archive.md`
- `social-persona-action.md`
- `evaluation-failure-drills.md`

## Direction Check

The implementation plan still follows the central thesis:

> The system maintains boundaries; agents generate order.

No reviewed document makes the system responsible for deciding agent agreement,
mandatory speech, immutable memory, or hidden task ownership. Coordination is
modeled through invitations, intentions, proposals, responses, derived
projections, and approval records.

## Accepted Technical Shape

The build should proceed with these architectural commitments:

- Room Ledger is the source of record.
- Derived stores are replayable projections, not second sources of truth.
- Wake policy selects candidate agents, not guaranteed speakers.
- Silence, refusal, contestation, and protocol invention are valid outcomes.
- Public memory uses claim states and remains contestable.
- Daily archive preserves disagreement and open questions.
- Handoff is a social proposal, not a function call.
- Protocols are scoped and expirable room etiquette.
- Persona changes are ledgered deltas with reasons and evidence refs.
- Capability and reputation are advisory routing signals, not authority.
- Workspace and skill execution cannot bypass side-effect approval.
- Evaluation protects living-room qualities before task throughput.

## Corrections Applied

During review, three contract mismatches were corrected:

- The shared event envelope now consistently uses `event_type` instead of mixing
  `event_type` and `type`.
- `propose_memory` is now an explicit agent intention so agents, not only
  extractors or archive workers, can propose public memory.
- Basic handoff response intentions were added to the Phase 0-2 loop contract so
  later handoff flows have a stable ledger path.

## Open Design Risks

These are not blockers, but they should be watched during implementation:

- JSONL ledger is excellent for the first local kernel, but concurrency and
  locking must be tested before multiple agent workers append at high volume.
- Topic detection should remain deterministic at first; model-assisted topic
  detection can be introduced later only if its decisions stay ledger-visible.
- Archive text checks should start structural and source-linked. Model grading
  can help later, but should not replace ledger assertions.
- Capability reputation can easily become social authority. Tests must keep it
  advisory.
- Side-effect approvals need narrow scope and expiry from the beginning, even
  before rich workspace execution exists.

## First Implementation Slice

The recommended first coding slice is:

1. Create shared IDs, refs, event envelope, and JSONL append API.
2. Add constitution loading, lock generation, and invariant checks.
3. Add replayable RoomView and TopicView projections.
4. Implement message intake, deterministic topic detection, wake candidates,
   agent invitation, and intention recording.
5. Add fixture agents that can return `speak`, `stay_silent`,
   `propose_memory`, `contest_memory`, `propose_handoff`, and
   `propose_protocol`.
6. Add the fast social invariant tests from `evaluation-failure-drills.md`.

Do not start with external tool execution. The first milestone should prove that
the room can talk, remember provisionally, refuse coordination, and replay its
own history without a hidden scheduler.

## Final Verdict

The four implementation documents are aligned enough to serve as the technical
roadmap for the first build. The highest-priority guardrail is to keep all
coordination visible in the ledger and to treat every agent action as an
intention inside a bounded public room, not as a command issued by a central
orchestrator.

## Implementation Review

Status: implemented for the first runnable kernel.

Reviewed implementation files:

- `src/kernel/`
- `src/room/`
- `src/context/`
- `src/memory/`
- `src/archive/`
- `src/social/`
- `src/persona/`
- `src/actions/`
- `src/evaluation/`

Final integration corrections:

- Kept `event_type` as the event envelope field across modules.
- Standardized side-effect lifecycle events as `side_effect.requested`,
  `side_effect.approved`, `side_effect.denied`, and
  `side_effect.result_reported`.
- Added handoff response intentions for partial accept, delegation, and
  challenge so the room loop can ledger social responses without making them
  function calls.
- Preserved the late kernel implementation because it provided a serialized
  JSONL write path and hash-chain verification, then aligned tests and exports
  to that implementation.

Verification:

```powershell
npm test
```

Result: 27 tests passed.

The implementation is intentionally still a first kernel, not a full product.
It proves the documented shape: ledger-first state, bounded room turns,
contestable memory, rejectable handoff, scoped protocol, persona deltas,
advisory capability routing, side-effect approval, and anti-regression tests for
living-room behavior.
