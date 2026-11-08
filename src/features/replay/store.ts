"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import {
  createReplayRecord,
  replayRecordSchema,
  seedReplayRecords,
  type ReplayRecord,
} from "./dataset";
import type { ConfirmedTerms } from "../claims/contracts";

const STORAGE_KEY = "provenalpha:synthetic-replays:v1";
// Read the former namespace once so a platform rename does not discard existing tab replays.
const LEGACY_STORAGE_KEY = "marktothesis:synthetic-replays:v1";
const storageSchema = z
  .object({ version: z.literal(1), records: z.array(replayRecordSchema).max(100) })
  .superRefine((state, context) => {
    const ids = state.records.map((record) => record.claim.claimId);
    if (new Set(ids).size !== ids.length)
      context.addIssue({
        code: "custom",
        path: ["records"],
        message: "Replay IDs must be unique.",
      });
  });
type ReplayState = { records: ReplayRecord[]; notice: string | null };
let snapshot: ReplayState | null = null;
const listeners = new Set<() => void>();

function clientSnapshot() {
  if (snapshot) return snapshot;
  let notice: string | null = null;
  let records = seedReplayRecords();
  try {
    const currentSaved = window.sessionStorage.getItem(STORAGE_KEY);
    const saved = currentSaved ?? window.sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const result = storageSchema.safeParse(JSON.parse(saved));
      if (result.success) {
        // The preloaded full history always remains, including misses and unclear outcomes.
        records = [
          ...result.data.records.filter((record) => record.origin === "browser"),
          ...seedReplayRecords(),
        ];
        if (currentSaved === null) {
          try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records }));
          } catch {
            notice =
              "Existing replays were restored, but tab storage could not be updated. This preview remains in memory.";
          }
        }
      } else
        notice = "Saved preview data could not be read. The synthetic examples have been restored.";
    }
  } catch {
    notice = "Tab storage is unavailable. Replays will remain in memory until this page reloads.";
  }
  snapshot = { records, notice };
  return snapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const serverSnapshot = () => null;

export function useReplayStore() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}

function save(records: ReplayRecord[]) {
  const state = storageSchema.parse({ version: 1, records });
  let notice: string | null = null;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    notice =
      "Tab storage is unavailable. This replay is held in memory and will be lost on reload.";
  }
  snapshot = { records: state.records, notice };
  listeners.forEach((listener) => listener());
}

export function confirmReplay(terms: ConfirmedTerms, originalText: string) {
  const current = clientSnapshot();
  if (current.records.length >= 100)
    throw new Error(
      "This preview supports up to 93 new replays per tab. Existing records remain visible.",
    );
  const record = createReplayRecord(
    terms,
    originalText,
    `replay-${crypto.randomUUID()}`,
    new Date().toISOString(),
  );
  save([record, ...current.records]);
  return record.claim.claimId;
}

export function runReplay(id: string) {
  const current = clientSnapshot();
  const record = current.records.find((item) => item.claim.claimId === id);
  if (!record) throw new Error("This replay is not available in this tab.");
  if (record.resolvedAt) return;
  const updated = replayRecordSchema.parse({ ...record, resolvedAt: new Date().toISOString() });
  save(current.records.map((item) => (item.claim.claimId === id ? updated : item)));
}
