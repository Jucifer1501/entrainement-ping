'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AppTab,
  AuthMode,
  DataSource,
  Exercise,
  ExerciseBankData,
  ExerciseInput,
  OddMode,
  OutboxAction,
  PairingMode,
  PairingResult,
  Player,
  PlayerInput,
  PreparationItem,
  SessionClosurePayload,
  SessionLogRow,
  SyncStatus,
  ViewerUser,
} from '@/types';
import {
  EMPTY_EXERCISE_BANK,
  addExerciseToSheet,
  addPlayerToSheet,
  closeSessionAtomic,
  computeNextCode,
  fetchAllSheetData,
  savePreparationToSheet,
  updateExerciseInSheet,
  updatePlayerInSheet,
  type FullSheetSnapshot,
} from '@/services/sheetsConnector';
import {
  DEFAULT_SPREADSHEET_ID,
  getConfiguredSpreadsheetId,
  googleAuth,
} from '@/services/googleAuth';
import {
  generateActionId,
  generateSessionId,
  localCache,
  outboxQueue,
} from '@/services/offlineQueue';
import {
  DEFAULT_LEVEL_THRESHOLD,
  applyLevelThresholdToPairings,
  generatePairings,
  hasSpecialRubber,
  swapPlayersInPairings,
  toggleTableGroupLevel,
} from '@/services/pairings';

export interface ToastMessage {
  id: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  text: string;
}

interface AppContextValue {
  // Navigation
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;

  // Domain Data
  players: Player[];
  exerciseBank: ExerciseBankData;
  preparation: PreparationItem[];
  sessions: SessionLogRow[];

  // Attendance & Pairings
  presentPlayerIds: string[];
  presentPlayers: Player[];
  presentSpecialPlayers: Player[];
  picotActive: boolean;
  togglePlayerPresence: (playerId: string) => void;
  setAllActivePresent: (selectAll: boolean) => void;
  pairingMode: PairingMode;
  setPairingMode: (mode: PairingMode) => void;
  oddMode: OddMode;
  setOddMode: (mode: OddMode) => void;
  levelThreshold: number;
  setLevelThreshold: (threshold: number) => void;
  pairings: PairingResult;
  regeneratePairings: () => void;
  swapPairingsPlayers: (playerIdA: string, playerIdB: string) => void;
  toggleTableGroup: (tableNumber: number) => void;

  // Preparation & Live
  setPreparation: React.Dispatch<React.SetStateAction<PreparationItem[]>>;
  activeSessionId: string;
  resetActiveSessionId: () => void;
  liveCompletedLocalIds: string[];
  markLiveExerciseCompleted: (localId: string, completed?: boolean) => void;
  launchLiveSession: () => void;

  // Auth, Role & Sync
  syncStatus: SyncStatus;
  outbox: OutboxAction[];
  authMode: AuthMode;
  viewerUser: ViewerUser | null;
  isReadOnly: boolean;
  isSignedIn: boolean;
  signInGoogle: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOutGoogle: () => void;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  addPlayer: (input: PlayerInput) => Promise<void>;
  updatePlayer: (player: Player) => Promise<void>;
  addExercise: (input: ExerciseInput) => Promise<void>;
  updateExercise: (exercise: Exercise) => Promise<void>;
  savePreparation: (items: PreparationItem[]) => Promise<void>;
  archiveSession: (payload: SessionClosurePayload) => Promise<{
    queued: boolean;
    alreadyArchived?: boolean;
  }>;

  // Toasts
  toasts: ToastMessage[];
  pushToast: (tone: ToastMessage['tone'], text: string) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY_PAIRINGS: PairingResult = {
  tables: [],
  basketPlayer: null,
  mode: 'HOMOGENE',
  oddMode: 'GROUPE_3',
  levelThreshold: DEFAULT_LEVEL_THRESHOLD,
};

const LEGACY_DEMO_KEYS = [
  'pingcoach_players_v1',
  'pingcoach_exercise_bank_v1',
  'pingcoach_preparation_v1',
  'pingcoach_sessions_v1',
  'pingcoach_present_ids_v1',
  'pingcoach_pairings_v1',
  'pingcoach_last_synced_v1',
];

const INITIAL_ENV_SPREADSHEET_ID =
  process.env.NEXT_PUBLIC_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<AppTab>('effectif');

  // Strict SSR-safe initial state: 100% deterministic, zero fictive/demo players
  const [players, setPlayers] = useState<Player[]>([]);
  const [exerciseBank, setExerciseBank] =
    useState<ExerciseBankData>(EMPTY_EXERCISE_BANK);
  const [preparation, setPreparation] = useState<PreparationItem[]>([]);
  const [sessions, setSessions] = useState<SessionLogRow[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('empty');

  // Attendance & Pairings
  const [presentPlayerIds, setPresentPlayerIds] = useState<string[]>([]);
  const [pairingMode, setPairingMode] = useState<PairingMode>('HOMOGENE');
  const [oddMode, setOddMode] = useState<OddMode>('GROUPE_3');
  const [levelThreshold, setLevelThresholdState] = useState<number>(
    DEFAULT_LEVEL_THRESHOLD
  );
  const [pairings, setPairings] = useState<PairingResult>(EMPTY_PAIRINGS);

  // Live & Closure tracking
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [liveCompletedLocalIds, setLiveCompletedLocalIds] = useState<string[]>(
    []
  );

  // Sync & Auth
  const [authMode, setAuthMode] = useState<AuthMode>('none');
  const [viewerUser, setViewerUser] = useState<ViewerUser | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<OutboxAction[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string>(
    INITIAL_ENV_SPREADSHEET_ID
  );

  const syncingRef = useRef(false);
  const dataSourceRef = useRef<DataSource>('empty');
  const authModeRef = useRef<AuthMode>('none');

  const isSignedIn = authMode === 'google' || authMode === 'viewer';
  const isReadOnly = authMode === 'viewer';

  useEffect(() => {
    dataSourceRef.current = dataSource;
  }, [dataSource]);

  useEffect(() => {
    authModeRef.current = authMode;
  }, [authMode]);

  const pushToast = useCallback((tone: ToastMessage['tone'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, tone, text }]);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applyFetchedSnapshot = useCallback(
    (activeSheetId: string, snapshot: FullSheetSnapshot) => {
      const nowIso = new Date().toISOString();
      setSpreadsheetId(activeSheetId);
      setPlayers(snapshot.players);
      setExerciseBank(snapshot.exerciseBank);
      setPreparation(snapshot.preparation);
      setSessions(snapshot.sessions);
      setDataSource('google');
      setLastSyncedAt(nowIso);

      setPresentPlayerIds((prev) => {
        const validIds = new Set(snapshot.players.map((p) => p.id));
        return prev.filter((id) => validIds.has(id));
      });

      localCache.saveGoogleSnapshot({
        spreadsheetId: activeSheetId,
        syncedAt: nowIso,
        players: snapshot.players,
        exerciseBank: snapshot.exerciseBank,
        preparation: snapshot.preparation,
        sessions: snapshot.sessions,
      });
      localCache.saveLastSynced(nowIso);
    },
    []
  );

  // Pull read-only snapshot from server Service Account API (/api/sheets/read)
  const pullReadOnlySnapshot = useCallback(
    async (silent = false) => {
      if (syncingRef.current) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!silent) {
          pushToast('warning', 'Hors ligne — affichage du dernier cache local.');
        }
        return;
      }

      syncingRef.current = true;
      setIsSyncing(true);
      setSyncError(null);
      if (dataSourceRef.current !== 'google') {
        setDataSource('loading');
      }

      try {
        const res = await fetch('/api/sheets/read', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });

        const payload = (await res.json().catch(() => null)) as {
          spreadsheetId?: string;
          snapshot?: FullSheetSnapshot;
          error?: string;
        } | null;

        if (res.status === 401) {
          setAuthMode('none');
          setViewerUser(null);
          throw new Error(
            payload?.error || 'Session lecteur expirée. Veuillez vous reconnecter.'
          );
        }

        if (!res.ok || !payload?.snapshot) {
          throw new Error(
            payload?.error ||
              `Impossible de lire Google Sheets (${res.status}).`
          );
        }

        applyFetchedSnapshot(
          payload.spreadsheetId || getConfiguredSpreadsheetId(),
          payload.snapshot
        );

        if (!silent) {
          pushToast(
            'success',
            `Données chargées (lecture seule) : ${payload.snapshot.players.length} joueurs, ${payload.snapshot.exerciseBank.exercises.length} exercices.`
          );
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur lors de la lecture Google Sheets.';
        setSyncError(message);
        if (dataSourceRef.current === 'loading') {
          setDataSource('empty');
        }
        if (!silent) {
          pushToast('error', message);
        }
      } finally {
        syncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [applyFetchedSnapshot, pushToast]
  );

  // Flush outbox + pull fresh canonical snapshot from Google Sheets (Admin OAuth)
  const flushOutboxAndPull = useCallback(
    async (silent = false) => {
      if (syncingRef.current) return;
      if (!googleAuth.isSignedIn()) return;

      const activeSheetId = getConfiguredSpreadsheetId();
      setSpreadsheetId(activeSheetId);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!silent) {
          pushToast('warning', 'Hors ligne — synchronisation mise en attente.');
        }
        return;
      }

      syncingRef.current = true;
      setIsSyncing(true);
      setSyncError(null);
      if (dataSourceRef.current !== 'google') {
        setDataSource('loading');
      }

      try {
        // 1. Drain outbox FIFO before fetching fresh state
        const pending = outboxQueue.getAll();
        for (const action of pending) {
          try {
            switch (action.type) {
              case 'ADD_PLAYER':
                await addPlayerToSheet(action.payload.input);
                break;
              case 'UPDATE_PLAYER':
                await updatePlayerInSheet(action.payload);
                break;
              case 'ADD_EXERCISE':
                await addExerciseToSheet(action.payload.input);
                break;
              case 'UPDATE_EXERCISE':
                await updateExerciseInSheet(action.payload);
                break;
              case 'SAVE_PREPARATION':
                await savePreparationToSheet(action.payload);
                break;
              case 'CLOSE_SESSION':
                await closeSessionAtomic(action.payload);
                break;
            }
            setOutbox(outboxQueue.remove(action.id));
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : 'Erreur de synchronisation';
            setOutbox(outboxQueue.markError(action.id, msg));
            throw err;
          }
        }

        // 2. Pull fresh canonical state from ALL 4 real tabs
        const snapshot = await fetchAllSheetData();
        applyFetchedSnapshot(activeSheetId, snapshot);

        if (!silent) {
          pushToast(
            'success',
            `Google Sheets chargé : ${snapshot.players.length} joueurs, ${snapshot.exerciseBank.exercises.length} exercices, ${snapshot.sessions.length} lignes de séances.`
          );
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erreur Google Sheets.';
        setSyncError(message);
        if (dataSourceRef.current === 'loading') {
          setDataSource('empty');
        }
        if (!silent) {
          pushToast('error', message);
        }
      } finally {
        syncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [applyFetchedSnapshot, pushToast]
  );

  // Hydrate once on client mount (strictly AFTER initial render so SSR === Client hydration)
  useEffect(() => {
    try {
      LEGACY_DEMO_KEYS.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Ignore storage errors
    }

    setActiveSessionId(generateSessionId());

    const activeSheetId = getConfiguredSpreadsheetId();
    setSpreadsheetId(activeSheetId);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    setOutbox(outboxQueue.getAll());

    const cachedGoogle = localCache.loadGoogleSnapshot(activeSheetId);
    const cachedPresent = localCache.loadPresentIds();

    const restoreCachedData = () => {
      if (cachedGoogle) {
        setPlayers(cachedGoogle.players);
        setExerciseBank(cachedGoogle.exerciseBank);
        setPreparation(cachedGoogle.preparation);
        setSessions(cachedGoogle.sessions);
        setLastSyncedAt(cachedGoogle.syncedAt);
        const validIds = new Set(cachedGoogle.players.map((p) => p.id));
        setPresentPlayerIds(cachedPresent.filter((id) => validIds.has(id)));
        setDataSource('google');
        return true;
      }
      return false;
    };

    const restoredGoogleAuth = googleAuth.restoreSession();
    if (restoredGoogleAuth) {
      setAuthMode('google');
      if (!restoreCachedData()) {
        setDataSource('loading');
      }
      setHydrated(true);
      void flushOutboxAndPull(true);
      return;
    }

    // Check if an HttpOnly Email/Password viewer session cookie is active
    const hasCache = restoreCachedData();
    setHydrated(true);

    void (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: ViewerUser | null;
        };
        if (data.authenticated && data.user) {
          setViewerUser(data.user);
          setAuthMode('viewer');
          if (!hasCache) {
            setDataSource('loading');
          }
          await pullReadOnlySnapshot(true);
        }
      } catch {
        // Offline or unreachable — keep cached state if available
      }
    })();
  }, [flushOutboxAndPull, pullReadOnlySnapshot]);

  // Persist verified Google Sheets data into offline cache
  useEffect(() => {
    if (!hydrated || dataSource !== 'google') return;
    const activeSheetId = getConfiguredSpreadsheetId();
    localCache.saveGoogleSnapshot({
      spreadsheetId: activeSheetId,
      syncedAt: lastSyncedAt ?? new Date().toISOString(),
      players,
      exerciseBank,
      preparation,
      sessions,
    });
  }, [
    hydrated,
    dataSource,
    players,
    exerciseBank,
    preparation,
    sessions,
    lastSyncedAt,
  ]);

  useEffect(() => {
    if (!hydrated || dataSource !== 'google') return;
    localCache.savePresentIds(presentPlayerIds);
  }, [presentPlayerIds, hydrated, dataSource]);

  useEffect(() => {
    if (!hydrated || dataSource !== 'google') return;
    localCache.savePairings(pairings);
  }, [pairings, hydrated, dataSource]);

  // Subscribe to googleAuth state
  useEffect(() => {
    return googleAuth.subscribe(() => {
      if (googleAuth.isSignedIn()) {
        setAuthMode('google');
        setViewerUser(null);
      } else if (authModeRef.current === 'google') {
        setAuthMode('none');
      }
    });
  }, []);

  // Derived present players & Picot auto-detection
  const presentPlayers = useMemo(() => {
    const set = new Set(presentPlayerIds);
    return players.filter((p) => set.has(p.id));
  }, [players, presentPlayerIds]);

  const presentSpecialPlayers = useMemo(
    () => presentPlayers.filter(hasSpecialRubber),
    [presentPlayers]
  );

  const picotActive = presentSpecialPlayers.length > 0;

  // Keep pairings synchronized when present players / modes change
  const levelThresholdRef = useRef(levelThreshold);
  useEffect(() => {
    levelThresholdRef.current = levelThreshold;
  }, [levelThreshold]);

  const setLevelThreshold = useCallback((threshold: number) => {
    const safe = Math.max(500, Math.min(2500, Math.round(threshold)));
    setLevelThresholdState(safe);
    setPairings((prev) => applyLevelThresholdToPairings(prev, safe));
  }, []);

  const toggleTableGroup = useCallback((tableNumber: number) => {
    setPairings((prev) => toggleTableGroupLevel(prev, tableNumber));
  }, []);

  const regeneratePairings = useCallback(() => {
    setPairings(
      generatePairings(
        presentPlayers,
        pairingMode,
        oddMode,
        levelThresholdRef.current
      )
    );
  }, [presentPlayers, pairingMode, oddMode]);

  useEffect(() => {
    if (!hydrated) return;
    setPairings(
      generatePairings(
        presentPlayers,
        pairingMode,
        oddMode,
        levelThresholdRef.current
      )
    );
  }, [presentPlayers, pairingMode, oddMode, hydrated]);

  const togglePlayerPresence = useCallback((playerId: string) => {
    setPresentPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  }, []);

  const setAllActivePresent = useCallback(
    (selectAll: boolean) => {
      if (!selectAll) {
        setPresentPlayerIds([]);
        return;
      }
      setPresentPlayerIds(
        players.filter((p) => p.active === 'Oui').map((p) => p.id)
      );
    },
    [players]
  );

  const swapPairingsPlayers = useCallback(
    (playerIdA: string, playerIdB: string) => {
      setPairings((prev) => swapPlayersInPairings(prev, playerIdA, playerIdB));
    },
    []
  );

  const resetActiveSessionId = useCallback(() => {
    setActiveSessionId(generateSessionId());
    setLiveCompletedLocalIds([]);
  }, []);

  const markLiveExerciseCompleted = useCallback(
    (localId: string, completed = true) => {
      setLiveCompletedLocalIds((prev) => {
        if (completed) {
          return prev.includes(localId) ? prev : [...prev, localId];
        }
        return prev.filter((id) => id !== localId);
      });
    },
    []
  );

  const launchLiveSession = useCallback(() => {
    if (preparation.length === 0) {
      pushToast(
        'warning',
        'Ajoutez au moins un exercice avant de lancer le Live.'
      );
      return;
    }
    setActiveTab('live');
  }, [preparation.length, pushToast]);

  // Monitor online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      pushToast('info', 'Connexion rétablie.');
      if (authModeRef.current === 'google' && googleAuth.isSignedIn()) {
        void flushOutboxAndPull(true);
      } else if (authModeRef.current === 'viewer') {
        void pullReadOnlySnapshot(true);
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      pushToast('warning', 'Mode hors-ligne actif.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushOutboxAndPull, pullReadOnlySnapshot, pushToast]);

  // Proactive background silent refresh every 10 minutes during long >60min Google OAuth sessions
  useEffect(() => {
    if (authMode !== 'google') return;
    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        void googleAuth.refreshSilentlyIfNeeded();
      }
    }, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [authMode]);

  const signInGoogle = useCallback(async () => {
    setSyncError(null);
    try {
      await googleAuth.signIn('select_account');
      setViewerUser(null);
      setAuthMode('google');
      await flushOutboxAndPull(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Connexion Google impossible.';
      setSyncError(msg);
      pushToast('error', msg);
    }
  }, [flushOutboxAndPull, pushToast]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      setSyncError(null);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json().catch(() => null)) as {
        user?: ViewerUser;
        error?: string;
      } | null;

      if (!res.ok || !data?.user) {
        const msg = data?.error || 'Connexion impossible.';
        throw new Error(msg);
      }

      // Clear any Google OAuth token when switching to read-only viewer account
      if (googleAuth.isSignedIn()) {
        googleAuth.signOut();
      }

      setViewerUser(data.user);
      setAuthMode('viewer');
      await pullReadOnlySnapshot(false);
    },
    [pullReadOnlySnapshot]
  );

  const signOutGoogle = useCallback(() => {
    googleAuth.signOut();
    setAuthMode('none');
    setViewerUser(null);
    setSyncError(null);
    pushToast(
      'info',
      'Déconnecté de Google Sheets (cache hors-ligne conservé).'
    );
  }, [pushToast]);

  const signOut = useCallback(async () => {
    if (authModeRef.current === 'viewer') {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch {
        // Ignore network errors on logout
      }
      setViewerUser(null);
      setAuthMode('none');
      setSyncError(null);
      // Clear cached data on explicit viewer logout so next person sees clean login screen
      localCache.clearGoogleSnapshot();
      setPlayers([]);
      setExerciseBank(EMPTY_EXERCISE_BANK);
      setPreparation([]);
      setSessions([]);
      setPresentPlayerIds([]);
      setDataSource('empty');
      pushToast('info', 'Déconnecté du mode lecture seule.');
      return;
    }

    signOutGoogle();
  }, [pushToast, signOutGoogle]);

  const syncNow = useCallback(async () => {
    if (authModeRef.current === 'viewer') {
      await pullReadOnlySnapshot(false);
      return;
    }
    await flushOutboxAndPull(false);
  }, [flushOutboxAndPull, pullReadOnlySnapshot]);

  // ============================================================================
  // CRUD Mutations (HARD-BLOCKED in Read-Only Viewer Mode!)
  // ============================================================================

  const blockIfReadOnly = useCallback((): boolean => {
    if (authModeRef.current === 'viewer') {
      pushToast(
        'warning',
        'Mode lecture seule : aucune modification du Google Sheets n’est autorisée.'
      );
      return true;
    }
    return false;
  }, [pushToast]);

  const addPlayer = useCallback(
    async (input: PlayerInput) => {
      if (blockIfReadOnly()) return;

      const optimisticId = computeNextCode(
        players.map((p) => p.id),
        'J'
      );
      const nextRow =
        players.reduce((max, p) => Math.max(max, p.rowIndex), 3) + 1;
      const optimistic: Player = {
        rowIndex: nextRow,
        id: optimisticId,
        name: input.name.trim(),
        pointsFftt: input.pointsFftt,
        forehandRubber: input.forehandRubber,
        backhandRubber: input.backhandRubber,
        playStyle: input.playStyle.trim(),
        participations: 0,
        active: input.active,
      };

      setPlayers((prev) => [...prev, optimistic]);
      setDataSource('google');

      if (!googleAuth.isSignedIn() || !navigator.onLine) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'ADD_PLAYER',
            createdAt: new Date().toISOString(),
            retryCount: 0,
            payload: { tempId: optimisticId, input },
          })
        );
        pushToast(
          'warning',
          `${optimistic.name} enregistré hors-ligne (synchronisé à la prochaine connexion Google).`
        );
        return;
      }

      try {
        const created = await addPlayerToSheet(input);
        setPlayers((prev) =>
          prev.map((p) => (p.id === optimisticId ? created : p))
        );
        pushToast('success', `${created.name} enregistré dans Google Sheets.`);
      } catch (err) {
        const detail =
          err instanceof Error ? err.message : 'Erreur réseau';
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'ADD_PLAYER',
            createdAt: new Date().toISOString(),
            retryCount: 1,
            lastError: detail,
            payload: { tempId: optimisticId, input },
          })
        );
        pushToast(
          'warning',
          `${optimistic.name} enregistré localement (file d'attente) — ${detail}`
        );
      }
    },
    [blockIfReadOnly, players, pushToast]
  );

  const updatePlayer = useCallback(
    async (player: Player) => {
      if (blockIfReadOnly()) return;

      setPlayers((prev) =>
        prev.map((p) =>
          p.rowIndex === player.rowIndex && p.id === player.id ? player : p
        )
      );

      if (!googleAuth.isSignedIn() || !navigator.onLine) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'UPDATE_PLAYER',
            createdAt: new Date().toISOString(),
            retryCount: 0,
            payload: player,
          })
        );
        pushToast('warning', `${player.name} modifié hors-ligne.`);
        return;
      }

      try {
        await updatePlayerInSheet(player);
        pushToast('success', `${player.name} mis à jour dans Google Sheets.`);
      } catch (err) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'UPDATE_PLAYER',
            createdAt: new Date().toISOString(),
            retryCount: 1,
            lastError: err instanceof Error ? err.message : 'Erreur réseau',
            payload: player,
          })
        );
        pushToast('warning', `Modification mise en file d'attente.`);
      }
    },
    [blockIfReadOnly, pushToast]
  );

  const addExercise = useCallback(
    async (input: ExerciseInput) => {
      if (blockIfReadOnly()) return;

      const tempId = computeNextCode(
        exerciseBank.exercises.map((e) => e.id),
        'EXO'
      );
      const axisEnd = exerciseBank.axisLastRow[input.axis];
      const optimisticRow =
        axisEnd !== undefined
          ? axisEnd + 1
          : exerciseBank.exercises.reduce(
              (max, e) => Math.max(max, e.rowIndex),
              5
            ) + 1;

      const optimisticExercise: Exercise = {
        rowIndex: optimisticRow,
        id: tempId,
        axis: input.axis.trim(),
        name: input.name.trim(),
        technicalFocus: input.technicalFocus.trim(),
        description: input.description.trim(),
        basketSuitability: input.basketSuitability,
        picotCompatibility: input.picotCompatibility,
        nbRealises: 0,
        niveauCible: input.niveauCible ?? 'Tous niveaux',
      };

      setExerciseBank((prev) => ({
        ...prev,
        axes: prev.axes.includes(optimisticExercise.axis)
          ? prev.axes
          : [...prev.axes, optimisticExercise.axis],
        exercises: [...prev.exercises, optimisticExercise],
        axisLastRow: {
          ...prev.axisLastRow,
          [optimisticExercise.axis]: optimisticRow,
        },
      }));
      setDataSource('google');

      if (!googleAuth.isSignedIn() || !navigator.onLine) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'ADD_EXERCISE',
            createdAt: new Date().toISOString(),
            retryCount: 0,
            payload: { tempId, input },
          })
        );
        pushToast('warning', `Exercice ajouté hors-ligne (file d'attente).`);
        return;
      }

      try {
        const refreshedBank = await addExerciseToSheet(input);
        setExerciseBank(refreshedBank);
        pushToast(
          'success',
          `Exercice inséré dans la section "${input.axis}" (Banque Exo).`
        );
      } catch (err) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'ADD_EXERCISE',
            createdAt: new Date().toISOString(),
            retryCount: 1,
            lastError: err instanceof Error ? err.message : 'Erreur réseau',
            payload: { tempId, input },
          })
        );
        pushToast('warning', `Insertion exercice mise en file d'attente.`);
      }
    },
    [blockIfReadOnly, exerciseBank, pushToast]
  );

  const updateExercise = useCallback(
    async (exercise: Exercise) => {
      if (blockIfReadOnly()) return;

      setExerciseBank((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.rowIndex === exercise.rowIndex && e.id === exercise.id
            ? exercise
            : e
        ),
      }));

      if (!googleAuth.isSignedIn() || !navigator.onLine) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'UPDATE_EXERCISE',
            createdAt: new Date().toISOString(),
            retryCount: 0,
            payload: exercise,
          })
        );
        pushToast('warning', `Modification exercice en file d'attente.`);
        return;
      }

      try {
        await updateExerciseInSheet(exercise);
        pushToast('success', `Exercice mis à jour dans Banque Exo.`);
      } catch (err) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'UPDATE_EXERCISE',
            createdAt: new Date().toISOString(),
            retryCount: 1,
            lastError: err instanceof Error ? err.message : 'Erreur réseau',
            payload: exercise,
          })
        );
        pushToast('warning', `Modification exercice mise en file d'attente.`);
      }
    },
    [blockIfReadOnly, pushToast]
  );

  const savePreparation = useCallback(
    async (items: PreparationItem[]) => {
      if (blockIfReadOnly()) return;

      // Preserve shared slot order (N°) for differentiated Groupe A / Groupe B variants
      const normalized = items.map((item, idx) => ({
        ...item,
        order: item.order > 0 ? item.order : idx + 1,
        groupeCible: item.groupeCible ?? 'Tous',
      }));
      setPreparation(normalized);

      if (!googleAuth.isSignedIn() || !navigator.onLine) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'SAVE_PREPARATION',
            createdAt: new Date().toISOString(),
            retryCount: 0,
            payload: normalized,
          })
        );
        pushToast(
          'warning',
          'Trame enregistrée hors-ligne (sera envoyée dans Préparation).'
        );
        return;
      }

      try {
        await savePreparationToSheet(normalized);
        pushToast('success', 'Trame sauvegardée dans l’onglet Préparation.');
      } catch (err) {
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'SAVE_PREPARATION',
            createdAt: new Date().toISOString(),
            retryCount: 1,
            lastError: err instanceof Error ? err.message : 'Erreur réseau',
            payload: normalized,
          })
        );
        pushToast('warning', 'Sauvegarde Préparation mise en file d’attente.');
      }
    },
    [blockIfReadOnly, pushToast]
  );

  const applyLocalClosureOptimistically = useCallback(
    (payload: SessionClosurePayload) => {
      const completed = payload.exercises.filter((e) => e.completed);
      setSessions((prev) => {
        if (prev.some((row) => row.sessionId === payload.sessionId)) {
          return prev;
        }
        const nextRowStart =
          prev.reduce((max, row) => Math.max(max, row.rowIndex), 6) + 1;
        const added: SessionLogRow[] = completed.map((exo, idx) => {
          const groupTag =
            exo.groupeCible && exo.groupeCible !== 'Tous'
              ? `[${exo.groupeCible}]`
              : '';
          const trimmed = exo.details.trim();
          const details =
            groupTag && !trimmed.startsWith(groupTag)
              ? trimmed
                ? `${groupTag} ${trimmed}`
                : groupTag
              : trimmed;
          return {
            rowIndex: nextRowStart + idx,
            date: payload.date,
            order: exo.slotOrder ?? idx + 1,
            axis: exo.axis,
            exerciseName: exo.exerciseName,
            durationMin: exo.durationMin,
            details,
            participants: payload.presentPlayerNames,
            sessionId: payload.sessionId,
          };
        });
        return [...prev, ...added];
      });

      const presentSet = new Set(payload.presentPlayerIds);
      setPlayers((prev) =>
        prev.map((p) =>
          presentSet.has(p.id)
            ? { ...p, participations: p.participations + 1 }
            : p
        )
      );

      const distinctIds = new Set<string>();
      for (const exo of completed) {
        if (exo.exerciseId) {
          distinctIds.add(exo.exerciseId);
        }
      }
      setExerciseBank((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) =>
          distinctIds.has(e.id) ? { ...e, nbRealises: e.nbRealises + 1 } : e
        ),
      }));
    },
    []
  );

  const archiveSession = useCallback(
    async (
      payload: SessionClosurePayload
    ): Promise<{ queued: boolean; alreadyArchived?: boolean }> => {
      if (blockIfReadOnly()) {
        return { queued: false, alreadyArchived: false };
      }

      const alreadyLocal = sessions.some(
        (row) => row.sessionId === payload.sessionId
      );

      if (!googleAuth.isSignedIn() || !navigator.onLine) {
        if (!alreadyLocal) {
          applyLocalClosureOptimistically(payload);
        }
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'CLOSE_SESSION',
            createdAt: new Date().toISOString(),
            retryCount: 0,
            payload,
          })
        );
        resetActiveSessionId();
        pushToast(
          'warning',
          `Hors ligne : séance mise en file d'attente (clé ${payload.sessionId}).`
        );
        return { queued: true };
      }

      try {
        const result = await closeSessionAtomic(payload);
        const snapshot = await fetchAllSheetData();
        applyFetchedSnapshot(getConfiguredSpreadsheetId(), snapshot);
        resetActiveSessionId();

        if (result.alreadyArchived) {
          pushToast(
            'info',
            `Séance déjà archivée (idempotence ${payload.sessionId}).`
          );
          return { queued: false, alreadyArchived: true };
        }

        pushToast(
          'success',
          `Séance archivée atomiquement (${result.writtenRange ?? 'Séances'}).`
        );
        return { queued: false, alreadyArchived: false };
      } catch (err) {
        if (!alreadyLocal) {
          applyLocalClosureOptimistically(payload);
        }
        setOutbox(
          outboxQueue.enqueue({
            id: generateActionId(),
            type: 'CLOSE_SESSION',
            createdAt: new Date().toISOString(),
            retryCount: 1,
            lastError: err instanceof Error ? err.message : 'Erreur réseau',
            payload,
          })
        );
        resetActiveSessionId();
        pushToast(
          'warning',
          `Réseau indisponible : clôture sécurisée en file d'attente (${payload.sessionId}).`
        );
        return { queued: true };
      }
    },
    [
      applyFetchedSnapshot,
      applyLocalClosureOptimistically,
      blockIfReadOnly,
      pushToast,
      resetActiveSessionId,
      sessions,
    ]
  );

  const syncStatus: SyncStatus = useMemo(
    () => ({
      mode:
        authMode === 'google'
          ? 'google'
          : authMode === 'viewer'
            ? 'viewer'
            : 'local',
      authMode,
      isReadOnly,
      dataSource,
      spreadsheetId,
      isOnline,
      isSyncing,
      lastSyncedAt,
      pendingCount: isReadOnly ? 0 : outbox.length,
      error: syncError,
    }),
    [
      authMode,
      isReadOnly,
      dataSource,
      spreadsheetId,
      isOnline,
      isSyncing,
      lastSyncedAt,
      outbox.length,
      syncError,
    ]
  );

  const value: AppContextValue = {
    activeTab,
    setActiveTab,
    players,
    exerciseBank,
    preparation,
    sessions,
    presentPlayerIds,
    presentPlayers,
    presentSpecialPlayers,
    picotActive,
    togglePlayerPresence,
    setAllActivePresent,
    pairingMode,
    setPairingMode,
    oddMode,
    setOddMode,
    levelThreshold,
    setLevelThreshold,
    pairings,
    regeneratePairings,
    swapPairingsPlayers,
    toggleTableGroup,
    setPreparation,
    activeSessionId,
    resetActiveSessionId,
    liveCompletedLocalIds,
    markLiveExerciseCompleted,
    launchLiveSession,
    syncStatus,
    outbox,
    authMode,
    viewerUser,
    isReadOnly,
    isSignedIn,
    signInGoogle,
    signInWithPassword,
    signOutGoogle,
    signOut,
    syncNow,
    addPlayer,
    updatePlayer,
    addExercise,
    updateExercise,
    savePreparation,
    archiveSession,
    toasts,
    pushToast,
    dismissToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp doit être utilisé dans un AppProvider.');
  }
  return ctx;
}
