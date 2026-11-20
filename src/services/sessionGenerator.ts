import type {
  Exercise,
  PicotCompatibility,
  PreparationItem,
  SessionDurationPreset,
} from '@/types';

export interface SessionGeneratorOptions {
  picotActive: boolean;
  includePicotSpecificWhenInactive?: boolean;
  preferBasket?: boolean;
  date?: string;
}

const DURATION_TEMPLATES: Record<SessionDurationPreset, number[]> = {
  60: [15, 15, 15, 15],
  90: [15, 20, 20, 15, 20],
  120: [15, 20, 20, 20, 20, 25],
};

function picotScore(
  compatibility: PicotCompatibility,
  picotActive: boolean
): number {
  if (!picotActive) return 0;
  switch (compatibility) {
    case 'Spécifique Picot':
      return 3;
    case 'Adapté':
      return 2;
    case 'À adapter':
      return 1;
    case 'Non adapté':
      return -2;
  }
}

function basketScore(
  suitability: Exercise['basketSuitability'],
  preferBasket: boolean
): number {
  if (!preferBasket) return 0;
  switch (suitability) {
    case 'Oui':
      return 2;
    case 'Possible':
      return 1;
    case 'Non adapté':
      return -1;
  }
}

function isMatchAxis(axis: string): boolean {
  const lower = axis.toLowerCase();
  return (
    lower.includes('match') ||
    lower.includes('situation') ||
    lower.includes('jeu libre') ||
    lower.includes('compétition')
  );
}

function isWarmupAxis(axis: string): boolean {
  const lower = axis.toLowerCase();
  return (
    lower.includes('axe 1') ||
    lower.includes('échauffement') ||
    lower.includes('régularité') ||
    lower.includes('placement') ||
    lower.includes('gamme')
  );
}

function formatTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generates a balanced session plan matching the requested duration preset (60 / 90 / 120 min),
 * balanced across distinct training Axes and prioritizing least-practiced exercises.
 */
export function generateSessionPlan(
  exercises: readonly Exercise[],
  durationPreset: SessionDurationPreset,
  options: SessionGeneratorOptions
): PreparationItem[] {
  if (exercises.length === 0) return [];

  const {
    picotActive,
    includePicotSpecificWhenInactive = false,
    preferBasket = false,
    date = formatTodayIso(),
  } = options;

  // Step 1: Filter candidates according to Picot context
  let candidates = exercises.filter((exo) => {
    if (!picotActive && !includePicotSpecificWhenInactive) {
      return exo.picotCompatibility !== 'Spécifique Picot';
    }
    if (picotActive) {
      return exo.picotCompatibility !== 'Non adapté';
    }
    return true;
  });

  if (candidates.length === 0) {
    candidates = [...exercises];
  }

  // Step 2: Sort candidates inside each Axis by least practiced + Picot/Basket affinity
  const sortCandidates = (list: readonly Exercise[]): Exercise[] =>
    [...list].sort((a, b) => {
      // Strong priority on least practiced (nbRealises ascending)
      // When Picot is active, slightly favor Picot-friendly exercises on equal/close usage
      const scoreA =
        a.nbRealises -
        picotScore(a.picotCompatibility, picotActive) * 0.6 -
        basketScore(a.basketSuitability, preferBasket) * 0.4;
      const scoreB =
        b.nbRealises -
        picotScore(b.picotCompatibility, picotActive) * 0.6 -
        basketScore(b.basketSuitability, preferBasket) * 0.4;

      if (Math.abs(scoreA - scoreB) > 0.001) {
        return scoreA - scoreB;
      }
      if (a.nbRealises !== b.nbRealises) {
        return a.nbRealises - b.nbRealises;
      }
      return a.id.localeCompare(b.id);
    });

  // Group by axis
  const axisMap = new Map<string, Exercise[]>();
  for (const exo of candidates) {
    const key = exo.axis.trim() || 'Général';
    const existing = axisMap.get(key) ?? [];
    existing.push(exo);
    axisMap.set(key, existing);
  }

  for (const [axis, list] of axisMap.entries()) {
    axisMap.set(axis, sortCandidates(list));
  }

  // Order axes so warmup-like axes come first, technical axes in the middle, match axes last
  const orderedAxes = Array.from(axisMap.keys()).sort((a, b) => {
    const rank = (ax: string) => {
      if (isWarmupAxis(ax)) return 0;
      if (isMatchAxis(ax)) return 2;
      return 1;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b, 'fr');
  });

  const template = DURATION_TEMPLATES[durationPreset];
  const targetSlots = Math.min(template.length, candidates.length);
  const selected: Exercise[] = [];
  const usedKeys = new Set<string>();
  const keyOf = (exo: Exercise) => `${exo.id}-${exo.rowIndex}`;

  // Guarantee at least one Spécifique Picot exercise if picotActive and available
  if (picotActive) {
    const picotSpecific = sortCandidates(
      candidates.filter((e) => e.picotCompatibility === 'Spécifique Picot')
    );
    const topPicot = picotSpecific[0];
    if (topPicot) {
      selected.push(topPicot);
      usedKeys.add(keyOf(topPicot));
    }
  }

  // Round-robin across axes so every axis is represented before repeating any axis
  let safetyCounter = 0;
  while (selected.length < targetSlots && safetyCounter < 50) {
    safetyCounter++;
    let addedInPass = false;

    for (const axis of orderedAxes) {
      if (selected.length >= targetSlots) break;
      const list = axisMap.get(axis) ?? [];
      const nextExo = list.find((exo) => !usedKeys.has(keyOf(exo)));
      if (nextExo) {
        selected.push(nextExo);
        usedKeys.add(keyOf(nextExo));
        addedInPass = true;
      }
    }

    if (!addedInPass) break;
  }

  // Reorder selected exercises into coaching progression: warmup -> technical -> match
  const progressed = [...selected].sort((a, b) => {
    const rank = (exo: Exercise) => {
      if (isWarmupAxis(exo.axis)) return 0;
      if (isMatchAxis(exo.axis)) return 2;
      return 1;
    };
    return rank(a) - rank(b);
  });

  // Allocate exact durations summing to durationPreset
  const durations = allocateExactDurations(durationPreset, progressed.length);

  return progressed.map((exo, idx) => ({
    localId: `prep-${exo.id}-${exo.rowIndex}-${idx + 1}`,
    date,
    order: idx + 1,
    axis: exo.axis,
    exerciseName: exo.name,
    durationMin: durations[idx] ?? 15,
    objectives: exo.technicalFocus
      ? `${exo.technicalFocus}${exo.description ? ` — ${exo.description}` : ''}`
      : exo.description,
    exerciseId: exo.id,
  }));
}

function allocateExactDurations(
  totalMinutes: SessionDurationPreset,
  slotCount: number
): number[] {
  const template = DURATION_TEMPLATES[totalMinutes];
  if (slotCount === template.length) {
    return [...template];
  }
  if (slotCount <= 0) return [];
  if (slotCount === 1) return [totalMinutes];

  // Distribute in clean 5-minute increments summing exactly to totalMinutes
  const base = Math.floor(totalMinutes / slotCount / 5) * 5;
  const safeBase = Math.max(5, base);
  const result = Array.from({ length: slotCount }, () => safeBase);
  let remainder = totalMinutes - safeBase * slotCount;

  // Add remaining minutes from the end (longer match / core blocks)
  let idx = slotCount - 1;
  while (remainder > 0) {
    const step = remainder >= 5 ? 5 : remainder;
    result[idx] = (result[idx] ?? 0) + step;
    remainder -= step;
    idx = idx === 0 ? slotCount - 1 : idx - 1;
  }

  return result;
}
