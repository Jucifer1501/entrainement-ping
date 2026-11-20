export type RubberType = 'BS' | 'Soft' | 'Picot long' | 'Anti-top';

export type ActiveStatus = 'Oui' | 'Non';

export type BasketSuitability = 'Oui' | 'Possible' | 'Non adapté';

export type PicotCompatibility =
  | 'Spécifique Picot'
  | 'Adapté'
  | 'À adapter'
  | 'Non adapté';

export interface Player {
  /** 1-based row index in Google Sheets 'Profils joueurs' (>= 4) */
  rowIndex: number;
  id: string; // e.g. J-001
  name: string;
  pointsFftt: number;
  forehandRubber: RubberType; // Plaque CD
  backhandRubber: RubberType; // Plaque RV
  playStyle: string;
  participations: number;
  active: ActiveStatus;
}

export interface PlayerInput {
  name: string;
  pointsFftt: number;
  forehandRubber: RubberType;
  backhandRubber: RubberType;
  playStyle: string;
  active: ActiveStatus;
}

export interface Exercise {
  /** 1-based row index in Google Sheets 'Banque Exo' (>= 6) */
  rowIndex: number;
  id: string; // e.g. EXO-001
  axis: string;
  /** Optional section header row text under which this exercise lives */
  sectionTitle?: string;
  name: string;
  technicalFocus: string;
  description: string;
  basketSuitability: BasketSuitability;
  picotCompatibility: PicotCompatibility;
  nbRealises: number;
}

export interface ExerciseInput {
  axis: string;
  name: string;
  technicalFocus: string;
  description: string;
  basketSuitability: BasketSuitability;
  picotCompatibility: PicotCompatibility;
}

export interface PicotMemoItem {
  rowIndex: number;
  title: string;
  content: string;
}

export interface ExerciseBankData {
  exercises: Exercise[];
  axes: string[];
  /** Map from normalized axis name -> 1-based last row index inside that section */
  axisLastRow: Record<string, number>;
  /** 1-based row index where the "💡 MÉMO TECHNIQUE & CONSEILS PICOT" block begins, or null */
  memoStartRow: number | null;
  picotMemos: PicotMemoItem[];
}

export interface PreparationItem {
  localId: string;
  date: string; // YYYY-MM-DD or DD/MM/YYYY
  order: number; // N° (1..n)
  axis: string;
  exerciseName: string;
  durationMin: number;
  objectives: string;
  exerciseId: string; // EXO-XXX or empty if custom
}

export interface SessionLogRow {
  rowIndex: number;
  date: string;
  order: number;
  axis: string;
  exerciseName: string;
  durationMin: number;
  details: string;
  participants: string[]; // parsed from comma-separated col H
  sessionId: string; // col I (ID_Session)
}

export type PairingMode = 'HOMOGENE' | 'OPPOSITION_STYLES';
export type OddMode = 'GROUPE_3' | 'PANIER_BALLES';

export interface TableGroup {
  tableNumber: number;
  players: Player[];
  averagePoints: number;
  isBasket: boolean;
  isStyleOpposition: boolean;
}

export interface PairingResult {
  tables: TableGroup[];
  basketPlayer: Player | null;
  mode: PairingMode;
  oddMode: OddMode;
}

export type SessionDurationPreset = 60 | 90 | 120;

export interface SessionClosureExercise {
  exerciseId: string;
  exerciseRowIndex: number | null;
  axis: string;
  exerciseName: string;
  durationMin: number;
  details: string;
  completed: boolean;
}

export interface SessionClosurePayload {
  /** Idempotency key written in 'Séances'!I */
  sessionId: string;
  date: string;
  presentPlayerIds: string[];
  presentPlayerNames: string[];
  exercises: SessionClosureExercise[];
}

export type OutboxAction =
  | {
      id: string;
      type: 'CLOSE_SESSION';
      createdAt: string;
      retryCount: number;
      lastError?: string;
      payload: SessionClosurePayload;
    }
  | {
      id: string;
      type: 'ADD_PLAYER';
      createdAt: string;
      retryCount: number;
      lastError?: string;
      payload: {
        tempId: string;
        input: PlayerInput;
      };
    }
  | {
      id: string;
      type: 'UPDATE_PLAYER';
      createdAt: string;
      retryCount: number;
      lastError?: string;
      payload: Player;
    }
  | {
      id: string;
      type: 'ADD_EXERCISE';
      createdAt: string;
      retryCount: number;
      lastError?: string;
      payload: {
        tempId: string;
        input: ExerciseInput;
      };
    }
  | {
      id: string;
      type: 'UPDATE_EXERCISE';
      createdAt: string;
      retryCount: number;
      lastError?: string;
      payload: Exercise;
    }
  | {
      id: string;
      type: 'SAVE_PREPARATION';
      createdAt: string;
      retryCount: number;
      lastError?: string;
      payload: PreparationItem[];
    };

export type AppTab = 'effectif' | 'exercices' | 'live' | 'cloture' | 'historique';

export type DataSource = 'empty' | 'loading' | 'google';

export interface SyncStatus {
  mode: 'google' | 'local';
  dataSource: DataSource;
  spreadsheetId: string;
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  error: string | null;
}
