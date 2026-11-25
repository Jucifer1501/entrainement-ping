'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Clock,
  Edit3,
  Lightbulb,
  Play,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { BasketBadge, PicotBadge } from '@/components/ui/Badges';
import { generateSessionPlan } from '@/services/sessionGenerator';
import type {
  BasketSuitability,
  Exercise,
  ExerciseInput,
  PicotCompatibility,
  PreparationItem,
  SessionDurationPreset,
} from '@/types';

const BASKET_OPTIONS: BasketSuitability[] = ['Oui', 'Possible', 'Non adapté'];
const PICOT_OPTIONS: PicotCompatibility[] = [
  'Spécifique Picot',
  'Adapté',
  'À adapter',
  'Non adapté',
];

const PICOT_SORT_RANK: Record<PicotCompatibility, number> = {
  'Spécifique Picot': 0,
  Adapté: 1,
  'À adapter': 2,
  'Non adapté': 3,
};

interface ExerciseModalProps {
  initialExercise: Exercise | null;
  axes: string[];
  onClose: () => void;
  onSubmit: (
    input: ExerciseInput,
    existing: Exercise | null
  ) => Promise<void>;
}

function ExerciseModal({
  initialExercise,
  axes,
  onClose,
  onSubmit,
}: ExerciseModalProps) {
  const [axis, setAxis] = useState(
    initialExercise?.axis ?? axes[0] ?? 'AXE 1 : Régularité & Déplacements'
  );
  const [name, setName] = useState(initialExercise?.name ?? '');
  const [technicalFocus, setTechnicalFocus] = useState(
    initialExercise?.technicalFocus ?? ''
  );
  const [description, setDescription] = useState(
    initialExercise?.description ?? ''
  );
  const [basketSuitability, setBasketSuitability] = useState<BasketSuitability>(
    initialExercise?.basketSuitability ?? 'Possible'
  );
  const [picotCompatibility, setPicotCompatibility] =
    useState<PicotCompatibility>(
      initialExercise?.picotCompatibility ?? 'Adapté'
    );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !axis.trim()) return;
    setSaving(true);
    try {
      await onSubmit(
        {
          axis: axis.trim(),
          name: name.trim(),
          technicalFocus: technicalFocus.trim(),
          description: description.trim(),
          basketSuitability,
          picotCompatibility,
        },
        initialExercise
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">
              {initialExercise
                ? `Modifier ${initialExercise.id}`
                : 'Nouvel exercice (Banque Exo)'}
            </h3>
            {!initialExercise && (
              <p className="text-xs text-zinc-400">
                Inséré automatiquement en fin de section de l’Axe choisi (avant
                le Mémo Picot).
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Axe d’entraînement
            </label>
            <select
              value={axis}
              onChange={(e) => setAxis(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-amber-500"
            >
              {axes.map((ax) => (
                <option key={ax} value={ax}>
                  {ax}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Nom / Thème de l’exercice
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Topspin CD sur balle coupée + bloc actif"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Focus Technique
            </label>
            <input
              type="text"
              value={technicalFocus}
              onChange={(e) => setTechnicalFocus(e.target.value)}
              placeholder="Ex : Transfert d'appuis & relâchement poignet"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Description & Consignes spécifiques
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détaillez les étapes ligne par ligne (affichées en grand format en mode Live)..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-sm text-white outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Panier de balles
              </label>
              <select
                value={basketSuitability}
                onChange={(e) =>
                  setBasketSuitability(e.target.value as BasketSuitability)
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-amber-500"
              >
                {BASKET_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Compatibilité Picot
              </label>
              <select
                value={picotCompatibility}
                onChange={(e) =>
                  setPicotCompatibility(e.target.value as PicotCompatibility)
                }
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-amber-500"
              >
                {PICOT_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 py-3.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {saving
                ? 'Enregistrement...'
                : initialExercise
                  ? 'Mettre à jour'
                  : 'Insérer dans Banque Exo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ExercicesModule() {
  const {
    exerciseBank,
    picotActive,
    presentSpecialPlayers,
    oddMode,
    preparation,
    setPreparation,
    addExercise,
    updateExercise,
    savePreparation,
    launchLiveSession,
    pushToast,
    isReadOnly,
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedAxis, setSelectedAxis] = useState('ALL');
  const [selectedPicot, setSelectedPicot] = useState<string>('ALL');
  const [selectedBasket, setSelectedBasket] = useState<string>('ALL');
  const [hidePicotSpecific, setHidePicotSpecific] = useState(false);
  const [sortBy, setSortBy] = useState<'smart' | 'least' | 'most'>('smart');
  const [showMemo, setShowMemo] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [sessionDate, setSessionDate] = useState(
    preparation[0]?.date ?? new Date().toISOString().slice(0, 10)
  );

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = exerciseBank.exercises.filter((exo) => {
      if (selectedAxis !== 'ALL' && exo.axis !== selectedAxis) return false;
      if (selectedPicot !== 'ALL' && exo.picotCompatibility !== selectedPicot) {
        return false;
      }
      if (selectedBasket !== 'ALL' && exo.basketSuitability !== selectedBasket) {
        return false;
      }
      if (
        !picotActive &&
        hidePicotSpecific &&
        exo.picotCompatibility === 'Spécifique Picot'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        exo.name.toLowerCase().includes(q) ||
        exo.id.toLowerCase().includes(q) ||
        exo.technicalFocus.toLowerCase().includes(q) ||
        exo.description.toLowerCase().includes(q) ||
        exo.axis.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'least') {
        return a.nbRealises - b.nbRealises || a.id.localeCompare(b.id);
      }
      if (sortBy === 'most') {
        return b.nbRealises - a.nbRealises || a.id.localeCompare(b.id);
      }
      // Smart sort: when picotActive, surface Spécifique Picot & Adapté first, then least practiced
      if (picotActive) {
        const rankDiff =
          PICOT_SORT_RANK[a.picotCompatibility] -
          PICOT_SORT_RANK[b.picotCompatibility];
        if (rankDiff !== 0) return rankDiff;
      }
      return a.nbRealises - b.nbRealises || a.id.localeCompare(b.id);
    });
  }, [
    exerciseBank.exercises,
    search,
    selectedAxis,
    selectedPicot,
    selectedBasket,
    picotActive,
    hidePicotSpecific,
    sortBy,
  ]);

  const totalPlanDuration = useMemo(
    () => preparation.reduce((sum, item) => sum + item.durationMin, 0),
    [preparation]
  );

  const handleExerciseSubmit = async (
    input: ExerciseInput,
    existing: Exercise | null
  ) => {
    if (existing) {
      await updateExercise({ ...existing, ...input });
    } else {
      await addExercise(input);
    }
  };

  const addExerciseToPlan = (exo: Exercise) => {
    const nextItem: PreparationItem = {
      localId: `prep-${exo.id}-${Date.now()}`,
      date: sessionDate,
      order: preparation.length + 1,
      axis: exo.axis,
      exerciseName: exo.name,
      durationMin: 15,
      objectives: exo.technicalFocus || exo.description.slice(0, 120),
      exerciseId: exo.id,
    };
    setPreparation((prev) => [...prev, nextItem]);
    pushToast('info', `"${exo.name}" ajouté à la trame.`);
  };

  const handleAutoGenerate = (duration: SessionDurationPreset) => {
    const generated = generateSessionPlan(exerciseBank.exercises, duration, {
      picotActive,
      includePicotSpecificWhenInactive: !hidePicotSpecific,
      preferBasket: oddMode === 'PANIER_BALLES',
      date: sessionDate,
    });
    setPreparation(generated);
    pushToast(
      'success',
      `Trame équilibrée de ${duration} min générée (${generated.length} blocs).`
    );
  };

  const movePlanItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= preparation.length) return;
    setPreparation((prev) => {
      const copy = [...prev];
      const current = copy[index];
      const swapped = copy[target];
      if (!current || !swapped) return prev;
      copy[index] = swapped;
      copy[target] = current;
      return copy.map((item, i) => ({ ...item, order: i + 1 }));
    });
  };

  const updatePlanItem = (
    localId: string,
    patch: Partial<PreparationItem>
  ) => {
    setPreparation((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item
      )
    );
  };

  const removePlanItem = (localId: string) => {
    setPreparation((prev) =>
      prev
        .filter((item) => item.localId !== localId)
        .map((item, i) => ({ ...item, order: i + 1 }))
    );
  };

  const handleSavePreparation = async () => {
    setSavingPlan(true);
    try {
      const withDate = preparation.map((item, idx) => ({
        ...item,
        date: sessionDate,
        order: idx + 1,
      }));
      await savePreparation(withDate);
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left: Exercise Library */}
      <section className="space-y-4 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">
              Bibliothèque d’Exercices
            </h2>
            <p className="text-sm text-zinc-400">
              {filteredExercises.length} / {exerciseBank.exercises.length}{' '}
              exercices disponibles
            </p>
          </div>

          <div className="flex items-center gap-2">
            {exerciseBank.picotMemos.length > 0 && (
              <button
                type="button"
                onClick={() => setShowMemo((v) => !v)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition ${
                  showMemo
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <Lightbulb className="h-4 w-4 text-amber-400" />
                Mémo Picot
              </button>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  setEditingExercise(null);
                  setModalOpen(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400"
              >
                <Plus className="h-4 w-4" />
                Nouvel exercice
              </button>
            )}
          </div>
        </div>

        {/* Auto-detected Picot banner or hide-picot filter */}
        {picotActive ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-bold text-amber-300">
                Mode Picot actif ({presentSpecialPlayers.map((p) => p.name).join(', ')})
              </p>
              <p className="mt-0.5 text-xs text-amber-200/80">
                Les exercices <strong>Spécifique Picot</strong> et{' '}
                <strong>Adapté</strong> remontent automatiquement en tête de
                liste.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-2.5 text-xs text-zinc-300">
            <span>Aucun Picot long / Anti-top pointé présent ce soir.</span>
            <button
              type="button"
              onClick={() => setHidePicotSpecific((v) => !v)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                hidePicotSpecific
                  ? 'bg-amber-500 text-zinc-950'
                  : 'border border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white'
              }`}
            >
              {hidePicotSpecific
                ? 'Spécifique Picot masqués'
                : 'Masquer Spécifique Picot'}
            </button>
          </div>
        )}

        {/* Contextual Picot Memo Drawer */}
        {showMemo && exerciseBank.picotMemos.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-amber-300">
              <Lightbulb className="h-4 w-4" />
              Mémo Technique & Conseils Picot (depuis Banque Exo)
            </h3>
            {exerciseBank.picotMemos.map((memo) => (
              <div
                key={memo.rowIndex}
                className="rounded-xl border border-amber-500/20 bg-zinc-950/70 p-3 text-xs"
              >
                <p className="font-bold text-amber-200">{memo.title}</p>
                <p className="mt-1 leading-relaxed text-zinc-300">
                  {memo.content}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Combinable filters */}
        <div className="space-y-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par nom, thème, focus technique..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={selectedAxis}
              onChange={(e) => setSelectedAxis(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500"
            >
              <option value="ALL">Tous les Axes</option>
              {exerciseBank.axes.map((ax) => (
                <option key={ax} value={ax}>
                  {ax}
                </option>
              ))}
            </select>

            <select
              value={selectedPicot}
              onChange={(e) => setSelectedPicot(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500"
            >
              <option value="ALL">Picot : Tous</option>
              {PICOT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={selectedBasket}
              onChange={(e) => setSelectedBasket(e.target.value)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500"
            >
              <option value="ALL">Panier : Tous</option>
              {BASKET_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  Panier : {b}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'smart' | 'least' | 'most')
              }
              className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-amber-500"
            >
              <option value="smart">Tri : Recommandé</option>
              <option value="least">Nb réalisés ↑ (moins faits)</option>
              <option value="most">Nb réalisés ↓ (plus faits)</option>
            </select>
          </div>
        </div>

        {/* Exercise cards */}
        <div className="space-y-2.5">
          {filteredExercises.map((exo) => (
            <div
              key={`${exo.id}-${exo.rowIndex}`}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] font-mono text-zinc-400">
                      {exo.id}
                    </span>
                    <span className="truncate text-xs font-semibold text-amber-400">
                      {exo.axis}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-bold text-white">
                    {exo.name}
                  </h3>
                  {exo.technicalFocus && (
                    <p className="mt-0.5 text-xs font-medium text-zinc-300">
                      Focus : {exo.technicalFocus}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExercise(exo);
                        setModalOpen(true);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-white"
                      aria-label={`Modifier ${exo.name}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => addExerciseToPlan(exo)}
                    className="inline-flex h-10 items-center gap-1 rounded-xl bg-zinc-100 px-3 text-xs font-bold text-zinc-950 hover:bg-amber-400"
                  >
                    <Plus className="h-4 w-4" />
                    Trame
                  </button>
                </div>
              </div>

              {exo.description && (
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-zinc-400">
                  {exo.description}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PicotBadge compatibility={exo.picotCompatibility} />
                <BasketBadge suitability={exo.basketSuitability} />
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2.5 py-0.5 text-xs tabular-nums text-zinc-400">
                  <BookOpen className="h-3 w-3 text-zinc-500" />
                  Réalisé {exo.nbRealises}×
                </span>
              </div>
            </div>
          ))}

          {filteredExercises.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
              Aucun exercice ne correspond à ces filtres.
            </div>
          )}
        </div>
      </section>

      {/* Right: Session Planner (Préparation) */}
      <section className="space-y-4 lg:col-span-5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Planificateur (Préparation)
              </h2>
              <p className="text-xs text-zinc-400">
                Total :{' '}
                <strong className="tabular-nums text-amber-400">
                  {totalPlanDuration} min
                </strong>{' '}
                ({preparation.length} exercice
                {preparation.length > 1 ? 's' : ''})
              </p>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              <input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="bg-transparent text-xs font-medium text-white outline-none"
              />
            </div>
          </div>

          {/* Automatic balanced session generator */}
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <Wand2 className="h-3.5 w-3.5 text-amber-400" />
              Générateur automatique équilibré (Axes + moins réalisés)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([60, 90, 120] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAutoGenerate(preset)}
                  className="min-h-[42px] rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-white transition hover:border-amber-400 hover:bg-amber-500/15 hover:text-amber-300 active:scale-95"
                >
                  {preset} min
                </button>
              ))}
            </div>
          </div>

          {/* Planned blocks */}
          <div className="mt-4 space-y-2.5">
            {preparation.map((item, idx) => (
              <div
                key={item.localId}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-xs font-bold tabular-nums text-amber-300">
                        {idx + 1}
                      </span>
                      <span className="truncate text-[11px] font-semibold text-zinc-400">
                        {item.axis}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-white">
                      {item.exerciseName}
                    </p>
                  </div>

                  {/* Reorder & Remove */}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => movePlanItem(idx, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white disabled:opacity-30"
                      aria-label="Monter"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === preparation.length - 1}
                      onClick={() => movePlanItem(idx, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white disabled:opacity-30"
                      aria-label="Descendre"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePlanItem(item.localId)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-red-500/40 hover:text-red-400"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Duration & Objectives edit */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
                    <Clock className="ml-1 h-3.5 w-3.5 text-amber-400" />
                    <button
                      type="button"
                      onClick={() =>
                        updatePlanItem(item.localId, {
                          durationMin: Math.max(5, item.durationMin - 5),
                        })
                      }
                      className="h-7 w-7 rounded bg-zinc-800 text-xs font-bold text-white hover:bg-zinc-700"
                    >
                      -5
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={item.durationMin}
                      onChange={(e) =>
                        updatePlanItem(item.localId, {
                          durationMin: Math.max(
                            1,
                            Number.parseInt(e.target.value, 10) || 1
                          ),
                        })
                      }
                      className="w-11 bg-transparent text-center text-xs font-bold tabular-nums text-white outline-none"
                    />
                    <span className="pr-1 text-[11px] text-zinc-400">min</span>
                    <button
                      type="button"
                      onClick={() =>
                        updatePlanItem(item.localId, {
                          durationMin: Math.min(120, item.durationMin + 5),
                        })
                      }
                      className="h-7 w-7 rounded bg-zinc-800 text-xs font-bold text-white hover:bg-zinc-700"
                    >
                      +5
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.objectives}
                    onChange={(e) =>
                      updatePlanItem(item.localId, {
                        objectives: e.target.value,
                      })
                    }
                    placeholder="Objectifs & consignes..."
                    className="min-w-[160px] flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ))}

            {preparation.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
                Cliquez sur « + Trame » ou utilisez le générateur 60 / 90 / 120
                min.
              </div>
            )}
          </div>

          {/* Primary Actions */}
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {isReadOnly ? (
              <div
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs font-semibold text-sky-300"
                title="Sauvegarde Google Sheets désactivée en mode lecture seule"
              >
                <Save className="h-4 w-4 opacity-60" />
                Lecture seule (non sauvegardé)
              </div>
            ) : (
              <button
                type="button"
                disabled={savingPlan || preparation.length === 0}
                onClick={handleSavePreparation}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-bold text-white transition hover:border-amber-400 hover:text-amber-300 disabled:opacity-40"
              >
                <Save className="h-4 w-4" />
                {savingPlan ? 'Sauvegarde...' : 'Sauver Préparation'}
              </button>
            )}

            <button
              type="button"
              disabled={preparation.length === 0}
              onClick={launchLiveSession}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:opacity-40"
            >
              <Play className="h-4 w-4 fill-current" />
              Lancer en Live
            </button>
          </div>
        </div>
      </section>

      {modalOpen && (
        <ExerciseModal
          initialExercise={editingExercise}
          axes={exerciseBank.axes}
          onClose={() => setModalOpen(false)}
          onSubmit={handleExerciseSubmit}
        />
      )}
    </div>
  );
}
