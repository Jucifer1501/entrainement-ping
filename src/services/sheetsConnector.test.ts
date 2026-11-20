import { describe, expect, it } from 'vitest';
import {
  computeNextCode,
  findFirstFreeRow,
  normalizeSheetDate,
  parseExerciseBankRows,
  parsePlayersRows,
  parseSessionRows,
} from './sheetsConnector';

describe('sheetsConnector parsers & range helpers', () => {
  it('parses Banque Exo with interleaved Axis headers and trailing Picot Memo block without mixing them', () => {
    // Simulated A6:H15 rows
    const rawRows: string[][] = [
      ['AXE 1 : Régularité'], // row 6
      ['EXO-001', 'AXE 1 : Régularité', 'Falkenberg', 'Appuis', 'Consigne 1', 'Oui', 'Adapté', '3'], // row 7
      ['EXO-002', 'AXE 1 : Régularité', 'Diagonale', 'Contrôle', 'Consigne 2', 'Possible', 'Adapté', '1'], // row 8
      ['MATCHS & SITUATIONS DE JEU'], // row 9
      ['EXO-003', 'MATCHS & SITUATIONS DE JEU', 'Départ 6-6', 'Tactique', 'Consigne 3', 'Non adapté', 'Adapté', '5'], // row 10
      [], // row 11
      ['💡 MÉMO TECHNIQUE & CONSEILS PICOT'], // row 12
      ['Inversion', 'Un topspin saucé revient coupé.'], // row 13
      ['Service mou', 'Priver le picot d’effet.'], // row 14
    ];

    const bank = parseExerciseBankRows(rawRows);

    expect(bank.exercises).toHaveLength(3);
    expect(bank.exercises[0]?.rowIndex).toBe(7);
    expect(bank.exercises[2]?.rowIndex).toBe(10);
    expect(bank.axisLastRow['AXE 1 : Régularité']).toBe(8);
    expect(bank.axisLastRow['MATCHS & SITUATIONS DE JEU']).toBe(10);
    expect(bank.memoStartRow).toBe(12);
    expect(bank.picotMemos).toHaveLength(2);
    expect(bank.picotMemos[0]?.title).toBe('Inversion');
    expect(bank.picotMemos[1]?.content).toBe('Priver le picot d’effet.');
  });

  it('parses Profils joueurs from B4:I100 with accurate 1-based rowIndex', () => {
    const rawRows: string[][] = [
      ['J-001', 'Julien', '1450', 'BS', 'Picot long', 'Crabe', '12', 'Oui'],
      ['J-002', 'Sophie', '1020', 'BS', 'Anti-top', 'Défense', '7', 'Non'],
    ];
    const players = parsePlayersRows(rawRows);
    expect(players).toHaveLength(2);
    expect(players[0]?.rowIndex).toBe(4);
    expect(players[0]?.backhandRubber).toBe('Picot long');
    expect(players[1]?.rowIndex).toBe(5);
    expect(players[1]?.active).toBe('Non');
  });

  it('computes first free row safely for Séances!B7:I500 and increments IDs', () => {
    expect(findFirstFreeRow([], 7)).toBe(7);
    expect(findFirstFreeRow([['2026-11-10', '1'], ['2026-11-10', '2']], 7)).toBe(9);
    expect(computeNextCode(['J-001', 'J-009', 'J-003'], 'J')).toBe('J-010');
    expect(computeNextCode(['EXO-012', 'EXO-004'], 'EXO')).toBe('EXO-013');
  });

  it('parses Séances rows including comma-separated participants and ID_Session', () => {
    const rows = parseSessionRows([
      [
        '2026-11-20',
        '1',
        'AXE 1',
        'Falkenberg',
        '20',
        'Bon rythme',
        'Julien, Thomas, Camille',
        'SESS-20261120-ABCD',
      ],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowIndex).toBe(7);
    expect(rows[0]?.participants).toEqual(['Julien', 'Thomas', 'Camille']);
    expect(rows[0]?.sessionId).toBe('SESS-20261120-ABCD');
  });

  it('handles emoji-prefixed axis headers, French dates, Excel serial dates, and spaced FFTT points', () => {
    const bank = parseExerciseBankRows([
      ['🎯 AXE 1 : RÉGULARITÉ'],
      ['EXO-001', 'AXE 1 : RÉGULARITÉ', 'Gamme CD', 'Placement', 'Consignes', 'Oui', 'Adapté', '2'],
      ['🏓 MATCHS & SITUATIONS DE JEU'],
      ['EXO-002', 'MATCHS & SITUATIONS DE JEU', 'Set 6-6', 'Tactique', 'Consignes', 'Non adapté', 'Adapté', '4'],
    ]);
    expect(bank.exercises).toHaveLength(2);
    expect(bank.axisLastRow['🎯 AXE 1 : RÉGULARITÉ']).toBe(7);
    expect(bank.axisLastRow['🏓 MATCHS & SITUATIONS DE JEU']).toBe(9);

    const players = parsePlayersRows([
      ['J-001', 'Marc', '1 420 pts', 'BS', 'Picot long', 'Défense', '10', 'Oui'],
    ]);
    expect(players[0]?.pointsFftt).toBe(1420);

    expect(normalizeSheetDate('20/11/2026')).toBe('2026-11-20');
    expect(normalizeSheetDate('2026-11-20')).toBe('2026-11-20');
    expect(normalizeSheetDate(46346)).toBe('2026-11-20');

    // Pre-filled formula/default columns (e.g. col H = 0, col I = "Oui") should not block findFirstFreeRow
    const rowsWithPreFilledFormulas: unknown[][] = [
      ['J-001', 'Marc', 1400, 'BS', 'BS', '', 5, 'Oui'],
      ['', '', '', '', '', '', 0, 'Oui'],
      ['', '', '', '', '', '', 0, 'Oui'],
    ];
    expect(findFirstFreeRow(rowsWithPreFilledFormulas, 4, [0, 1])).toBe(5);
  });
});
