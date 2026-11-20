'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  History,
  Trophy,
  Users,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { RubberBadge } from '@/components/ui/Badges';
import type { SessionLogRow } from '@/types';

interface GroupedSession {
  key: string;
  sessionId: string;
  date: string;
  totalMinutes: number;
  participants: string[];
  rows: SessionLogRow[];
}

export function HistoriqueModule() {
  const { sessions, players } = useApp();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const groupedSessions = useMemo<GroupedSession[]>(() => {
    const map = new Map<string, GroupedSession>();

    for (const row of sessions) {
      const key = row.sessionId || `DATE-${row.date}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          sessionId: row.sessionId,
          date: row.date,
          totalMinutes: row.durationMin,
          participants: [...row.participants],
          rows: [row],
        });
      } else {
        existing.totalMinutes += row.durationMin;
        existing.rows.push(row);
        for (const p of row.participants) {
          if (!existing.participants.includes(p)) {
            existing.participants.push(p);
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [sessions]);

  const totalVolumeMinutes = useMemo(
    () => sessions.reduce((sum, s) => sum + s.durationMin, 0),
    [sessions]
  );

  const avgParticipants = useMemo(() => {
    if (groupedSessions.length === 0) return 0;
    const total = groupedSessions.reduce(
      (sum, g) => sum + g.participants.length,
      0
    );
    return Math.round((total / groupedSessions.length) * 10) / 10;
  }, [groupedSessions]);

  // Volume distribution by Axis
  const axisDistribution = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of sessions) {
      const axis = row.axis || 'Autre';
      totals.set(axis, (totals.get(axis) ?? 0) + row.durationMin);
    }
    const entries = Array.from(totals.entries())
      .map(([axis, minutes]) => ({
        axis,
        minutes,
        pct:
          totalVolumeMinutes > 0
            ? Math.round((minutes / totalVolumeMinutes) * 100)
            : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return entries;
  }, [sessions, totalVolumeMinutes]);

  // Player attendance leaderboard
  const attendanceRanking = useMemo(() => {
    const sorted = [...players].sort(
      (a, b) =>
        b.participations - a.participations || b.pointsFftt - a.pointsFftt
    );
    const maxParticipations = Math.max(
      1,
      ...sorted.map((p) => p.participations)
    );
    return { sorted, maxParticipations };
  }, [players]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Historique & Stats</h2>
        <p className="text-sm text-zinc-400">
          Suivi du volume par Axe d’entraînement, assiduité des joueurs et
          journal des séances archivées.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <History className="h-4 w-4 text-amber-400" />
            Séances archivées
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">
            {groupedSessions.length}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <Clock className="h-4 w-4 text-emerald-400" />
            Volume cumulé
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">
            {(totalVolumeMinutes / 60).toFixed(1)}h
          </p>
          <p className="text-xs tabular-nums text-zinc-500">
            {totalVolumeMinutes} min
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <Users className="h-4 w-4 text-sky-400" />
            Présence moyenne
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">
            {avgParticipants}
          </p>
          <p className="text-xs text-zinc-500">joueurs / séance</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
            <Flame className="h-4 w-4 text-fuchsia-400" />
            Blocs réalisés
          </div>
          <p className="mt-2 text-3xl font-black tabular-nums text-white">
            {sessions.length}
          </p>
          <p className="text-xs text-zinc-500">exercices logués</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Volume by Axis */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 lg:col-span-6">
          <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            Répartition du volume par Axe
          </h3>

          <div className="space-y-4">
            {axisDistribution.map((entry) => (
              <div key={entry.axis}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-zinc-200">
                    {entry.axis}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-amber-300">
                    {entry.minutes} min ({entry.pct}%)
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-950">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
                    style={{ width: `${Math.max(4, entry.pct)}%` }}
                  />
                </div>
              </div>
            ))}

            {axisDistribution.length === 0 && (
              <p className="py-8 text-center text-sm text-zinc-500">
                Archivez votre première séance pour visualiser la répartition
                par Axe.
              </p>
            )}
          </div>
        </section>

        {/* Attendance Leaderboard */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 lg:col-span-6">
          <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
            <Trophy className="h-5 w-5 text-amber-400" />
            Classement d’assiduité
          </h3>

          <div className="space-y-2.5">
            {attendanceRanking.sorted.map((player, idx) => {
              const barPct = Math.round(
                (player.participations / attendanceRanking.maxParticipations) *
                  100
              );
              return (
                <div
                  key={`${player.id}-${player.rowIndex}`}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-black tabular-nums ${
                          idx === 0
                            ? 'bg-amber-400 text-zinc-950'
                            : idx === 1
                              ? 'bg-zinc-300 text-zinc-950'
                              : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="truncate text-sm font-bold text-white">
                        {player.name}
                      </span>
                      <span className="hidden text-xs tabular-nums text-zinc-500 sm:inline">
                        {player.pointsFftt} pts
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="hidden gap-1 sm:flex">
                        <RubberBadge side="CD" rubber={player.forehandRubber} />
                        <RubberBadge side="RV" rubber={player.backhandRubber} />
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-emerald-300">
                        {player.participations}×
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.max(2, barPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Past Sessions Log */}
      <section className="space-y-3">
        <h3 className="text-base font-bold text-white">
          Journal des séances passées
        </h3>

        {groupedSessions.map((group) => {
          const isOpen = expandedKey === group.key;
          return (
            <div
              key={group.key}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60"
            >
              <button
                type="button"
                onClick={() => setExpandedKey(isOpen ? null : group.key)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      {group.date}
                    </span>
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-amber-300">
                      {group.totalMinutes} min
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs tabular-nums text-zinc-300">
                      {group.rows.length} exo{group.rows.length > 1 ? 's' : ''}
                    </span>
                    {group.sessionId && (
                      <span className="hidden font-mono text-[11px] text-zinc-500 sm:inline">
                        {group.sessionId}
                      </span>
                    )}
                  </div>

                  {group.participants.length > 0 && (
                    <p className="mt-1.5 truncate text-xs text-zinc-400">
                      Présents ({group.participants.length}) :{' '}
                      {group.participants.join(', ')}
                    </p>
                  )}
                </div>

                {isOpen ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-zinc-400" />
                )}
              </button>

              {isOpen && (
                <div className="space-y-2 border-t border-zinc-800 bg-zinc-950/70 p-4">
                  {group.rows.map((row, i) => (
                    <div
                      key={`${row.rowIndex}-${i}`}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-amber-400">
                          #{row.order} • {row.axis}
                        </p>
                        <p className="text-sm font-bold text-white">
                          {row.exerciseName}
                        </p>
                        {row.details && (
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {row.details}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-lg bg-zinc-950 px-2.5 py-1 text-xs font-bold tabular-nums text-zinc-200">
                        {row.durationMin} min
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {groupedSessions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
            Aucune séance enregistrée pour le moment.
          </div>
        )}
      </section>
    </div>
  );
}
