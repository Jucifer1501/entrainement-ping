import { describe, expect, it } from 'vitest';
import {
  generatePairings,
  hasSpecialRubber,
  swapPlayersInPairings,
} from './pairings';
import type { Player, RubberType } from '@/types';

function makePlayer(
  id: string,
  name: string,
  pointsFftt: number,
  forehandRubber: RubberType = 'BS',
  backhandRubber: RubberType = 'BS'
): Player {
  return {
    rowIndex: 4,
    id,
    name,
    pointsFftt,
    forehandRubber,
    backhandRubber,
    playStyle: '',
    participations: 0,
    active: 'Oui',
  };
}

describe('pairings service', () => {
  it('pairs even players homogeneously by descending FFTT points', () => {
    const players = [
      makePlayer('J-001', 'A', 900),
      makePlayer('J-002', 'B', 1500),
      makePlayer('J-003', 'C', 1100),
      makePlayer('J-004', 'D', 1450),
    ];

    const result = generatePairings(players, 'HOMOGENE', 'GROUPE_3');

    expect(result.basketPlayer).toBeNull();
    expect(result.tables).toHaveLength(2);
    expect(result.tables[0]?.players.map((p) => p.id)).toEqual([
      'J-002',
      'J-004',
    ]);
    expect(result.tables[0]?.averagePoints).toBe(1475);
    expect(result.tables[1]?.players.map((p) => p.id)).toEqual([
      'J-003',
      'J-001',
    ]);
    expect(result.tables[1]?.averagePoints).toBe(1000);
  });

  it('handles odd players in GROUPE_3 by attaching the median player to the table with closest FFTT average', () => {
    // Sorted desc: 1600, 1550, 1180 (median), 1150, 1100
    // Remaining pairs: Table A (1600, 1550 -> avg 1575), Table B (1150, 1100 -> avg 1125)
    // Median 1180 is much closer to 1125 than 1575 -> attaches to Table B
    const players = [
      makePlayer('J-001', 'P1', 1600),
      makePlayer('J-002', 'P2', 1550),
      makePlayer('J-003', 'Median', 1180),
      makePlayer('J-004', 'P4', 1150),
      makePlayer('J-005', 'P5', 1100),
    ];

    const result = generatePairings(players, 'HOMOGENE', 'GROUPE_3');

    expect(result.basketPlayer).toBeNull();
    expect(result.tables).toHaveLength(2);
    expect(result.tables[0]?.players.map((p) => p.id)).toEqual([
      'J-001',
      'J-002',
    ]);
    expect(result.tables[1]?.players.map((p) => p.id)).toEqual([
      'J-003',
      'J-004',
      'J-005',
    ]);
    expect(result.tables[1]?.averagePoints).toBe(Math.round((1180 + 1150 + 1100) / 3));
  });

  it('handles odd players in PANIER_BALLES by assigning median player to basket slot', () => {
    const players = [
      makePlayer('J-001', 'Top1', 1500),
      makePlayer('J-002', 'Top2', 1400),
      makePlayer('J-003', 'Mid', 1200),
      makePlayer('J-004', 'Low1', 900),
      makePlayer('J-005', 'Low2', 850),
    ];

    const result = generatePairings(players, 'HOMOGENE', 'PANIER_BALLES');

    expect(result.basketPlayer?.id).toBe('J-003');
    expect(result.tables).toHaveLength(2);
    expect(result.tables[0]?.players.map((p) => p.id)).toEqual([
      'J-001',
      'J-002',
    ]);
    expect(result.tables[1]?.players.map((p) => p.id)).toEqual([
      'J-004',
      'J-005',
    ]);
  });

  it('matches Picot long and Anti-top players against closest BS players in OPPOSITION_STYLES mode', () => {
    const players = [
      makePlayer('J-001', 'BS_Strong', 1500, 'BS', 'BS'),
      makePlayer('J-002', 'Picot_1', 1320, 'BS', 'Picot long'),
      makePlayer('J-003', 'BS_Close1', 1300, 'BS', 'BS'),
      makePlayer('J-004', 'Anti_1', 1050, 'BS', 'Anti-top'),
      makePlayer('J-005', 'BS_Close2', 1020, 'BS', 'BS'),
      makePlayer('J-006', 'BS_Low', 800, 'BS', 'BS'),
    ];

    const result = generatePairings(players, 'OPPOSITION_STYLES', 'GROUPE_3');

    expect(result.tables).toHaveLength(3);

    const picotTable = result.tables.find((t) =>
      t.players.some((p) => p.id === 'J-002')
    );
    expect(picotTable?.players.map((p) => p.id).sort()).toEqual([
      'J-002',
      'J-003',
    ]);
    expect(picotTable?.isStyleOpposition).toBe(true);

    const antiTable = result.tables.find((t) =>
      t.players.some((p) => p.id === 'J-004')
    );
    expect(antiTable?.players.map((p) => p.id).sort()).toEqual([
      'J-004',
      'J-005',
    ]);
    expect(antiTable?.isStyleOpposition).toBe(true);

    // Remaining two BS players paired together
    const remainingTable = result.tables.find((t) =>
      t.players.some((p) => p.id === 'J-001')
    );
    expect(remainingTable?.players.map((p) => p.id).sort()).toEqual([
      'J-001',
      'J-006',
    ]);
    expect(remainingTable?.isStyleOpposition).toBe(false);
  });

  it('swaps players cleanly between tables and basket slot and recalculates averages', () => {
    const players = [
      makePlayer('J-001', 'A', 1500, 'BS', 'BS'),
      makePlayer('J-002', 'B', 1400, 'BS', 'BS'),
      makePlayer('J-003', 'C', 1100, 'BS', 'Picot long'),
      makePlayer('J-004', 'D', 900, 'BS', 'BS'),
      makePlayer('J-005', 'E', 800, 'BS', 'BS'),
    ];

    const initial = generatePairings(players, 'HOMOGENE', 'PANIER_BALLES');
    expect(initial.basketPlayer?.id).toBe('J-003');

    // Swap J-001 (table 1) with J-003 (basket)
    const swapped = swapPlayersInPairings(initial, 'J-001', 'J-003');
    expect(swapped.basketPlayer?.id).toBe('J-001');
    expect(swapped.tables[0]?.players.map((p) => p.id)).toEqual([
      'J-003',
      'J-002',
    ]);
    expect(swapped.tables[0]?.averagePoints).toBe(1250);
    expect(swapped.tables[0]?.isStyleOpposition).toBe(true);
  });

  it('detects special rubbers on either forehand or backhand', () => {
    expect(hasSpecialRubber(makePlayer('1', 'A', 1000, 'Picot long', 'BS'))).toBe(
      true
    );
    expect(hasSpecialRubber(makePlayer('2', 'B', 1000, 'BS', 'Anti-top'))).toBe(
      true
    );
    expect(hasSpecialRubber(makePlayer('3', 'C', 1000, 'BS', 'Soft'))).toBe(
      false
    );
  });

  it('handles 0 and 1 player edge cases safely', () => {
    expect(generatePairings([], 'HOMOGENE', 'GROUPE_3').tables).toEqual([]);
    const single = [makePlayer('J-001', 'Solo', 1000)];
    expect(
      generatePairings(single, 'HOMOGENE', 'PANIER_BALLES').basketPlayer?.id
    ).toBe('J-001');
    expect(
      generatePairings(single, 'HOMOGENE', 'GROUPE_3').tables[0]?.players
    ).toHaveLength(1);
  });
});
