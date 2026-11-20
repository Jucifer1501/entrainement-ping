import { describe, expect, it } from 'vitest';
import { generateSessionPlan } from './sessionGenerator';
import { SEED_EXERCISE_BANK } from './seedData';
import type { SessionDurationPreset } from '@/types';

describe('sessionGenerator service', () => {
  it.each([60, 90, 120] as SessionDurationPreset[])(
    'generates an exact %d-minute session plan balanced across axes',
    (preset) => {
      const plan = generateSessionPlan(SEED_EXERCISE_BANK.exercises, preset, {
        picotActive: true,
        date: '2026-11-20',
      });

      const total = plan.reduce((sum, item) => sum + item.durationMin, 0);
      expect(total).toBe(preset);
      expect(plan.length).toBeGreaterThanOrEqual(4);

      // Should cover at least 4 distinct axes
      const distinctAxes = new Set(plan.map((p) => p.axis));
      expect(distinctAxes.size).toBeGreaterThanOrEqual(4);

      // Orders should be sequential 1..N
      expect(plan.map((p) => p.order)).toEqual(
        plan.map((_, i) => i + 1)
      );
    }
  );

  it('includes Spécifique Picot and excludes Non adapté when picotActive is true', () => {
    const plan = generateSessionPlan(SEED_EXERCISE_BANK.exercises, 90, {
      picotActive: true,
    });

    const byId = new Map(
      SEED_EXERCISE_BANK.exercises.map((e) => [e.id, e])
    );

    const compatibilities = plan.map(
      (item) => byId.get(item.exerciseId)?.picotCompatibility
    );

    expect(compatibilities).toContain('Spécifique Picot');
    expect(compatibilities).not.toContain('Non adapté');
  });

  it('excludes Spécifique Picot by default when picotActive is false', () => {
    const plan = generateSessionPlan(SEED_EXERCISE_BANK.exercises, 90, {
      picotActive: false,
    });

    const byId = new Map(
      SEED_EXERCISE_BANK.exercises.map((e) => [e.id, e])
    );

    const compatibilities = plan.map(
      (item) => byId.get(item.exerciseId)?.picotCompatibility
    );
    expect(compatibilities).not.toContain('Spécifique Picot');
  });

  it('places warmup axis first and Matchs & Situations de jeu at the end', () => {
    const plan = generateSessionPlan(SEED_EXERCISE_BANK.exercises, 90, {
      picotActive: false,
    });

    expect(plan[0]?.axis.toLowerCase()).toContain('axe 1');
    expect(plan[plan.length - 1]?.axis.toLowerCase()).toContain('match');
  });

  it('prioritizes least-practiced exercises within each axis', () => {
    const plan = generateSessionPlan(SEED_EXERCISE_BANK.exercises, 60, {
      picotActive: false,
    });

    // In AXE 1, EXO-002 has nbRealises=2 vs EXO-001 nbRealises=4 -> EXO-002 should be picked first
    const axe1Item = plan.find((p) => p.axis.includes('AXE 1'));
    expect(axe1Item?.exerciseId).toBe('EXO-002');
  });

  it('still sums to exact target duration even when exercise bank is small', () => {
    const tinyBank = SEED_EXERCISE_BANK.exercises.slice(0, 2);
    const plan = generateSessionPlan(tinyBank, 90, { picotActive: false });
    const total = plan.reduce((sum, item) => sum + item.durationMin, 0);
    expect(total).toBe(90);
    expect(plan).toHaveLength(2);
  });
});
