import type {
  ActiveStatus,
  BasketSuitability,
  Exercise,
  ExerciseBankData,
  ExerciseInput,
  PicotCompatibility,
  PicotMemoItem,
  Player,
  PlayerInput,
  PreparationItem,
  RubberType,
  SessionClosurePayload,
  SessionLogRow,
} from '@/types';
import { getConfiguredSpreadsheetId, googleAuth } from './googleAuth';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const SHEET_NAMES = {
  PLAYERS: 'Profils joueurs',
  EXERCISES: 'Banque Exo',
  PREPARATION: 'Préparation',
  SESSIONS: 'Séances',
} as const;

export const SHEET_RANGES = {
  PLAYERS: `'${SHEET_NAMES.PLAYERS}'!B4:I100`,
  EXERCISES: `'${SHEET_NAMES.EXERCISES}'!A6:H250`,
  PREPARATION: `'${SHEET_NAMES.PREPARATION}'!B7:H35`,
  SESSIONS: `'${SHEET_NAMES.SESSIONS}'!B7:I500`,
} as const;

export const EMPTY_EXERCISE_BANK: ExerciseBankData = {
  exercises: [],
  axes: [],
  axisLastRow: {},
  memoStartRow: null,
  picotMemos: [],
};

// Normalization helpers
function parseNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const raw = String(val ?? '')
    .replace(/\u00A0|\u202F/g, ' ')
    .trim();
  if (!raw) return fallback;
  // Extract first numeric token (handles e.g. "1 250 pts", "20 min", "12,5")
  const compact = raw.replace(/(\d)\s+(\d)/g, '$1$2').replace(',', '.');
  const match = compact.match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Normalizes dates returned by Google Sheets (DD/MM/YYYY, YYYY-MM-DD, or Excel serial numbers)
 * into ISO YYYY-MM-DD when possible so HTML date inputs and chronological sorting work cleanly.
 */
export function normalizeSheetDate(val: unknown): string {
  if (typeof val === 'number' && Number.isFinite(val) && val > 25000 && val < 80000) {
    // Google Sheets / Excel serial date (days since 1899-12-30)
    const utcMs = Date.UTC(1899, 11, 30) + Math.round(val) * 86_400_000;
    return new Date(utcMs).toISOString().slice(0, 10);
  }

  const s = String(val ?? '').trim();
  if (!s) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  // French DD/MM/YYYY or DD-MM-YYYY
  const frMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (frMatch) {
    const [, dd, mm, yyyy] = frMatch;
    return `${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}`;
  }

  return s;
}

function normalizeRubber(val: unknown): RubberType {
  const s = String(val ?? '').trim().toLowerCase();
  if (s.includes('picot')) return 'Picot long';
  if (s.includes('anti')) return 'Anti-top';
  if (s.includes('soft')) return 'Soft';
  return 'BS';
}

function normalizeActive(val: unknown): ActiveStatus {
  const s = String(val ?? '').trim().toLowerCase();
  return s === 'non' || s === 'false' || s === '0' ? 'Non' : 'Oui';
}

function normalizeBasket(val: unknown): BasketSuitability {
  const s = String(val ?? '').trim().toLowerCase();
  if (s === 'oui') return 'Oui';
  if (s.includes('possible')) return 'Possible';
  return 'Non adapté';
}

function normalizePicotCompatibility(val: unknown): PicotCompatibility {
  const s = String(val ?? '').trim().toLowerCase();
  if (s.includes('spécifique') || s.includes('specifique')) {
    return 'Spécifique Picot';
  }
  if (s.includes('non')) return 'Non adapté';
  if (s.includes('à adapter') || s.includes('a adapter')) return 'À adapter';
  return 'Adapté';
}

function isRowEmpty(row: unknown[] | undefined): boolean {
  if (!row || row.length === 0) return true;
  return row.every((cell) => String(cell ?? '').trim() === '');
}

// ============================================================================
// Pure Parsers (exported for unit tests)
// ============================================================================

export function parsePlayersRows(rows: unknown[][]): Player[] {
  const players: Player[] = [];
  rows.forEach((row, idx) => {
    const rowIndex = 4 + idx; // B4:I100 -> row 4 is index 0
    if (isRowEmpty(row)) return;
    const id = String(row[0] ?? '').trim();
    const name = String(row[1] ?? '').trim();
    if (!id && !name) return;
    // Skip accidental summary/footer rows (e.g. "Total" without player name)
    if (!name && /^(total|moyenne|effectif)/i.test(id)) return;

    players.push({
      rowIndex,
      id: id || `J-R${rowIndex}`,
      name: name || id,
      pointsFftt: parseNumber(row[2], 500),
      forehandRubber: normalizeRubber(row[3]),
      backhandRubber: normalizeRubber(row[4]),
      playStyle: String(row[5] ?? '').trim(),
      participations: parseNumber(row[6], 0),
      active: normalizeActive(row[7]),
    });
  });
  return players;
}

function isMemoHeaderRow(row: unknown[]): boolean {
  const joined = row.map((c) => String(c ?? '').trim()).join(' ').toUpperCase();
  return (
    joined.includes('MÉMO TECHNIQUE') ||
    joined.includes('MEMO TECHNIQUE') ||
    joined.includes('CONSEILS PICOT')
  );
}

function isAxisSectionHeaderRow(row: unknown[]): boolean {
  const colA = String(row[0] ?? '').trim();
  const colB = String(row[1] ?? '').trim();
  const colC = String(row[2] ?? '').trim();

  // Real exercises have an EXO-xxx code in column A
  if (/^EXO-\d+/i.test(colA)) return false;

  const candidate = (colA || colB).toUpperCase();
  if (!candidate) return false;

  if (
    /\bAXE\s*\d+/i.test(candidate) ||
    candidate.startsWith('AXE ') ||
    candidate.startsWith('AXE:') ||
    candidate.includes('MATCHS & SITUATIONS') ||
    candidate.includes('MATCHS ET SITUATIONS') ||
    (colA !== '' && colB === '' && colC === '')
  ) {
    return true;
  }

  return false;
}

export function parseExerciseBankRows(rows: unknown[][]): ExerciseBankData {
  const exercises: Exercise[] = [];
  const axesSet = new Set<string>();
  const axisLastRow: Record<string, number> = {};
  const picotMemos: PicotMemoItem[] = [];

  let currentSection = '';
  let memoStartRow: number | null = null;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx] ?? [];
    const rowIndex = 6 + idx; // A6:H250 -> row 6 is index 0

    if (memoStartRow !== null) {
      if (!isRowEmpty(row)) {
        const nonEmptyCells = row
          .map((c) => String(c ?? '').trim())
          .filter(Boolean);
        if (nonEmptyCells.length === 1) {
          picotMemos.push({
            rowIndex,
            title: 'Conseil Picot',
            content: nonEmptyCells[0]!,
          });
        } else if (nonEmptyCells.length >= 2) {
          picotMemos.push({
            rowIndex,
            title: nonEmptyCells[0]!,
            content: nonEmptyCells.slice(1).join(' — '),
          });
        }
      }
      continue;
    }

    if (isRowEmpty(row)) continue;

    if (isMemoHeaderRow(row)) {
      memoStartRow = rowIndex;
      continue;
    }

    if (isAxisSectionHeaderRow(row)) {
      const headerLabel =
        String(row[0] ?? '').trim() || String(row[1] ?? '').trim();
      currentSection = headerLabel;
      axesSet.add(headerLabel);
      if (axisLastRow[headerLabel] === undefined) {
        axisLastRow[headerLabel] = rowIndex;
      }
      continue;
    }

    const id = String(row[0] ?? '').trim();
    const axisCol = String(row[1] ?? '').trim();
    const name = String(row[2] ?? '').trim();

    if (!id && !name) continue;
    // Skip repeated column header rows inside Banque Exo
    if (
      id.toLowerCase() === 'id_exo' ||
      name.toLowerCase().startsWith('nom / thème') ||
      name.toLowerCase().startsWith('nom / theme')
    ) {
      continue;
    }
    // Skip stray non-exercise lines (no EXO code and no exercise name)
    if (!/^EXO-\d+/i.test(id) && !name) continue;

    const resolvedAxis = axisCol || currentSection || 'Général';
    axesSet.add(resolvedAxis);
    axisLastRow[resolvedAxis] = rowIndex;
    if (currentSection && currentSection !== resolvedAxis) {
      axisLastRow[currentSection] = rowIndex;
    }

    exercises.push({
      rowIndex,
      id: id || `EXO-R${rowIndex}`,
      axis: resolvedAxis,
      sectionTitle: currentSection || resolvedAxis,
      name: name || id,
      technicalFocus: String(row[3] ?? '').trim(),
      description: String(row[4] ?? '').trim(),
      basketSuitability: normalizeBasket(row[5]),
      picotCompatibility: normalizePicotCompatibility(row[6]),
      nbRealises: parseNumber(row[7], 0),
    });
  }

  return {
    exercises,
    axes: Array.from(axesSet),
    axisLastRow,
    memoStartRow,
    picotMemos,
  };
}

export function parsePreparationRows(rows: unknown[][]): PreparationItem[] {
  const items: PreparationItem[] = [];
  rows.forEach((row, idx) => {
    if (isRowEmpty(row)) return;
    const exerciseName = String(row[3] ?? '').trim();
    const axis = String(row[2] ?? '').trim();
    if (!exerciseName && !axis) return;

    items.push({
      localId: `prep-sheet-${7 + idx}`,
      date:
        normalizeSheetDate(row[0]) || new Date().toISOString().slice(0, 10),
      order: parseNumber(row[1], items.length + 1),
      axis,
      exerciseName,
      durationMin: parseNumber(row[4], 15),
      objectives: String(row[5] ?? '').trim(),
      exerciseId: String(row[6] ?? '').trim(),
    });
  });
  return items;
}

export function parseSessionRows(rows: unknown[][]): SessionLogRow[] {
  const sessions: SessionLogRow[] = [];
  rows.forEach((row, idx) => {
    const rowIndex = 7 + idx; // B7:I500 -> row 7 is index 0
    if (isRowEmpty(row)) return;
    const date = normalizeSheetDate(row[0]);
    const exerciseName = String(row[3] ?? '').trim();
    if (!date && !exerciseName) return;

    const rawParticipants = String(row[6] ?? '').trim();
    const participants = rawParticipants
      ? rawParticipants
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    sessions.push({
      rowIndex,
      date,
      order: parseNumber(row[1], 1),
      axis: String(row[2] ?? '').trim(),
      exerciseName,
      durationMin: parseNumber(row[4], 0),
      details: String(row[5] ?? '').trim(),
      participants,
      sessionId: String(row[7] ?? '').trim(),
    });
  });
  return sessions;
}

export function computeNextCode(
  existingIds: readonly string[],
  prefix: string
): string {
  let maxNum = 0;
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  for (const id of existingIds) {
    const match = id.trim().match(regex);
    if (match?.[1]) {
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > maxNum) {
        maxNum = n;
      }
    }
  }
  return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

export function findFirstFreeRow(
  rows: unknown[][],
  startRow1Based: number,
  requiredColumns?: readonly number[]
): number {
  let lastNonEmptyOffset = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hasContent = requiredColumns
      ? Boolean(
          row &&
            requiredColumns.some(
              (colIdx) => String(row[colIdx] ?? '').trim() !== ''
            )
        )
      : !isRowEmpty(row);
    if (hasContent) {
      lastNonEmptyOffset = i;
    }
  }
  return startRow1Based + lastNonEmptyOffset + 1;
}

// ============================================================================
// HTTP Helpers
// ============================================================================

async function extractSheetsErrorMessage(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  let detail = raw || response.statusText;
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) {
      detail = parsed.error.message;
    }
  } catch {
    // Keep raw text
  }

  if (response.status === 403) {
    return `Accès refusé (403) au classeur Google Sheets. Vérifiez que votre compte Google a accès en écriture au classeur et que l’API Google Sheets est activée. Détail : ${detail}`;
  }
  if (response.status === 404) {
    return `Classeur Google Sheets introuvable (404). Vérifiez NEXT_PUBLIC_SPREADSHEET_ID. Détail : ${detail}`;
  }
  if (response.status === 400) {
    return `Plage ou nom d’onglet invalide (400) : vérifiez les 4 onglets (Profils joueurs, Banque Exo, Préparation, Séances). Détail : ${detail}`;
  }
  return `Google Sheets API (${response.status}) : ${detail}`;
}

const SHEETS_FETCH_TIMEOUT_MS = 15_000;

async function sheetsFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const token = await googleAuth.ensureValidToken();
  const spreadsheetId = getConfiguredSpreadsheetId();
  const url = `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}${path}`;

  const controller = new AbortController();
  const timeoutId =
    typeof window !== 'undefined'
      ? window.setTimeout(() => controller.abort(), SHEETS_FETCH_TIMEOUT_MS)
      : null;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(
        'Délai de réponse Google Sheets dépassé (15 s). Vérifiez votre connexion réseau.'
      );
    }
    throw err;
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }

  if (response.status === 401 && retryOn401) {
    await googleAuth.forceRefreshToken();
    return sheetsFetch<T>(path, options, false);
  }

  if (!response.ok) {
    throw new Error(await extractSheetsErrorMessage(response));
  }

  return (await response.json()) as T;
}

// ============================================================================
// CRUD Operations
// ============================================================================

export interface FullSheetSnapshot {
  players: Player[];
  exerciseBank: ExerciseBankData;
  preparation: PreparationItem[];
  sessions: SessionLogRow[];
}

export async function fetchAllSheetData(): Promise<FullSheetSnapshot> {
  const ranges = [
    SHEET_RANGES.PLAYERS,
    SHEET_RANGES.EXERCISES,
    SHEET_RANGES.PREPARATION,
    SHEET_RANGES.SESSIONS,
  ]
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&');

  const data = await sheetsFetch<{
    valueRanges?: Array<{ values?: unknown[][] }>;
  }>(
    `/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
  );

  const vr = data.valueRanges ?? [];
  const players = parsePlayersRows(vr[0]?.values ?? []);
  const exerciseBank = parseExerciseBankRows(vr[1]?.values ?? []);
  const preparation = parsePreparationRows(vr[2]?.values ?? []);
  const sessions = parseSessionRows(vr[3]?.values ?? []);

  return { players, exerciseBank, preparation, sessions };
}

async function getRawRange(range: string): Promise<unknown[][]> {
  const data = await sheetsFetch<{ values?: unknown[][] }>(
    `/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`
  );
  return data.values ?? [];
}

async function getSheetNumericId(sheetTitle: string): Promise<number> {
  const meta = await sheetsFetch<{
    sheets?: Array<{ properties?: { sheetId?: number; title?: string } }>;
  }>('?fields=sheets.properties(sheetId,title)');

  const found = meta.sheets?.find((s) => s.properties?.title === sheetTitle);
  if (found?.properties?.sheetId === undefined) {
    throw new Error(`Onglet "${sheetTitle}" introuvable dans le classeur.`);
  }
  return found.properties.sheetId;
}

/**
 * Adds a new player in 'Profils joueurs'!B{nextFreeRow}:I{nextFreeRow} using values.update.
 */
export async function addPlayerToSheet(input: PlayerInput): Promise<Player> {
  const existingRows = await getRawRange(SHEET_RANGES.PLAYERS);
  const existingPlayers = parsePlayersRows(existingRows);
  // Check only ID_Joueur (col B = idx 0) and Nom (col C = idx 1) so pre-filled dropdowns/formulas in H/I don't block insertion
  const nextRow = findFirstFreeRow(existingRows, 4, [0, 1]);
  if (nextRow > 100) {
    throw new Error('Plage Profils joueurs (B4:I100) pleine.');
  }

  const newId = computeNextCode(
    existingPlayers.map((p) => p.id),
    'J'
  );

  const rowValues = [
    [
      newId,
      input.name.trim(),
      input.pointsFftt,
      input.forehandRubber,
      input.backhandRubber,
      input.playStyle.trim(),
      0,
      input.active,
    ],
  ];

  const targetRange = `'${SHEET_NAMES.PLAYERS}'!B${nextRow}:I${nextRow}`;
  await sheetsFetch(
    `/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ range: targetRange, values: rowValues }),
    }
  );

  return {
    rowIndex: nextRow,
    id: newId,
    name: input.name.trim(),
    pointsFftt: input.pointsFftt,
    forehandRubber: input.forehandRubber,
    backhandRubber: input.backhandRubber,
    playStyle: input.playStyle.trim(),
    participations: 0,
    active: input.active,
  };
}

/**
 * Updates an existing player row in 'Profils joueurs'!B{rowIndex}:I{rowIndex}.
 */
export async function updatePlayerInSheet(player: Player): Promise<Player> {
  if (player.rowIndex < 4) {
    throw new Error('Index de ligne invalide pour Profils joueurs (< 4).');
  }

  const targetRange = `'${SHEET_NAMES.PLAYERS}'!B${player.rowIndex}:I${player.rowIndex}`;
  const rowValues = [
    [
      player.id,
      player.name.trim(),
      player.pointsFftt,
      player.forehandRubber,
      player.backhandRubber,
      player.playStyle.trim(),
      player.participations,
      player.active,
    ],
  ];

  await sheetsFetch(
    `/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ range: targetRange, values: rowValues }),
    }
  );

  return player;
}

/**
 * Inserts a new physical row at the end of the chosen Axis section in 'Banque Exo'
 * via spreadsheets.batchUpdate (insertDimension), strictly above the Picot Memo block,
 * then writes the exercise values to A{insertRow}:H{insertRow}.
 */
export async function addExerciseToSheet(
  input: ExerciseInput
): Promise<ExerciseBankData> {
  const existingRows = await getRawRange(SHEET_RANGES.EXERCISES);
  const bank = parseExerciseBankRows(existingRows);
  const newId = computeNextCode(
    bank.exercises.map((e) => e.id),
    'EXO'
  );

  let insertRow1Based: number;
  const knownAxisEnd = bank.axisLastRow[input.axis];

  if (knownAxisEnd !== undefined) {
    insertRow1Based = knownAxisEnd + 1;
  } else if (bank.memoStartRow !== null) {
    insertRow1Based = Math.max(6, bank.memoStartRow - 1);
  } else {
    insertRow1Based = findFirstFreeRow(existingRows, 6);
  }

  // Never insert inside or below the Picot Memo block
  if (bank.memoStartRow !== null && insertRow1Based > bank.memoStartRow) {
    insertRow1Based = bank.memoStartRow;
  }

  const sheetId = await getSheetNumericId(SHEET_NAMES.EXERCISES);

  await sheetsFetch(':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: insertRow1Based - 1,
              endIndex: insertRow1Based,
            },
            inheritFromBefore: insertRow1Based > 6,
          },
        },
      ],
    }),
  });

  const targetRange = `'${SHEET_NAMES.EXERCISES}'!A${insertRow1Based}:H${insertRow1Based}`;
  const rowValues = [
    [
      newId,
      input.axis.trim(),
      input.name.trim(),
      input.technicalFocus.trim(),
      input.description.trim(),
      input.basketSuitability,
      input.picotCompatibility,
      0,
    ],
  ];

  await sheetsFetch(
    `/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ range: targetRange, values: rowValues }),
    }
  );

  const refreshedRows = await getRawRange(SHEET_RANGES.EXERCISES);
  return parseExerciseBankRows(refreshedRows);
}

/**
 * Updates an existing exercise in 'Banque Exo'!A{rowIndex}:H{rowIndex}.
 */
export async function updateExerciseInSheet(
  exercise: Exercise
): Promise<Exercise> {
  if (exercise.rowIndex < 6) {
    throw new Error('Index de ligne invalide pour Banque Exo (< 6).');
  }

  const targetRange = `'${SHEET_NAMES.EXERCISES}'!A${exercise.rowIndex}:H${exercise.rowIndex}`;
  const rowValues = [
    [
      exercise.id,
      exercise.axis.trim(),
      exercise.name.trim(),
      exercise.technicalFocus.trim(),
      exercise.description.trim(),
      exercise.basketSuitability,
      exercise.picotCompatibility,
      exercise.nbRealises,
    ],
  ];

  await sheetsFetch(
    `/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ range: targetRange, values: rowValues }),
    }
  );

  return exercise;
}

/**
 * Saves preparation plan strictly inside 'Préparation'!B7:H35.
 * NEVER writes above row 7 (rows 2–4 hold formula KPIs).
 */
export async function savePreparationToSheet(
  items: readonly PreparationItem[]
): Promise<void> {
  if (items.length > 29) {
    throw new Error(
      'Maximum 29 exercices dans Préparation (plage strictement bornée B7:H35).'
    );
  }

  await sheetsFetch(
    `/values/${encodeURIComponent(SHEET_RANGES.PREPARATION)}:clear`,
    { method: 'POST', body: '{}' }
  );

  if (items.length === 0) return;

  const endRow = 6 + items.length;
  const targetRange = `'${SHEET_NAMES.PREPARATION}'!B7:H${endRow}`;
  const values = items.map((item, idx) => [
    item.date,
    idx + 1,
    item.axis,
    item.exerciseName,
    item.durationMin,
    item.objectives,
    item.exerciseId,
  ]);

  await sheetsFetch(
    `/values/${encodeURIComponent(targetRange)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ range: targetRange, values }),
    }
  );
}

export interface AtomicCloseResult {
  alreadyArchived: boolean;
  writtenRange?: string;
}

/**
 * Atomically archives a finished session with full idempotency via ID_Session:
 * 1. Verifies ID_Session does not already exist in 'Séances'!B7:I500.
 * 2. Executes a SINGLE values:batchUpdate writing:
 *    - 'Séances'!B{firstFreeRow}:I{endRow} (NEVER uses append, preserves lateral col K+ blocks)
 *    - 'Profils joueurs'!H{row} (+1 participation per present player)
 *    - 'Banque Exo'!H{row} (+1 nbRealises per completed exercise)
 */
export async function closeSessionAtomic(
  payload: SessionClosurePayload
): Promise<AtomicCloseResult> {
  const completedExercises = payload.exercises.filter((e) => e.completed);
  if (completedExercises.length === 0) {
    throw new Error('Aucun exercice validé à archiver.');
  }

  const snapshot = await fetchAllSheetData();

  const existsAlready = snapshot.sessions.some(
    (row) => row.sessionId.trim() === payload.sessionId.trim()
  );
  if (existsAlready) {
    return { alreadyArchived: true };
  }

  const rawSessions = await getRawRange(SHEET_RANGES.SESSIONS);
  // Check Date (col B = idx 0) and Exercice (col E = idx 3) so pre-formatted rows don't skip lines
  const firstFreeRow = findFirstFreeRow(rawSessions, 7, [0, 3]);
  const endRow = firstFreeRow + completedExercises.length - 1;

  if (endRow > 500) {
    throw new Error('Plage Séances (B7:I500) pleine.');
  }

  const participantsLabel = payload.presentPlayerNames.join(', ');
  const seancesRange = `'${SHEET_NAMES.SESSIONS}'!B${firstFreeRow}:I${endRow}`;
  const seancesValues = completedExercises.map((exo, idx) => [
    payload.date,
    idx + 1,
    exo.axis,
    exo.exerciseName,
    exo.durationMin,
    exo.details,
    participantsLabel,
    payload.sessionId,
  ]);

  const batchData: Array<{
    range: string;
    values: Array<Array<string | number>>;
  }> = [
    {
      range: seancesRange,
      values: seancesValues,
    },
  ];

  const presentIdSet = new Set(payload.presentPlayerIds);
  for (const player of snapshot.players) {
    if (presentIdSet.has(player.id) && player.rowIndex >= 4) {
      batchData.push({
        range: `'${SHEET_NAMES.PLAYERS}'!H${player.rowIndex}`,
        values: [[player.participations + 1]],
      });
    }
  }

  const exerciseRowDeltaMap = new Map<number, number>();
  for (const exo of completedExercises) {
    let targetRow = exo.exerciseRowIndex;
    if (targetRow === null && exo.exerciseId) {
      const matched = snapshot.exerciseBank.exercises.find(
        (b) =>
          b.id === exo.exerciseId &&
          (!exo.exerciseName || b.name === exo.exerciseName)
      ) ?? snapshot.exerciseBank.exercises.find((b) => b.id === exo.exerciseId);
      targetRow = matched?.rowIndex ?? null;
    }
    if (targetRow !== null && targetRow >= 6) {
      exerciseRowDeltaMap.set(
        targetRow,
        (exerciseRowDeltaMap.get(targetRow) ?? 0) + 1
      );
    }
  }

  for (const bankExo of snapshot.exerciseBank.exercises) {
    const delta = exerciseRowDeltaMap.get(bankExo.rowIndex);
    if (delta && bankExo.rowIndex >= 6) {
      batchData.push({
        range: `'${SHEET_NAMES.EXERCISES}'!H${bankExo.rowIndex}`,
        values: [[bankExo.nbRealises + delta]],
      });
    }
  }

  await sheetsFetch('/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: batchData,
    }),
  });

  return {
    alreadyArchived: false,
    writtenRange: seancesRange,
  };
}
