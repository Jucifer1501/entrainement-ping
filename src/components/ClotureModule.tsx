'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Fingerprint,
  Layers,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { GroupeBadge } from '@/components/ui/Badges';
import type { SessionClosureExercise } from '@/types';

export function ClotureModule() {
  const {
    players,
    presentPlayerIds,
    preparation,
    exerciseBank,
    liveCompletedLocalIds,
    activeSessionId,
    resetActiveSessionId,
    archiveSession,
    setActiveTab,
    syncStatus,
    isReadOnly,
  } = useApp();

  const [date, setDate] = useState(
    preparation[0]?.date || new Date().toISOString().slice(0, 10)
  );
  const [selectedPlayerIds, setSelectedPlayerIds] =
    useState<string[]>(presentPlayerIds);
  const [items, setItems] = useState<SessionClosureExercise[]>([]);
  const [archiving, setArchiving] = useState(false);
  const [archivedResult, setArchivedResult] = useState<{
    sessionId: string;
    queued: boolean;
    alreadyArchived?: boolean;
  } | null>(null);

  // Sync initial checklist from current preparation + present players
  useEffect(() => {
    setSelectedPlayerIds(presentPlayerIds);
  }, [presentPlayerIds]);

  useEffect(() => {
    const mapped: SessionClosureExercise[] = preparation.map((p, idx) => {
      const bankMatch =
        exerciseBank.exercises.find(
          (e) =>
            p.exerciseId && e.id === p.exerciseId && e.name === p.exerciseName
        ) ??
        exerciseBank.exercises.find(
          (e) =>
            (p.exerciseId && e.id === p.exerciseId) || e.name === p.exerciseName
        );
      const isMarkedLive =
        liveCompletedLocalIds.length === 0 ||
        liveCompletedLocalIds.includes(p.localId);
      return {
        exerciseId: bankMatch?.id ?? p.exerciseId,
        exerciseRowIndex: bankMatch?.rowIndex ?? null,
        axis: p.axis,
        exerciseName: p.exerciseName,
        durationMin: p.durationMin,
        details: p.objectives,
        completed: isMarkedLive,
        groupeCible: p.groupeCible ?? 'Tous',
        slotOrder: p.order > 0 ? p.order : idx + 1,
      };
    });
    setItems(mapped);
  }, [preparation, exerciseBank.exercises, liveCompletedLocalIds]);

  const completedItems = useMemo(
    () => items.filter((i) => i.completed),
    [items]
  );

  // Deduplicate wall-clock duration when Groupe A & Groupe B share the same synchronized slot
  const totalMinutes = useMemo(() => {
    const seenSlots = new Map<number, number>();
    completedItems.forEach((item, idx) => {
      const slotKey = item.slotOrder ?? idx + 1;
      const existing = seenSlots.get(slotKey) ?? 0;
      if (item.durationMin > existing) {
        seenSlots.set(slotKey, item.durationMin);
      }
    });
    return Array.from(seenSlots.values()).reduce((sum, m) => sum + m, 0);
  }, [completedItems]);

  const distinctCompletedExerciseCount = useMemo(() => {
    const keys = new Set<string>();
    for (const item of completedItems) {
      if (item.exerciseRowIndex !== null) {
        keys.add(`row-${item.exerciseRowIndex}`);
      } else if (item.exerciseId) {
        keys.add(`id-${item.exerciseId}`);
      }
    }
    return keys.size;
  }, [completedItems]);

  const selectedPlayers = useMemo(() => {
    const set = new Set(selectedPlayerIds);
    return players.filter((p) => set.has(p.id));
  }, [players, selectedPlayerIds]);

  const toggleItem = (idx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const updateItem = (
    idx: number,
    patch: Partial<SessionClosureExercise>
  ) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    );
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleArchive = async () => {
    if (completedItems.length === 0) return;
    setArchiving(true);
    const sessionKey = activeSessionId;
    try {
      const result = await archiveSession({
        sessionId: sessionKey,
        date,
        presentPlayerIds: selectedPlayers.map((p) => p.id),
        presentPlayerNames: selectedPlayers.map((p) => p.name),
        exercises: items,
      });
      setArchivedResult({
        sessionId: sessionKey,
        queued: result.queued,
        alreadyArchived: result.alreadyArchived,
      });
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            Clôture & Archivage Atomique
          </h2>
          <p className="text-sm text-zinc-400">
            Validez les exercices réellement joués et les présents avant
            l’écriture groupée dans Google Sheets.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs">
          <Fingerprint className="h-4 w-4 text-amber-400" />
          <span className="font-mono text-zinc-300">{activeSessionId}</span>
          <button
            type="button"
            onClick={resetActiveSessionId}
            title="Générer un nouvel ID_Session"
            className="ml-1 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {archivedResult && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-bold text-emerald-200">
                  {archivedResult.queued
                    ? 'Clôture enregistrée en file d’attente hors-ligne'
                    : archivedResult.alreadyArchived
                      ? 'Séance déjà archivée (protégée par idempotence)'
                      : 'Séance clôturée et archivée avec succès !'}
                </p>
                <p className="mt-0.5 text-xs text-emerald-200/80">
                  Clé d’idempotence :{' '}
                  <span className="font-mono">{archivedResult.sessionId}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('historique')}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-400"
            >
              Voir l’Historique
            </button>
          </div>
        </div>
      )}

      {/* Session Date & Atomic Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <Calendar className="h-3.5 w-3.5 text-amber-400" />
            Date de la séance
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-amber-500"
          />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            Volume validé
          </p>
          <p className="mt-2 text-2xl font-black tabular-nums text-white">
            {totalMinutes} min
          </p>
          <p className="text-xs text-zinc-400">
            {completedItems.length} exercice{completedItems.length > 1 ? 's' : ''}{' '}
            coché{completedItems.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            <Users className="h-3.5 w-3.5 text-amber-400" />
            Participants
          </p>
          <p className="mt-2 text-2xl font-black tabular-nums text-white">
            {selectedPlayers.length} joueur{selectedPlayers.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-zinc-400">
            +1 sur Participations chacun
          </p>
        </div>
      </div>

      {/* Exercises Validation List */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <h3 className="mb-3 text-base font-bold text-white">
          1. Exercices réellement réalisés
        </h3>

        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <div
              key={`${item.exerciseId}-${idx}`}
              className={`flex flex-col gap-3 rounded-xl border p-3 transition sm:flex-row sm:items-center ${
                item.completed
                  ? 'border-amber-500/40 bg-zinc-950'
                  : 'border-zinc-800/80 bg-zinc-950/40 opacity-55'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.completed}
                  onClick={() => toggleItem(idx)}
                  className={`flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl border-2 transition ${
                    item.completed
                      ? 'border-amber-400 bg-amber-500 text-zinc-950'
                      : 'border-zinc-700 bg-zinc-900 text-transparent'
                  }`}
                >
                  <Check className="h-6 w-6 stroke-[3]" />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-[11px] font-semibold text-amber-400">
                      #{item.slotOrder ?? idx + 1} • {item.axis}
                    </p>
                    {item.groupeCible && item.groupeCible !== 'Tous' && (
                      <GroupeBadge groupe={item.groupeCible} />
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">
                    {item.exerciseName}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
                <div className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5">
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={item.durationMin}
                    onChange={(e) =>
                      updateItem(idx, {
                        durationMin: Math.max(
                          1,
                          Number.parseInt(e.target.value, 10) || 1
                        ),
                      })
                    }
                    className="w-12 bg-transparent text-center text-sm font-bold tabular-nums text-white outline-none"
                  />
                  <span className="text-xs text-zinc-400">min</span>
                </div>

                <input
                  type="text"
                  value={item.details}
                  onChange={(e) => updateItem(idx, { details: e.target.value })}
                  placeholder="Détails / notes..."
                  className="min-w-[170px] flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-amber-500 sm:max-w-xs"
                />
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <p className="py-6 text-center text-sm text-zinc-500">
              Aucun exercice dans la trame actuelle.
            </p>
          )}
        </div>
      </section>

      {/* Participants Confirmation */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5">
        <h3 className="mb-3 text-base font-bold text-white">
          2. Joueurs présents ({selectedPlayers.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => {
            const active = selectedPlayerIds.includes(p.id);
            return (
              <button
                key={`${p.id}-${p.rowIndex}`}
                type="button"
                onClick={() => togglePlayer(p.id)}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded ${
                    active
                      ? 'bg-amber-400 text-zinc-950'
                      : 'border border-zinc-700'
                  }`}
                >
                  {active && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                {p.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* Atomic batchUpdate Preview + CTA */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <Layers className="h-4 w-4 text-amber-400" />
          Opération atomique (values:batchUpdate)
        </h3>
        <ul className="mt-2.5 space-y-1.5 text-xs text-zinc-400">
          <li>
            1. Écriture bornée sur{' '}
            <code className="text-zinc-200">&apos;Séances&apos;!B:I</code> (
            {completedItems.length} ligne{completedItems.length > 1 ? 's' : ''},
            colonnes latérales K+ intactes) avec{' '}
            <code className="text-amber-300">{activeSessionId}</code>.
          </li>
          <li>
            2. Incrémentation <code className="text-emerald-300">+1</code> sur{' '}
            <code className="text-zinc-200">
              &apos;Profils joueurs&apos;!H
            </code>{' '}
            pour {selectedPlayers.length} présent
            {selectedPlayers.length > 1 ? 's' : ''}.
          </li>
          <li>
            3. Incrémentation <code className="text-emerald-300">+1</code> sur{' '}
            <code className="text-zinc-200">&apos;Banque Exo&apos;!H</code> pour{' '}
            {distinctCompletedExerciseCount} exercice(s) distinct(s) réalisé(s)
            (variantes Groupe A &amp; Groupe B incluses).
          </li>
        </ul>

        {isReadOnly ? (
          <div className="mt-5 rounded-2xl border border-sky-500/40 bg-sky-500/10 px-4 py-4 text-center text-sm font-semibold text-sky-200">
            Mode lecture seule actif — Seul un entraîneur connecté avec Google
            OAuth peut clôturer et archiver une séance dans Google Sheets.
          </div>
        ) : (
          <button
            type="button"
            disabled={archiving || completedItems.length === 0}
            onClick={handleArchive}
            className="mt-5 flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-amber-500 px-6 py-4 text-base font-black text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-[0.99] disabled:opacity-40"
          >
            <Archive className="h-5 w-5" />
            {archiving
              ? 'Archivage en cours...'
              : syncStatus.mode === 'google' && !syncStatus.isOnline
                ? 'Enregistrer en file d’attente hors-ligne'
                : 'Clôturer et archiver la séance'}
          </button>
        )}
      </div>
    </div>
  );
}
