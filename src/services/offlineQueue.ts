import type {
  ExerciseBankData,
  OutboxAction,
  PairingResult,
  Player,
  PreparationItem,
  SessionLogRow,
} from '@/types';

const STORAGE_KEYS = {
  GOOGLE_SNAPSHOT: 'pingcoach_google_snapshot_v2',
  PRESENT_IDS: 'pingcoach_present_ids_v2',
  PAIRINGS: 'pingcoach_pairings_v2',
  OUTBOX: 'pingcoach_outbox_v1',
  LAST_SYNCED: 'pingcoach_last_synced_v2',
  LIVE_STATE: 'pingcoach_live_state_v1',
} as const;

export interface PersistedLiveState {
  currentIndex: number;
  remainingSeconds: number;
  completedIds: string[];
  activeSessionId: string;
}

export interface CachedGoogleSnapshot {
  spreadsheetId: string;
  syncedAt: string;
  players: Player[];
  exerciseBank: ExerciseBankData;
  preparation: PreparationItem[];
  sessions: SessionLogRow[];
}

function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[offlineQueue] Failed writing ${key}:`, err);
  }
}

export function generateSessionId(dateStr?: string): string {
  const cleanDate = (dateStr ?? new Date().toISOString().slice(0, 10)).replace(
    /[^0-9]/g,
    ''
  );
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SESS-${cleanDate}-${randomPart}`;
}

export function generateActionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const localCache = {
  /**
   * Loads the cached real Google Sheets snapshot ONLY if it matches the active spreadsheetId.
   * Never contains demo/seed data.
   */
  loadGoogleSnapshot(spreadsheetId: string): CachedGoogleSnapshot | null {
    const snap = readJson<CachedGoogleSnapshot | null>(
      STORAGE_KEYS.GOOGLE_SNAPSHOT,
      null
    );
    if (!snap || snap.spreadsheetId !== spreadsheetId) {
      return null;
    }
    return snap;
  },

  saveGoogleSnapshot(snapshot: CachedGoogleSnapshot): void {
    writeJson(STORAGE_KEYS.GOOGLE_SNAPSHOT, snapshot);
  },

  clearGoogleSnapshot(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(STORAGE_KEYS.GOOGLE_SNAPSHOT);
    window.localStorage.removeItem(STORAGE_KEYS.LAST_SYNCED);
  },

  loadPresentIds(): string[] {
    return readJson<string[]>(STORAGE_KEYS.PRESENT_IDS, []);
  },
  savePresentIds(ids: string[]): void {
    writeJson(STORAGE_KEYS.PRESENT_IDS, ids);
  },

  loadPairings(): PairingResult | null {
    return readJson<PairingResult | null>(STORAGE_KEYS.PAIRINGS, null);
  },
  savePairings(pairings: PairingResult | null): void {
    writeJson(STORAGE_KEYS.PAIRINGS, pairings);
  },

  loadLastSynced(): string | null {
    return readJson<string | null>(STORAGE_KEYS.LAST_SYNCED, null);
  },
  saveLastSynced(iso: string): void {
    writeJson(STORAGE_KEYS.LAST_SYNCED, iso);
  },

  loadLiveState(): PersistedLiveState | null {
    return readJson<PersistedLiveState | null>(STORAGE_KEYS.LIVE_STATE, null);
  },
  saveLiveState(state: PersistedLiveState | null): void {
    writeJson(STORAGE_KEYS.LIVE_STATE, state);
  },
};

export const outboxQueue = {
  getAll(): OutboxAction[] {
    return readJson<OutboxAction[]>(STORAGE_KEYS.OUTBOX, []);
  },

  enqueue(action: OutboxAction): OutboxAction[] {
    const existing = this.getAll();
    // Idempotency guard for CLOSE_SESSION: never duplicate same ID_Session in outbox
    if (action.type === 'CLOSE_SESSION') {
      const alreadyQueued = existing.some(
        (item) =>
          item.type === 'CLOSE_SESSION' &&
          item.payload.sessionId === action.payload.sessionId
      );
      if (alreadyQueued) return existing;
    }
    // Deduplicate SAVE_PREPARATION by keeping only the latest plan snapshot
    const filtered =
      action.type === 'SAVE_PREPARATION'
        ? existing.filter((item) => item.type !== 'SAVE_PREPARATION')
        : existing;

    const next = [...filtered, action];
    writeJson(STORAGE_KEYS.OUTBOX, next);
    return next;
  },

  remove(actionId: string): OutboxAction[] {
    const next = this.getAll().filter((item) => item.id !== actionId);
    writeJson(STORAGE_KEYS.OUTBOX, next);
    return next;
  },

  markError(actionId: string, errorMessage: string): OutboxAction[] {
    const next = this.getAll().map((item) =>
      item.id === actionId
        ? {
            ...item,
            retryCount: item.retryCount + 1,
            lastError: errorMessage,
          }
        : item
    );
    writeJson(STORAGE_KEYS.OUTBOX, next);
    return next;
  },

  clear(): void {
    writeJson(STORAGE_KEYS.OUTBOX, []);
  },
};
