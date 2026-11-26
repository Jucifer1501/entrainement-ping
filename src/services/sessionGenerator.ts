import type {
  Exercise,
  GroupeCible,
  NiveauCible,
  PicotCompatibility,
  PreparationItem,
  SessionDurationPreset,
  SessionSlot,
} from '@/types';

export interface SessionGeneratorOptions {
  picotActive: boolean;
  includePicotSpecificWhenInactive?: boolean;
  preferBasket?: boolean;
  differentiateByLevel?: boolean;
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

function levelAffinityScore(
  niveau: NiveauCible | undefined,
  targetGroup: 'A' | 'B'
): number {
  const n = niveau ?? 'Tous niveaux';
  if (targetGroup === 'A') {
    // Groupe A (Confirmés) prefers Confirmé > Intermédiaire > Tous niveaux > Débutant
    switch (n) {
      case 'Confirmé':
        return 4;
      case 'Intermédiaire':
        return 2;
      case 'Tous niveaux':
        return 1;
      case 'Débutant':
        return -3;
    }
  }
  // Groupe B (Débutants) prefers Débutant > Tous niveaux / Intermédiaire > Confirmé
  switch (n) {
    case 'Débutant':
      return 4;
    case 'Tous niveaux':
      return 2;
    case 'Intermédiaire':
      return 1;
    case 'Confirmé':
      return -3;
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

/**
 * Axes 2, 3, 4, 5 (and any non-warmup / non-match technical axis) are eligible
 * for multi-level differentiation (Groupe A Confirmés + Groupe B Débutants).
 */
export function isTechnicalDifferentiableAxis(axis: string): boolean {
  const lower = axis.toLowerCase();
  if (/axe\s*[2345]\b/.test(lower)) return true;
  if (isWarmupAxis(axis) || isMatchAxis(axis)) return false;
  return true;
}

function formatTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildPrepItem(
  exo: Exercise,
  order: number,
  durationMin: number,
  date: string,
  groupeCible: GroupeCible,
  suffix = ''
): PreparationItem {
  return {
    localId: `prep-${exo.id}-${exo.rowIndex}-${order}${suffix}`,
    date,
    order,
    axis: exo.axis,
    exerciseName: exo.name,
    durationMin,
    objectives: exo.technicalFocus
      ? `${exo.technicalFocus}${exo.description ? ` — ${exo.description}` : ''}`
      : exo.description,
    exerciseId: exo.id,
    groupeCible,
  };
}

/**
 * Groups flat PreparationItem[] rows (from 'Préparation'!B7:I35) into logical synchronized
 * time slots sharing the same `order` (N°).
 */
export function groupPreparationIntoSlots(
  items: readonly PreparationItem[]
): SessionSlot[] {
  if (items.length === 0) return [];

  const slots: SessionSlot[] = [];
  const slotByOrder = new Map<number, SessionSlot>();

  for (const item of items) {
    const order = item.order > 0 ? item.order : slots.length + 1;
    const groupe = item.groupeCible ?? 'Tous';
    const existing = slotByOrder.get(order);

    if (
      existing &&
      (groupe !== 'Tous' || existing.items.some((i) => (i.groupeCible ?? 'Tous') !== 'Tous'))
    ) {
      existing.items.push(item);
      if (groupe === 'Groupe A (Confirmés)') existing.groupA = item;
      else if (groupe === 'Groupe B (Débutants)') existing.groupB = item;
      existing.isDifferentiated =
        existing.items.length > 1 ||
        existing.groupA !== null ||
        existing.groupB !== null;
    } else {
      const slot: SessionSlot = {
        order,
        durationMin: item.durationMin,
        items: [item],
        isDifferentiated: groupe !== 'Tous',
        groupA: groupe === 'Groupe A (Confirmés)' ? item : null,
        groupB: groupe === 'Groupe B (Débutants)' ? item : null,
      };
      slots.push(slot);
      slotByOrder.set(order, slot);
    }
  }

  return slots;
}

/**
 * Flattens logical slots back into sequential PreparationItem[] with clean 1..N slot orders.
 */
export function flattenSlotsToPreparation(
  slots: readonly SessionSlot[]
): PreparationItem[] {
  const result: PreparationItem[] = [];
  slots.forEach((slot, idx) => {
    const slotOrder = idx + 1;
    for (const item of slot.items) {
      result.push({
        ...item,
        order: slotOrder,
        durationMin: slot.durationMin,
      });
    }
  });
  return result;
}

/**
 * Generates a balanced session plan matching the requested duration preset (60 / 90 / 120 min),
 * balanced across distinct training Axes and prioritizing least-practiced exercises.
 * When `differentiateByLevel` is enabled, technical axes (Axes 2, 3, 4, 5) produce paired
 * Groupe A (Confirmés) + Groupe B (Débutants) blocks sharing the exact same timed slot.
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
    differentiateByLevel = false,
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

  // Step 2: Sort candidates inside each Axis
  const sortCandidates = (
    list: readonly Exercise[],
    targetGroup?: 'A' | 'B'
  ): Exercise[] =>
    [...list].sort((a, b) => {
      const levelBoostA = targetGroup
        ? levelAffinityScore(a.niveauCible, targetGroup) * 1.2
        : 0;
      const levelBoostB = targetGroup
        ? levelAffinityScore(b.niveauCible, targetGroup) * 1.2
        : 0;

      const scoreA =
        a.nbRealises -
        picotScore(a.picotCompatibility, picotActive) * 0.6 -
        basketScore(a.basketSuitability, preferBasket) * 0.4 -
        levelBoostA;
      const scoreB =
        b.nbRealises -
        picotScore(b.picotCompatibility, picotActive) * 0.6 -
        basketScore(b.basketSuitability, preferBasket) * 0.4 -
        levelBoostB;

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

  // Order axes: warmup -> technical -> match
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
  const coveredAxesInPass = new Set<string>();
  const keyOf = (exo: Exercise) => `${exo.id}-${exo.rowIndex}`;

  // Guarantee at least one Spécifique Picot exercise if picotActive and available
  if (picotActive) {
    const picotSpecific = sortCandidates(
      candidates.filter((e) => e.picotCompatibility === 'Spécifique Picot'),
      differentiateByLevel ? 'A' : undefined
    );
    const topPicot = picotSpecific[0];
    if (topPicot) {
      selected.push(topPicot);
      usedKeys.add(keyOf(topPicot));
      coveredAxesInPass.add(topPicot.axis.trim() || 'Général');
    }
  }

  // Round-robin across axes so every axis (including Matchs) is represented before repeating any axis
  let safetyCounter = 0;
  while (selected.length < targetSlots && safetyCounter < 50) {
    safetyCounter++;
    let addedInPass = false;

    for (const axis of orderedAxes) {
      if (selected.length >= targetSlots) break;
      if (safetyCounter === 1 && coveredAxesInPass.has(axis)) continue;
      const rawList = axisMap.get(axis) ?? [];
      const list =
        differentiateByLevel && isTechnicalDifferentiableAxis(axis)
          ? sortCandidates(rawList, 'A')
          : rawList;
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

  // Allocate exact durations summing to durationPreset across the timed slots
  const durations = allocateExactDurations(durationPreset, progressed.length);

  if (!differentiateByLevel) {
    return progressed.map((exo, idx) =>
      buildPrepItem(exo, idx + 1, durations[idx] ?? 15, date, 'Tous')
    );
  }

  // Differentiated mode: expand technical axes (Axes 2, 3, 4, 5) into paired Groupe A & Groupe B rows
  const items: PreparationItem[] = [];
  const usedForB = new Set<string>(progressed.map(keyOf));

  progressed.forEach((primaryExo, idx) => {
    const slotOrder = idx + 1;
    const durationMin = durations[idx] ?? 15;

    if (!isTechnicalDifferentiableAxis(primaryExo.axis)) {
      items.push(
        buildPrepItem(primaryExo, slotOrder, durationMin, date, 'Tous')
      );
      return;
    }

    // Pick a distinct companion exercise for the complementary level group
    const companionTarget: 'A' | 'B' =
      (primaryExo.niveauCible ?? 'Tous niveaux') === 'Débutant' ? 'A' : 'B';

    const sameAxisPool = sortCandidates(
      (axisMap.get(primaryExo.axis) ?? []).filter(
        (e) => keyOf(e) !== keyOf(primaryExo)
      ),
      companionTarget
    );
    const sameAxisFresh = sameAxisPool.find((e) => !usedForB.has(keyOf(e)));

    const otherTechPool = sortCandidates(
      candidates.filter(
        (e) =>
          keyOf(e) !== keyOf(primaryExo) &&
          isTechnicalDifferentiableAxis(e.axis)
      ),
      companionTarget
    );
    const otherTechFresh = otherTechPool.find((e) => !usedForB.has(keyOf(e)));

    const groupBExo =
      sameAxisFresh ?? sameAxisPool[0] ?? otherTechFresh ?? otherTechPool[0];

    if (!groupBExo) {
      // Bank only has 1 exercise total — keep unified 'Tous'
      items.push(
        buildPrepItem(primaryExo, slotOrder, durationMin, date, 'Tous')
      );
      return;
    }

    usedForB.add(keyOf(groupBExo));

    // Ensure the more advanced of the two goes to Groupe A and more accessible to Groupe B
    const scorePrimaryAsA = levelAffinityScore(primaryExo.niveauCible, 'A');
    const scoreSecondaryAsA = levelAffinityScore(groupBExo.niveauCible, 'A');
    const [exoA, exoB] =
      scoreSecondaryAsA > scorePrimaryAsA
        ? [groupBExo, primaryExo]
        : [primaryExo, groupBExo];

    items.push(
      buildPrepItem(
        exoA,
        slotOrder,
        durationMin,
        date,
        'Groupe A (Confirmés)',
        '-A'
      )
    );
    items.push(
      buildPrepItem(
        exoB,
        slotOrder,
        durationMin,
        date,
        'Groupe B (Débutants)',
        '-B'
      )
    );
  });

  return items;
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

  const base = Math.floor(totalMinutes / slotCount / 5) * 5;
  const safeBase = Math.max(5, base);
  const result = Array.from({ length: slotCount }, () => safeBase);
  let remainder = totalMinutes - safeBase * slotCount;

  let idx = slotCount - 1;
  while (remainder > 0) {
    const step = remainder >= 5 ? 5 : remainder;
    result[idx] = (result[idx] ?? 0) + step;
    remainder -= step;
    idx = idx === 0 ? slotCount - 1 : idx - 1;
  }

  return result;
}
