import type { AppendCommand, EventActor, EventId, RefId, RoomEvent, RoomId } from "../types";

export type RoomLedgerAppenderCommand<TPayload> = {
  roomId: RoomId;
  eventType: string;
  actor: EventActor;
  payload: TPayload;
  refs?: RefId[];
  causationId?: EventId;
  correlationId?: string;
  idempotencyKey?: string;
  occurredAt?: string;
  payloadSchema?: string;
};

export type RoomLedgerAppendTarget = {
  append<TPayload>(command: AppendCommand<TPayload>): Promise<
    | { status: "appended"; event: RoomEvent<TPayload>; position: number }
    | { status: "duplicate"; event: RoomEvent<TPayload>; position: number }
    | { status: "rejected"; reason: string }
    | { status: "conflict"; expectedPrevEventId?: EventId; actualPrevEventId: EventId | null }
  >;
};

export class RoomLedgerEventAppender {
  public constructor(private readonly ledger: RoomLedgerAppendTarget) {}

  public async append<TPayload>(command: RoomLedgerAppenderCommand<TPayload>): Promise<RoomEvent<TPayload>> {
    const result = await this.ledger.append({
      roomId: command.roomId,
      eventType: command.eventType,
      actor: command.actor,
      payload: command.payload,
      refs: command.refs,
      causationId: command.causationId,
      correlationId: command.correlationId ?? `corr:${command.eventType}`,
      idempotencyKey:
        command.idempotencyKey ??
        `${command.eventType}:${command.actor.kind}:${command.actor.id}:${command.occurredAt ?? "runtime"}`,
      occurredAt: command.occurredAt,
      payloadSchema: command.payloadSchema,
    });

    if (result.status === "appended" || result.status === "duplicate") {
      return result.event;
    }

    if (result.status === "conflict") {
      throw new Error(
        `RoomLedger append conflict for ${command.eventType}: expected ${
          result.expectedPrevEventId ?? "any"
        }, actual ${result.actualPrevEventId ?? "none"}`,
      );
    }

    throw new Error(`RoomLedger rejected ${command.eventType}: ${result.reason}`);
  }
}
