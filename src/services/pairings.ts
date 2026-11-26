import type {
  OddMode,
  PairingMode,
  PairingResult,
  Player,
  RubberType,
  TableGroup,
  TableGroupLevel,
} from '@/types';

export const DEFAULT_LEVEL_THRESHOLD = 700;

const SPECIAL_RUBBERS: ReadonlySet<RubberType> = new Set([
  'Picot long',
  'Anti-top',
]);

export function hasSpecialRubber(player: Player): boolean {
  return (
    SPECIAL_RUBBERS.has(player.forehandRubber) ||
    SPECIAL_RUBBERS.has(player.backhandRubber)
  );
}

export function isBsOpponent(player: Player): boolean {
  return (
    !hasSpecialRubber(player) &&
    (player.forehandRubber === 'BS' || player.backhandRubber === 'BS')
  );
}

export function computeAveragePoints(players: readonly Player[]): number {
  if (players.length === 0) return 0;
  const total = players.reduce((sum, p) => sum + p.pointsFftt, 0);
  return Math.round(total / players.length);
}

export function classifyTableLevel(
  averagePoints: number,
  levelThreshold = DEFAULT_LEVEL_THRESHOLD
): TableGroupLevel {
  return averagePoints >= levelThreshold
    ? 'Groupe A (Confirmés)'
    : 'Groupe B (Débutants)';
}

export function isTableStyleOpposition(players: readonly Player[]): boolean {
  const hasSpecial = players.some(hasSpecialRubber);
  const hasBs = players.some(isBsOpponent);
  return hasSpecial && hasBs;
}

function sortByPointsDesc(players: readonly Player[]): Player[] {
  return [...players].sort((a, b) => {
    if (b.pointsFftt !== a.pointsFftt) {
      return b.pointsFftt - a.pointsFftt;
    }
    return a.id.localeCompare(b.id);
  });
}

function buildHomogeneousPairs(
  sortedDesc: readonly Player[],
  levelThreshold: number
): TableGroup[] {
  const groups: TableGroup[] = [];
  for (let i = 0; i + 1 < sortedDesc.length; i += 2) {
    const p1 = sortedDesc[i];
    const p2 = sortedDesc[i + 1];
    if (p1 && p2) {
      const pair = [p1, p2];
      const averagePoints = computeAveragePoints(pair);
      groups.push({
        tableNumber: groups.length + 1,
        players: pair,
        averagePoints,
        isBasket: false,
        isStyleOpposition: isTableStyleOpposition(pair),
        groupLevel: classifyTableLevel(averagePoints, levelThreshold),
      });
    }
  }
  return groups;
}

function attachMedianToClosestTable(
  tables: TableGroup[],
  medianPlayer: Player,
  levelThreshold: number
): TableGroup[] {
  if (tables.length === 0) {
    return [
      {
        tableNumber: 1,
        players: [medianPlayer],
        averagePoints: medianPlayer.pointsFftt,
        isBasket: false,
        isStyleOpposition: false,
        groupLevel: classifyTableLevel(medianPlayer.pointsFftt, levelThreshold),
      },
    ];
  }

  let bestIndex = 0;
  let bestDiff = Number.POSITIVE_INFINITY;

  tables.forEach((table, idx) => {
    const diff = Math.abs(table.averagePoints - medianPlayer.pointsFftt);
    const currentBest = tables[bestIndex];
    if (
      diff < bestDiff ||
      (diff === bestDiff &&
        currentBest &&
        table.players.length < currentBest.players.length)
    ) {
      bestDiff = diff;
      bestIndex = idx;
    }
  });

  return tables.map((table, idx) => {
    if (idx !== bestIndex) return table;
    const updatedPlayers = sortByPointsDesc([...table.players, medianPlayer]);
    const averagePoints = computeAveragePoints(updatedPlayers);
    return {
      ...table,
      players: updatedPlayers,
      averagePoints,
      isStyleOpposition: isTableStyleOpposition(updatedPlayers),
      groupLevel: classifyTableLevel(averagePoints, levelThreshold),
    };
  });
}

function renumberTables(
  tables: TableGroup[],
  levelThreshold: number
): TableGroup[] {
  return [...tables]
    .sort((a, b) => b.averagePoints - a.averagePoints)
    .map((table, index) => ({
      ...table,
      tableNumber: index + 1,
      groupLevel: table.manualGroupOverride
        ? table.groupLevel
        : classifyTableLevel(table.averagePoints, levelThreshold),
    }));
}

/**
 * Generates table pairings according to mode (HOMOGENE | OPPOSITION_STYLES),
 * odd player handling (GROUPE_3 | PANIER_BALLES), and FFTT level threshold (default 700 pts).
 */
export function generatePairings(
  presentPlayers: readonly Player[],
  mode: PairingMode,
  oddMode: OddMode,
  levelThreshold = DEFAULT_LEVEL_THRESHOLD
): PairingResult {
  if (presentPlayers.length === 0) {
    return {
      tables: [],
      basketPlayer: null,
      mode,
      oddMode,
      levelThreshold,
    };
  }

  if (presentPlayers.length === 1) {
    const onlyPlayer = presentPlayers[0]!;
    if (oddMode === 'PANIER_BALLES') {
      return {
        tables: [],
        basketPlayer: onlyPlayer,
        mode,
        oddMode,
        levelThreshold,
      };
    }
    return {
      tables: [
        {
          tableNumber: 1,
          players: [onlyPlayer],
          averagePoints: onlyPlayer.pointsFftt,
          isBasket: false,
          isStyleOpposition: false,
          groupLevel: classifyTableLevel(onlyPlayer.pointsFftt, levelThreshold),
        },
      ],
      basketPlayer: null,
      mode,
      oddMode,
      levelThreshold,
    };
  }

  if (mode === 'HOMOGENE') {
    const sorted = sortByPointsDesc(presentPlayers);
    let oddPlayer: Player | null = null;
    let pool = sorted;

    if (sorted.length % 2 === 1) {
      const medianIdx = Math.floor(sorted.length / 2);
      oddPlayer = sorted[medianIdx] ?? null;
      pool = sorted.filter((_, idx) => idx !== medianIdx);
    }

    let tables = buildHomogeneousPairs(pool, levelThreshold);
    let basketPlayer: Player | null = null;

    if (oddPlayer) {
      if (oddMode === 'PANIER_BALLES') {
        basketPlayer = oddPlayer;
      } else {
        tables = attachMedianToClosestTable(tables, oddPlayer, levelThreshold);
      }
    }

    return {
      tables: renumberTables(tables, levelThreshold),
      basketPlayer,
      mode,
      oddMode,
      levelThreshold,
    };
  }

  // Mode 2: OPPOSITION_STYLES
  const sortedAll = sortByPointsDesc(presentPlayers);
  const specialPool = sortedAll.filter(hasSpecialRubber);
  const availableBs = sortedAll.filter(isBsOpponent);
  const usedIds = new Set<string>();
  let tables: TableGroup[] = [];

  for (const special of specialPool) {
    let bestIdx = -1;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (let i = 0; i < availableBs.length; i++) {
      const candidate = availableBs[i];
      if (!candidate || usedIds.has(candidate.id)) continue;
      const diff = Math.abs(special.pointsFftt - candidate.pointsFftt);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx !== -1) {
      const opponent = availableBs[bestIdx]!;
      usedIds.add(special.id);
      usedIds.add(opponent.id);
      const pair = sortByPointsDesc([special, opponent]);
      const averagePoints = computeAveragePoints(pair);
      tables.push({
        tableNumber: tables.length + 1,
        players: pair,
        averagePoints,
        isBasket: false,
        isStyleOpposition: true,
        groupLevel: classifyTableLevel(averagePoints, levelThreshold),
      });
    }
  }

  // Pair remaining players homogeneously
  const remaining = sortedAll.filter((p) => !usedIds.has(p.id));
  let oddPlayer: Player | null = null;
  let remainingEven = remaining;

  if (remaining.length % 2 === 1) {
    const medianIdx = Math.floor(remaining.length / 2);
    oddPlayer = remaining[medianIdx] ?? null;
    remainingEven = remaining.filter((_, idx) => idx !== medianIdx);
  }

  tables = [...tables, ...buildHomogeneousPairs(remainingEven, levelThreshold)];

  let basketPlayer: Player | null = null;
  if (oddPlayer) {
    if (oddMode === 'PANIER_BALLES') {
      basketPlayer = oddPlayer;
    } else {
      tables = attachMedianToClosestTable(tables, oddPlayer, levelThreshold);
    }
  }

  return {
    tables: renumberTables(tables, levelThreshold),
    basketPlayer,
    mode,
    oddMode,
    levelThreshold,
  };
}

/**
 * Re-classifies all tables when the FFTT level threshold slider changes
 * without losing manual player swaps.
 */
export function applyLevelThresholdToPairings(
  result: PairingResult,
  levelThreshold: number
): PairingResult {
  return {
    ...result,
    levelThreshold,
    tables: result.tables.map((table) => ({
      ...table,
      groupLevel: classifyTableLevel(table.averagePoints, levelThreshold),
      manualGroupOverride: false,
    })),
  };
}

/**
 * Manually toggles a single table between Groupe A (Confirmés) and Groupe B (Débutants).
 */
export function toggleTableGroupLevel(
  result: PairingResult,
  tableNumber: number
): PairingResult {
  return {
    ...result,
    tables: result.tables.map((table) => {
      if (table.tableNumber !== tableNumber) return table;
      const nextLevel: TableGroupLevel =
        table.groupLevel === 'Groupe A (Confirmés)'
          ? 'Groupe B (Débutants)'
          : 'Groupe A (Confirmés)';
      return {
        ...table,
        groupLevel: nextLevel,
        manualGroupOverride: true,
      };
    }),
  };
}

/**
 * Swaps two players anywhere in the pairing result (between tables, within a table,
 * or between a table and the Panier de balles slot) and recalculates averages & group levels.
 */
export function swapPlayersInPairings(
  result: PairingResult,
  playerIdA: string,
  playerIdB: string
): PairingResult {
  if (playerIdA === playerIdB) return result;

  type Location =
    | { kind: 'table'; tableIdx: number; playerIdx: number; player: Player }
    | { kind: 'basket'; player: Player };

  let locA: Location | null = null;
  let locB: Location | null = null;

  result.tables.forEach((table, tableIdx) => {
    table.players.forEach((player, playerIdx) => {
      if (player.id === playerIdA) {
        locA = { kind: 'table', tableIdx, playerIdx, player };
      } else if (player.id === playerIdB) {
        locB = { kind: 'table', tableIdx, playerIdx, player };
      }
    });
  });

  if (result.basketPlayer?.id === playerIdA) {
    locA = { kind: 'basket', player: result.basketPlayer };
  } else if (result.basketPlayer?.id === playerIdB) {
    locB = { kind: 'basket', player: result.basketPlayer };
  }

  if (!locA || !locB) return result;

  const foundA: Location = locA;
  const foundB: Location = locB;

  const nextTables = result.tables.map((table) => ({
    ...table,
    players: [...table.players],
  }));
  let nextBasket = result.basketPlayer;

  const placeAt = (loc: Location, incoming: Player) => {
    if (loc.kind === 'basket') {
      nextBasket = incoming;
    } else {
      const targetTable = nextTables[loc.tableIdx];
      if (targetTable) {
        targetTable.players[loc.playerIdx] = incoming;
      }
    }
  };

  placeAt(foundA, foundB.player);
  placeAt(foundB, foundA.player);

  const threshold = result.levelThreshold ?? DEFAULT_LEVEL_THRESHOLD;
  const recalculatedTables = nextTables.map((table) => {
    const averagePoints = computeAveragePoints(table.players);
    return {
      ...table,
      averagePoints,
      isStyleOpposition: isTableStyleOpposition(table.players),
      groupLevel: table.manualGroupOverride
        ? table.groupLevel
        : classifyTableLevel(averagePoints, threshold),
    };
  });

  return {
    ...result,
    tables: recalculatedTables,
    basketPlayer: nextBasket,
  };
}
