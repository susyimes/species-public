import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { AppendCommand, AppendResult, EventId, RoomEvent } from "../types";
import {
  checkConstitution,
  defaultConstitutionInvariants,
  hasBlockingInvariant,
  type ConstitutionInvariant,
} from "./constitution";
import { createSequentialIdFactory, type IdFactory } from "./ids";

export type RoomLedgerOptions = {
  filePath: string;
  now?: () => string;
  idFactory?: IdFactory;
  invariants?: readonly ConstitutionInvariant[];
};

export class RoomLedger {
  private readonly now: () => string;
  private readonly nextId: IdFactory;
  private readonly invariants: readonly ConstitutionInvariant[];
  private writeChain: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: RoomLedgerOptions) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.nextId = options.idFactory ?? createSequentialIdFactory();
    this.invariants = options.invariants ?? defaultConstitutionInvariants;
  }

  append<TPayload>(command: AppendCommand<TPayload>): Promise<AppendResult<TPayload>> {
    const run = this.writeChain.then(() => this.appendUnlocked(command));
    this.writeChain = run.catch(() => undefined);
    return run;
  }

  async readAll(): Promise<RoomEvent[]> {
    return readJsonl(this.options.filePath);
  }

  async readFrom(cursor: number): Promise<RoomEvent[]> {
    const events = await this.readAll();
    return events.slice(cursor);
  }

  async getById<TPayload = unknown>(eventId: EventId): Promise<RoomEvent<TPayload> | null> {
    const events = await this.readAll();
    return (events.find((event) => event.event_id === eventId) as RoomEvent<TPayload> | undefined) ?? null;
  }

  private async appendUnlocked<TPayload>(command: AppendCommand<TPayload>): Promise<AppendResult<TPayload>> {
    const events = await this.readAll();
    const idempotentMatch = events.findIndex(
      (event) => event.room_id === command.roomId && event.idempotency_key === command.idempotencyKey,
    );

    if (idempotentMatch >= 0) {
      const event = events[idempotentMatch];
      if (idempotencyDigestFromEvent(event) !== idempotencyDigestFromCommand(command)) {
        return {
          status: "rejected",
          reason: "idempotency key reused with a different payload hash",
          invariantResults: [
            {
              ok: false,
              invariantId: "ledger.idempotency_payload_hash",
              severity: "error",
              message: "The same idempotency key cannot be reused for a different event payload.",
              eventId: event.event_id,
            },
          ],
        };
      }

      return {
        status: "duplicate",
        event: event as RoomEvent<TPayload>,
        position: idempotentMatch,
      };
    }

    const lastEvent = events.at(-1) ?? null;
    const actualPrevEventId = lastEvent?.event_id ?? null;
    if (command.expectedPrevEventId !== undefined && command.expectedPrevEventId !== actualPrevEventId) {
      return {
        status: "conflict",
        expectedPrevEventId: command.expectedPrevEventId,
        actualPrevEventId,
      };
    }

    const invariantResults = checkConstitution({ command, existingEvents: events }, this.invariants);
    if (hasBlockingInvariant(invariantResults)) {
      return {
        status: "rejected",
        reason: "constitution invariant violation",
        invariantResults,
      };
    }

    const appendedAt = this.now();
    const occurredAt = command.occurredAt ?? appendedAt;
    const eventWithoutHash: Omit<RoomEvent<TPayload>, "event_hash"> = {
      event_id: this.nextId("evt"),
      room_id: command.roomId,
      event_type: command.eventType,
      schema_version: "1.0",
      payload_schema: command.payloadSchema ?? `${command.eventType}.v1`,
      occurred_at: occurredAt,
      appended_at: appendedAt,
      actor: command.actor,
      causation_id: command.causationId ?? null,
      correlation_id: command.correlationId,
      idempotency_key: command.idempotencyKey,
      refs: command.refs ?? [],
      payload: command.payload,
      prev_event_id: lastEvent?.event_id ?? null,
      prev_event_hash: lastEvent?.event_hash ?? null,
    };

    const event: RoomEvent<TPayload> = {
      ...eventWithoutHash,
      event_hash: sha256(canonicalJson(eventWithoutHash)),
    };

    await appendJsonl(this.options.filePath, event);

    return {
      status: "appended",
      event,
      position: events.length,
    };
  }
}

export function verifyHashChain(events: readonly RoomEvent[]): boolean {
  let previous: RoomEvent | null = null;

  for (const event of events) {
    if (event.prev_event_id !== (previous?.event_id ?? null)) {
      return false;
    }
    if (event.prev_event_hash !== (previous?.event_hash ?? null)) {
      return false;
    }
    const { event_hash: _hash, ...withoutHash } = event;
    if (event.event_hash !== sha256(canonicalJson(withoutHash))) {
      return false;
    }
    previous = event;
  }

  return true;
}

function idempotencyDigestFromCommand(command: AppendCommand): string {
  return sha256(
    canonicalJson({
      room_id: command.roomId,
      event_type: command.eventType,
      actor: command.actor,
      payload: command.payload,
      refs: command.refs ?? [],
      causation_id: command.causationId ?? null,
      correlation_id: command.correlationId,
      payload_schema: command.payloadSchema ?? `${command.eventType}.v1`,
    }),
  );
}

function idempotencyDigestFromEvent(event: RoomEvent): string {
  return sha256(
    canonicalJson({
      room_id: event.room_id,
      event_type: event.event_type,
      actor: event.actor,
      payload: event.payload,
      refs: event.refs,
      causation_id: event.causation_id,
      correlation_id: event.correlation_id,
      payload_schema: event.payload_schema,
    }),
  );
}

async function readJsonl(filePath: string): Promise<RoomEvent[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as RoomEvent);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function appendJsonl(filePath: string, event: RoomEvent): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(event)}\n`, { flag: "a", encoding: "utf8" });
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
