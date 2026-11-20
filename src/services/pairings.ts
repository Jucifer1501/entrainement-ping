import type {
  OddMode,
  PairingMode,
  PairingResult,
  Player,
  RubberType,
  TableGroup,
} from '@/types';

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

function buildHomogeneousPairs(sortedDesc: readonly Player[]): TableGroup[] {
  const groups: TableGroup[] = [];
  for (let i = 0; i + 1 < sortedDesc.length; i += 2) {
    const p1 = sortedDesc[i];
    const p2 = sortedDesc[i + 1];
    if (p1 && p2) {
      const pair = [p1, p2];
      groups.push({
        tableNumber: groups.length + 1,
        players: pair,
        averagePoints: computeAveragePoints(pair),
        isBasket: false,
        isStyleOpposition: isTableStyleOpposition(pair),
      });
    }
  }
  return groups;
}

function attachMedianToClosestTable(
  tables: TableGroup[],
  medianPlayer: Player
): TableGroup[] {
  if (tables.length === 0) {
    return [
      {
        tableNumber: 1,
        players: [medianPlayer],
        averagePoints: medianPlayer.pointsFftt,
        isBasket: false,
        isStyleOpposition: false,
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
    return {
      ...table,
      players: updatedPlayers,
      averagePoints: computeAveragePoints(updatedPlayers),
      isStyleOpposition: isTableStyleOpposition(updatedPlayers),
    };
  });
}

function renumberTables(tables: TableGroup[]): TableGroup[] {
  return [...tables]
    .sort((a, b) => b.averagePoints - a.averagePoints)
    .map((table, index) => ({
      ...table,
      tableNumber: index + 1,
    }));
}

/**
 * Generates table pairings according to mode (HOMOGENE | OPPOSITION_STYLES)
 * and odd player handling (GROUPE_3 | PANIER_BALLES).
 */
export function generatePairings(
  presentPlayers: readonly Player[],
  mode: PairingMode,
  oddMode: OddMode
): PairingResult {
  if (presentPlayers.length === 0) {
    return { tables: [], basketPlayer: null, mode, oddMode };
  }

  if (presentPlayers.length === 1) {
    const onlyPlayer = presentPlayers[0]!;
    if (oddMode === 'PANIER_BALLES') {
      return {
        tables: [],
        basketPlayer: onlyPlayer,
        mode,
        oddMode,
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
        },
      ],
      basketPlayer: null,
      mode,
      oddMode,
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

    let tables = buildHomogeneousPairs(pool);
    let basketPlayer: Player | null = null;

    if (oddPlayer) {
      if (oddMode === 'PANIER_BALLES') {
        basketPlayer = oddPlayer;
      } else {
        tables = attachMedianToClosestTable(tables, oddPlayer);
      }
    }

    return {
      tables: renumberTables(tables),
      basketPlayer,
      mode,
      oddMode,
    };
  }

  // Mode 2: OPPOSITION_STYLES
  // Step 1: Match players with Picot long / Anti-top against closest-rated BS players
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
      tables.push({
        tableNumber: tables.length + 1,
        players: pair,
        averagePoints: computeAveragePoints(pair),
        isBasket: false,
        isStyleOpposition: true,
      });
    }
  }

  // Step 2: Pair remaining players homogeneously
  const remaining = sortedAll.filter((p) => !usedIds.has(p.id));
  let oddPlayer: Player | null = null;
  let remainingEven = remaining;

  if (remaining.length % 2 === 1) {
    const medianIdx = Math.floor(remaining.length / 2);
    oddPlayer = remaining[medianIdx] ?? null;
    remainingEven = remaining.filter((_, idx) => idx !== medianIdx);
  }

  tables = [...tables, ...buildHomogeneousPairs(remainingEven)];

  let basketPlayer: Player | null = null;
  if (oddPlayer) {
    if (oddMode === 'PANIER_BALLES') {
      basketPlayer = oddPlayer;
    } else {
      tables = attachMedianToClosestTable(tables, oddPlayer);
    }
  }

  return {
    tables: renumberTables(tables),
    basketPlayer,
    mode,
    oddMode,
  };
}

/**
 * Swaps two players anywhere in the pairing result (between tables, within a table,
 * or between a table and the Panier de balles slot).
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

  const recalculatedTables = nextTables.map((table) => ({
    ...table,
    averagePoints: computeAveragePoints(table.players),
    isStyleOpposition: isTableStyleOpposition(table.players),
  }));

  return {
    ...result,
    tables: recalculatedTables,
    basketPlayer: nextBasket,
  };
}
