'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  Lightbulb,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sun,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAudioAlert } from '@/hooks/useAudioAlert';
import {
  NiveauBadge,
  PicotBadge,
  RubberBadge,
} from '@/components/ui/Badges';
import { groupPreparationIntoSlots } from '@/services/sessionGenerator';
import type { Exercise, Player, PreparationItem } from '@/types';

function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatTableNumbers(nums: number[]): string {
  if (nums.length === 0) return 'Aucune table';
  if (nums.length === 1) return `Table ${nums[0]}`;
  return `Tables ${nums.join(', ')}`;
}

interface LiveExerciseCardProps {
  item: PreparationItem;
  bankExercise: Exercise | null;
  groupHeader?: string;
  accent: 'default' | 'groupA' | 'groupB';
  compact?: boolean;
}

function LiveExerciseCard({
  item,
  bankExercise,
  groupHeader,
  accent,
  compact = false,
}: LiveExerciseCardProps) {
  const instructionLines = useMemo(() => {
    const raw = bankExercise?.description || item.objectives || '';
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }, [bankExercise?.description, item.objectives]);

  const borderClass =
    accent === 'groupA'
      ? 'border-amber-500/50 bg-zinc-950'
      : accent === 'groupB'
        ? 'border-sky-500/50 bg-zinc-950'
        : 'border-zinc-800 bg-zinc-950';

  const headerBadgeClass =
    accent === 'groupA'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-sky-500/20 text-sky-300 border-sky-500/40';

  const stepBulletClass =
    accent === 'groupB'
      ? 'bg-sky-500/20 text-sky-300'
      : 'bg-amber-500/20 text-amber-300';

  return (
    <div
      className={`rounded-3xl border ${borderClass} ${compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}`}
    >
      {groupHeader && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span
            className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${headerBadgeClass}`}
          >
            {groupHeader}
          </span>
          <span className="truncate text-[11px] font-semibold text-zinc-400">
            {item.axis}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2
          className={`font-extrabold leading-tight text-white ${
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
          }`}
        >
          {item.exerciseName}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {bankExercise?.niveauCible && (
            <NiveauBadge niveau={bankExercise.niveauCible} />
          )}
          {bankExercise && (
            <PicotBadge compatibility={bankExercise.picotCompatibility} />
          )}
        </div>
      </div>

      {bankExercise?.technicalFocus && (
        <p
          className={`mt-2 inline-block rounded-lg px-3 py-1 text-sm font-semibold ${
            accent === 'groupB'
              ? 'bg-sky-500/15 text-sky-300'
              : 'bg-amber-500/15 text-amber-300'
          }`}
        >
          Focus : {bankExercise.technicalFocus}
        </p>
      )}

      {item.objectives && item.objectives !== bankExercise?.description && (
        <p className="mt-2.5 text-sm font-medium text-zinc-300">
          Objectif : {item.objectives}
        </p>
      )}

      {instructionLines.length > 0 && (
        <ul className="mt-3.5 space-y-2">
          {instructionLines.map((line, i) => (
            <li
              key={i}
              className={`flex items-start gap-3 rounded-xl bg-zinc-900/90 px-3.5 py-2.5 leading-snug text-zinc-100 ${
                compact ? 'text-sm sm:text-base' : 'text-base'
              }`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${stepBulletClass}`}
              >
                {i + 1}
              </span>
              <span>{line.replace(/^\d+[.)]\s*/, '')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LiveModule() {
  const {
    preparation,
    exerciseBank,
    picotActive,
    pairings,
    swapPairingsPlayers,
    toggleTableGroup,
    liveCompletedLocalIds,
    markLiveExerciseCompleted,
    setActiveTab,
  } = useApp();

  const slots = useMemo(
    () => groupPreparationIntoSlots(preparation),
    [preparation]
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    () => (slots[0]?.durationMin ?? 15) * 60
  );
  const [isRunning, setIsRunning] = useState(false);
  const [finishedAlerted, setFinishedAlerted] = useState(false);
  const [tablesDrawerOpen, setTablesDrawerOpen] = useState(false);
  const [memoExpanded, setMemoExpanded] = useState(picotActive);
  const [selectedSwapPlayer, setSelectedSwapPlayer] = useState<Player | null>(
    null
  );

  // Wall-clock deadline ref so timer stays accurate even if iOS Chrome throttles timers
  const endTimeRef = useRef<number | null>(null);

  // Screen Wake Lock active while Live module is mounted
  const wakeLock = useWakeLock(true);
  // Synthesized Web Audio double beep + full-screen visual flash
  const audioAlert = useAudioAlert();

  const safeIndex = Math.min(currentIndex, Math.max(0, slots.length - 1));
  const currentSlot = slots[safeIndex] ?? null;

  const findBankExercise = useCallback(
    (item: PreparationItem | null): Exercise | null => {
      if (!item) return null;
      if (item.exerciseId) {
        const byIdAndName = exerciseBank.exercises.find(
          (e) => e.id === item.exerciseId && e.name === item.exerciseName
        );
        if (byIdAndName) return byIdAndName;
        const byId = exerciseBank.exercises.find(
          (e) => e.id === item.exerciseId
        );
        if (byId) return byId;
      }
      return (
        exerciseBank.exercises.find((e) => e.name === item.exerciseName) ?? null
      );
    },
    [exerciseBank.exercises]
  );

  const groupATableNumbers = useMemo(
    () =>
      pairings.tables
        .filter((t) => t.groupLevel === 'Groupe A (Confirmés)')
        .map((t) => t.tableNumber),
    [pairings.tables]
  );

  const groupBTableNumbers = useMemo(
    () =>
      pairings.tables
        .filter((t) => t.groupLevel === 'Groupe B (Débutants)')
        .map((t) => t.tableNumber),
    [pairings.tables]
  );

  const totalBlockSeconds = (currentSlot?.durationMin ?? 15) * 60;
  const progressPct =
    totalBlockSeconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((totalBlockSeconds - remainingSeconds) / totalBlockSeconds) * 100
          )
        )
      : 0;

  const markSlotCompleted = useCallback(
    (completed: boolean) => {
      if (!currentSlot) return;
      currentSlot.items.forEach((item) => {
        markLiveExerciseCompleted(item.localId, completed);
      });
    },
    [currentSlot, markLiveExerciseCompleted]
  );

  // Accurate countdown tick
  useEffect(() => {
    if (!isRunning) {
      endTimeRef.current = null;
      return;
    }

    if (endTimeRef.current === null) {
      endTimeRef.current = Date.now() + remainingSeconds * 1000;
    }

    const interval = window.setInterval(() => {
      if (endTimeRef.current === null) return;
      const diffSec = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      if (diffSec <= 0) {
        setRemainingSeconds(0);
        setIsRunning(false);
        endTimeRef.current = null;
        setFinishedAlerted(true);
        audioAlert.triggerTimerEndAlert();
        markSlotCompleted(true);
      } else {
        setRemainingSeconds(diffSec);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [isRunning, remainingSeconds, audioAlert, markSlotCompleted]);

  const switchToSlot = useCallback(
    (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(slots.length - 1, nextIdx));
      const target = slots[clamped];
      setCurrentIndex(clamped);
      setIsRunning(false);
      endTimeRef.current = null;
      setFinishedAlerted(false);
      setRemainingSeconds((target?.durationMin ?? 15) * 60);
    },
    [slots]
  );

  const handleToggleRun = () => {
    // CRITICAL for Chrome iOS: unlock Web Audio synchronously inside the user tap
    audioAlert.unlock();
    void wakeLock.requestWakeLock();

    if (isRunning) {
      setIsRunning(false);
      endTimeRef.current = null;
      return;
    }

    if (remainingSeconds <= 0 && currentSlot) {
      const resetSec = currentSlot.durationMin * 60;
      setRemainingSeconds(resetSec);
      endTimeRef.current = Date.now() + resetSec * 1000;
      setFinishedAlerted(false);
      setIsRunning(true);
      return;
    }

    endTimeRef.current = Date.now() + remainingSeconds * 1000;
    setFinishedAlerted(false);
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    endTimeRef.current = null;
    setFinishedAlerted(false);
    setRemainingSeconds((currentSlot?.durationMin ?? 15) * 60);
  };

  const handleAddOneMinute = () => {
    setRemainingSeconds((prev) => {
      const next = prev + 60;
      if (isRunning && endTimeRef.current !== null) {
        endTimeRef.current += 60_000;
      }
      return next;
    });
    setFinishedAlerted(false);
  };

  const handleSwapInDrawer = (player: Player) => {
    if (!selectedSwapPlayer) {
      setSelectedSwapPlayer(player);
      return;
    }
    if (selectedSwapPlayer.id === player.id) {
      setSelectedSwapPlayer(null);
      return;
    }
    swapPairingsPlayers(selectedSwapPlayer.id, player.id);
    setSelectedSwapPlayer(null);
  };

  if (slots.length === 0 || !currentSlot) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-obsidian p-8 text-center">
        <p className="text-lg font-bold text-white">
          Aucune séance préparée pour le mode Live
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Générez une trame (60, 90 ou 120 min) ou sélectionnez des exercices
          dans la bibliothèque pour démarrer.
        </p>
        <button
          type="button"
          onClick={() => setActiveTab('exercices')}
          className="mt-5 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-amber-400"
        >
          Aller au Planificateur
        </button>
      </div>
    );
  }

  const isCompleted = currentSlot.items.every((item) =>
    liveCompletedLocalIds.includes(item.localId)
  );
  const primaryAxisLabel = currentSlot.isDifferentiated
    ? 'CRÉNEAU MULTI-NIVEAUX (CHRONO SYNCHRONISÉ)'
    : currentSlot.items[0]?.axis ?? '';

  return (
    <div className="relative mx-auto flex min-h-[calc(100dvh-11rem)] max-w-3xl flex-col justify-between pb-44 sm:pb-48">
      {/* Full-Screen High-Contrast Visual Flash at 00:00 (iOS Chrome vibration fallback) */}
      {audioAlert.isFlashing && (
        <div
          aria-live="assertive"
          className="pointer-events-none fixed inset-0 z-50 animate-flash-alert bg-amber-400"
        />
      )}

      {/* Top status bar */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-extrabold tabular-nums text-amber-300">
              BLOC {safeIndex + 1} / {slots.length}
            </span>
            {currentSlot.isDifferentiated && (
              <span className="rounded-full border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-300">
                Groupes A / B
              </span>
            )}
            <button
              type="button"
              onClick={() => markSlotCompleted(!isCompleted)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                isCompleted
                  ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isCompleted ? 'Validé' : 'Marquer fait'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                wakeLock.isActive
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400'
              }`}
              title={
                wakeLock.isSupported
                  ? 'Screen Wake Lock API'
                  : 'Wake Lock non supporté sur ce navigateur'
              }
            >
              <Sun className="h-3.5 w-3.5" />
              {wakeLock.isActive ? 'Écran actif' : 'Veille auto'}
            </span>
          </div>
        </div>

        {/* Giant Single Synchronized Countdown Panel */}
        <div
          className={`rounded-3xl border p-5 text-center transition sm:p-7 ${
            remainingSeconds === 0
              ? 'border-amber-400 bg-amber-500/15 shadow-lg shadow-amber-500/20'
              : isRunning
                ? 'border-amber-500/50 bg-zinc-950'
                : 'border-zinc-800 bg-zinc-950'
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-400">
            {primaryAxisLabel}
          </p>

          <div
            className={`my-2 font-mono text-7xl font-black tracking-tight tabular-nums sm:text-8xl ${
              remainingSeconds === 0
                ? 'text-amber-300'
                : remainingSeconds <= 30 && isRunning
                  ? 'text-amber-400'
                  : 'text-white'
            }`}
          >
            {formatTimer(remainingSeconds)}
          </div>

          {/* Progress bar */}
          <div className="mx-auto mt-3 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {finishedAlerted && (
            <p className="mt-3 text-sm font-bold text-amber-300">
              Temps écoulé ! Passez au bloc suivant ou ajoutez +1 min.
            </p>
          )}
        </div>

        {/* High-Visibility Exercise Card(s): Unified OR Dual Groupe A / Groupe B */}
        {currentSlot.isDifferentiated ? (
          <div className="grid grid-cols-1 gap-3.5">
            {currentSlot.items.map((item) => {
              const isA = item.groupeCible === 'Groupe A (Confirmés)';
              const isB = item.groupeCible === 'Groupe B (Débutants)';
              const tableNums = isA
                ? groupATableNumbers
                : isB
                  ? groupBTableNumbers
                  : [];
              const header = isA
                ? `Groupe A (Confirmés) — ${formatTableNumbers(tableNums)}`
                : isB
                  ? `Groupe B (Débutants) — ${formatTableNumbers(tableNums)}`
                  : 'Tous les groupes';

              return (
                <LiveExerciseCard
                  key={item.localId}
                  item={item}
                  bankExercise={findBankExercise(item)}
                  groupHeader={header}
                  accent={isA ? 'groupA' : isB ? 'groupB' : 'default'}
                  compact
                />
              );
            })}
          </div>
        ) : (
          currentSlot.items[0] && (
            <LiveExerciseCard
              item={currentSlot.items[0]}
              bankExercise={findBankExercise(currentSlot.items[0])}
              accent="default"
            />
          )
        )}

        {/* Contextual Picot Memo Card */}
        {exerciseBank.picotMemos.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-amber-950/20">
            <button
              type="button"
              onClick={() => setMemoExpanded((v) => !v)}
              className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-amber-300">
                <Lightbulb className="h-4 w-4 shrink-0" />
                Mémo Picot contextuel
                {picotActive && (
                  <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
                    Picot présent
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold text-amber-400">
                {memoExpanded ? 'Masquer' : 'Afficher'}
              </span>
            </button>

            {memoExpanded && (
              <div className="space-y-2 border-t border-amber-500/20 px-4 py-3">
                {exerciseBank.picotMemos.map((memo) => (
                  <div
                    key={memo.rowIndex}
                    className="rounded-xl bg-zinc-950/80 p-3 text-sm"
                  >
                    <p className="font-bold text-amber-200">{memo.title}</p>
                    <p className="mt-1 leading-relaxed text-zinc-200">
                      {memo.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Thumb-Zone Control Dock (One-handed iPhone Chrome) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-obsidian/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <div className="mx-auto max-w-3xl space-y-2.5">
          {/* Quick Utility Row */}
          <div className="grid grid-cols-5 gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex min-h-[46px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-[11px] font-semibold text-zinc-200 active:scale-95"
            >
              <RotateCcw className="mb-0.5 h-4 w-4 text-zinc-400" />
              Reset
            </button>

            <button
              type="button"
              onClick={handleAddOneMinute}
              className="flex min-h-[46px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-[11px] font-bold text-amber-300 active:scale-95"
            >
              <Plus className="mb-0.5 h-4 w-4" />
              +1 min
            </button>

            <button
              type="button"
              onClick={() => {
                if (audioAlert.muted) {
                  audioAlert.setMuted(false);
                  audioAlert.playTestBeep();
                } else {
                  audioAlert.setMuted(true);
                }
              }}
              className="flex min-h-[46px] flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-[11px] font-semibold text-zinc-200 active:scale-95"
            >
              {audioAlert.muted ? (
                <VolumeX className="mb-0.5 h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="mb-0.5 h-4 w-4 text-emerald-400" />
              )}
              {audioAlert.muted ? 'Muet' : 'Bip ON'}
            </button>

            <button
              type="button"
              onClick={() => setTablesDrawerOpen(true)}
              className="flex min-h-[46px] flex-col items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 text-[11px] font-bold text-white active:scale-95"
            >
              <Users className="mb-0.5 h-4 w-4 text-amber-400" />
              Tables
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cloture')}
              className="flex min-h-[46px] flex-col items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-[11px] font-bold text-emerald-300 active:scale-95"
            >
              <Flag className="mb-0.5 h-4 w-4" />
              Clôturer
            </button>
          </div>

          {/* Primary Oversized Thumb Buttons */}
          <div className="grid grid-cols-12 gap-2">
            <button
              type="button"
              disabled={safeIndex === 0}
              onClick={() => switchToSlot(safeIndex - 1)}
              className="col-span-3 flex min-h-[60px] items-center justify-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 text-sm font-bold text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-35"
            >
              <ChevronLeft className="h-5 w-5" />
              Préc.
            </button>

            <button
              type="button"
              onClick={handleToggleRun}
              className={`col-span-6 flex min-h-[60px] items-center justify-center gap-2 rounded-2xl text-lg font-black shadow-lg transition active:scale-[0.98] ${
                isRunning
                  ? 'bg-zinc-100 text-zinc-950 hover:bg-white'
                  : 'bg-amber-500 text-zinc-950 shadow-amber-500/25 hover:bg-amber-400'
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="h-6 w-6 fill-current" />
                  PAUSE
                </>
              ) : (
                <>
                  <Play className="h-6 w-6 fill-current" />
                  DÉMARRER
                </>
              )}
            </button>

            <button
              type="button"
              disabled={safeIndex >= slots.length - 1}
              onClick={() => {
                markSlotCompleted(true);
                switchToSlot(safeIndex + 1);
              }}
              className="col-span-3 flex min-h-[60px] items-center justify-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 text-sm font-bold text-white transition hover:bg-zinc-800 active:scale-95 disabled:opacity-35"
            >
              Suiv.
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tables Slide-Over Drawer (never interrupts timer) */}
      {tablesDrawerOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Users className="h-5 w-5 text-amber-400" />
                  Tables en cours
                </h3>
                <p className="text-xs text-zinc-400">
                  Chrono toujours actif ({formatTimer(remainingSeconds)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSwapPlayer(null);
                  setTablesDrawerOpen(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-300 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedSwapPlayer ? (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-400 bg-amber-500/20 px-3 py-2 text-xs text-amber-200">
                <span>
                  Permutation : choisissez un 2e joueur pour{' '}
                  <strong>{selectedSwapPlayer.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSwapPlayer(null)}
                  className="rounded bg-zinc-900 px-2 py-1 text-white"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <p className="mb-3 flex items-center gap-1.5 text-xs text-zinc-400">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Touchez 2 joueurs pour permuter, ou le badge A/B pour basculer
                une table.
              </p>
            )}

            <div className="space-y-3">
              {pairings.tables.map((table) => (
                <div
                  key={table.tableNumber}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-white">
                        Table {table.tableNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleTableGroup(table.tableNumber)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                          table.groupLevel === 'Groupe A (Confirmés)'
                            ? 'border-amber-500/40 bg-amber-500/20 text-amber-300'
                            : 'border-sky-500/40 bg-sky-500/20 text-sky-300'
                        }`}
                      >
                        {table.groupLevel === 'Groupe A (Confirmés)'
                          ? 'Groupe A'
                          : 'Groupe B'}
                      </button>
                    </div>
                    <span className="text-xs tabular-nums text-zinc-400">
                      Moy. {table.averagePoints} pts
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {table.players.map((p) => (
                      <button
                        key={`${p.id}-${p.rowIndex}`}
                        type="button"
                        onClick={() => handleSwapInDrawer(p)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                          selectedSwapPlayer?.id === p.id
                            ? 'border-amber-400 bg-amber-500/20'
                            : 'border-zinc-800 bg-zinc-950'
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-white">{p.name}</p>
                          <div className="mt-0.5 flex gap-1">
                            <RubberBadge side="CD" rubber={p.forehandRubber} />
                            <RubberBadge side="RV" rubber={p.backhandRubber} />
                          </div>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-amber-300">
                          {p.pointsFftt}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {pairings.basketPlayer && (
                <div className="rounded-2xl border border-teal-500/40 bg-teal-500/10 p-3">
                  <p className="mb-1.5 text-xs font-bold uppercase text-teal-300">
                    Panier de balles
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      pairings.basketPlayer &&
                      handleSwapInDrawer(pairings.basketPlayer)
                    }
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                      selectedSwapPlayer?.id === pairings.basketPlayer.id
                        ? 'border-amber-400 bg-amber-500/20'
                        : 'border-teal-500/30 bg-zinc-950'
                    }`}
                  >
                    <span className="font-semibold text-white">
                      {pairings.basketPlayer.name}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-teal-300">
                      {pairings.basketPlayer.pointsFftt}
                    </span>
                  </button>
                </div>
              )}

              {pairings.tables.length === 0 && !pairings.basketPlayer && (
                <p className="py-6 text-center text-sm text-zinc-500">
                  Aucune paire générée. Allez dans l’onglet Effectif pour
                  pointer les présents.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
