'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { RubberBadge } from '@/components/ui/Badges';
import { hasSpecialRubber } from '@/services/pairings';
import type {
  ActiveStatus,
  Player,
  PlayerInput,
  RubberType,
} from '@/types';

const RUBBERS: RubberType[] = ['BS', 'Soft', 'Picot long', 'Anti-top'];

interface PlayerModalProps {
  initialPlayer: Player | null;
  onClose: () => void;
  onSubmit: (input: PlayerInput, existing: Player | null) => Promise<void>;
}

function PlayerModal({ initialPlayer, onClose, onSubmit }: PlayerModalProps) {
  const [name, setName] = useState(initialPlayer?.name ?? '');
  const [pointsFftt, setPointsFftt] = useState(
    String(initialPlayer?.pointsFftt ?? 800)
  );
  const [forehandRubber, setForehandRubber] = useState<RubberType>(
    initialPlayer?.forehandRubber ?? 'BS'
  );
  const [backhandRubber, setBackhandRubber] = useState<RubberType>(
    initialPlayer?.backhandRubber ?? 'BS'
  );
  const [playStyle, setPlayStyle] = useState(initialPlayer?.playStyle ?? '');
  const [active, setActive] = useState<ActiveStatus>(
    initialPlayer?.active ?? 'Oui'
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(
        {
          name: name.trim(),
          pointsFftt: Math.max(500, Number.parseInt(pointsFftt, 10) || 500),
          forehandRubber,
          backhandRubber,
          playStyle: playStyle.trim(),
          active,
        },
        initialPlayer
      );
      onClose();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Erreur inattendue lors de l’enregistrement.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">
            {initialPlayer
              ? `Modifier ${initialPlayer.name}`
              : 'Nouveau joueur'}
          </h3>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Nom / Prénom
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Julien M."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-base text-white outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Points FFTT
              </label>
              <input
                type="number"
                min={500}
                max={4000}
                required
                value={pointsFftt}
                onChange={(e) => setPointsFftt(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-base tabular-nums text-white outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Plaque Coup Droit (CD)
              </label>
              <select
                value={forehandRubber}
                onChange={(e) => setForehandRubber(e.target.value as RubberType)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-base text-white outline-none focus:border-amber-500"
              >
                {RUBBERS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
                Plaque Revers (RV)
              </label>
              <select
                value={backhandRubber}
                onChange={(e) => setBackhandRubber(e.target.value as RubberType)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-base text-white outline-none focus:border-amber-500"
              >
                {RUBBERS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400">
              Style de jeu
            </label>
            <input
              type="text"
              value={playStyle}
              onChange={(e) => setPlayStyle(e.target.value)}
              placeholder="Ex : Crabe à la table / Topspin deux côtés"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-base text-white outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-white">Statut actif</p>
              <p className="text-xs text-zinc-400">
                Afficher par défaut lors du pointage des présents
              </p>
            </div>
            <div className="flex gap-2">
              {(['Oui', 'Non'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setActive(status)}
                  className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition ${
                    active === status
                      ? status === 'Oui'
                        ? 'bg-emerald-500 text-zinc-950'
                        : 'bg-zinc-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
              {formError}
            </div>
          )}

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
                : initialPlayer
                  ? 'Enregistrer'
                  : 'Ajouter le joueur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EffectifModule() {
  const {
    players,
    presentPlayerIds,
    presentPlayers,
    presentSpecialPlayers,
    picotActive,
    togglePlayerPresence,
    setAllActivePresent,
    pairingMode,
    setPairingMode,
    oddMode,
    setOddMode,
    pairings,
    regeneratePairings,
    swapPairingsPlayers,
    addPlayer,
    updatePlayer,
  } = useApp();

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'active' | 'all' | 'picot'>(
    'active'
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [selectedForSwap, setSelectedForSwap] = useState<Player | null>(null);

  const presentSet = useMemo(
    () => new Set(presentPlayerIds),
    [presentPlayerIds]
  );

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...players]
      .filter((p) => {
        if (filterMode === 'active' && p.active !== 'Oui') return false;
        if (filterMode === 'picot' && !hasSpecialRubber(p)) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.playStyle.toLowerCase().includes(q) ||
          p.forehandRubber.toLowerCase().includes(q) ||
          p.backhandRubber.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.pointsFftt - a.pointsFftt);
  }, [players, search, filterMode]);

  const handlePlayerModalSubmit = async (
    input: PlayerInput,
    existing: Player | null
  ) => {
    if (existing) {
      await updatePlayer({
        ...existing,
        ...input,
      });
    } else {
      await addPlayer(input);
    }
  };

  const handleTapPairingPlayer = (player: Player) => {
    if (!selectedForSwap) {
      setSelectedForSwap(player);
      return;
    }
    if (selectedForSwap.id === player.id) {
      setSelectedForSwap(null);
      return;
    }
    swapPairingsPlayers(selectedForSwap.id, player.id);
    setSelectedForSwap(null);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left column: Roster & Attendance */}
      <section className="space-y-4 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">
              Effectif & Présences
            </h2>
            <p className="text-sm text-zinc-400">
              <span className="font-semibold text-amber-400">
                {presentPlayers.length} présent
                {presentPlayers.length > 1 ? 's' : ''}
              </span>{' '}
              sur {players.length} joueurs enregistrés
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingPlayer(null);
              setModalOpen(true);
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/10 transition hover:bg-amber-400 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nouveau joueur
          </button>
        </div>

        {/* Picot detection indicator */}
        {picotActive && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <span className="font-bold text-amber-300">
                Mode Picot / Anti-top détecté
              </span>{' '}
              ({presentSpecialPlayers.map((p) => p.name).join(', ')}). Les
              exercices spécifiques seront mis en avant dans la bibliothèque.
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un joueur, style, plaque..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pl-10 pr-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                ['active', 'Actifs'],
                ['all', 'Tous'],
                ['picot', 'Picot/Anti'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFilterMode(val)}
                className={`min-h-[44px] rounded-xl px-3 text-xs font-semibold transition ${
                  filterMode === val
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick selection actions */}
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Touchez la case (48px) pour pointer les présents</span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAllActivePresent(true)}
              className="font-medium text-amber-400 hover:underline"
            >
              Tous actifs
            </button>
            <button
              type="button"
              onClick={() => setAllActivePresent(false)}
              className="font-medium text-zinc-400 hover:text-white hover:underline"
            >
              Tout décocher
            </button>
          </div>
        </div>

        {/* Player list */}
        <div className="space-y-2">
          {filteredPlayers.map((player) => {
            const isPresent = presentSet.has(player.id);
            const isSpecial = hasSpecialRubber(player);

            return (
              <div
                key={`${player.id}-${player.rowIndex}`}
                className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                  isPresent
                    ? 'border-amber-500/50 bg-amber-500/[0.06]'
                    : 'border-zinc-800/90 bg-zinc-900/60 hover:border-zinc-700'
                } ${player.active === 'Non' ? 'opacity-65' : ''}`}
              >
                {/* >= 48px touch checkbox */}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isPresent}
                  aria-label={`Pointer ${player.name} présent`}
                  onClick={() => togglePlayerPresence(player.id)}
                  className={`flex h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-95 ${
                    isPresent
                      ? 'border-amber-400 bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                      : 'border-zinc-700 bg-zinc-950 text-transparent hover:border-zinc-500'
                  }`}
                >
                  <Check className="h-6 w-6 stroke-[3]" />
                </button>

                {/* Info */}
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => togglePlayerPresence(player.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-bold text-white">
                      {player.name}
                    </span>
                    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-300">
                      {player.pointsFftt} pts
                    </span>
                    {isSpecial && (
                      <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                        Spécial
                      </span>
                    )}
                    {player.active === 'Non' && (
                      <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                        Inactif
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <RubberBadge side="CD" rubber={player.forehandRubber} />
                    <RubberBadge side="RV" rubber={player.backhandRubber} />
                    {player.playStyle && (
                      <span className="truncate text-xs text-zinc-400">
                        • {player.playStyle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Participations & Edit */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-2.5 py-0.5 text-xs font-medium tabular-nums text-zinc-300"
                    title="Participations"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                    {player.participations}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPlayer(player);
                      setModalOpen(true);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-white"
                    aria-label={`Modifier ${player.name}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredPlayers.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-800 py-10 text-center text-sm text-zinc-500">
              Aucun joueur trouvé pour ce filtre.
            </div>
          )}
        </div>
      </section>

      {/* Right column: Automatic Pairings & Tap-to-Swap */}
      <section className="space-y-4 lg:col-span-5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">
                Constitution des Paires
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedForSwap(null);
                regeneratePairings();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500 hover:text-amber-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Recalculer
            </button>
          </div>

          {/* Pairing Mode Toggle */}
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Algorithme
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForSwap(null);
                    setPairingMode('HOMOGENE');
                  }}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    pairingMode === 'HOMOGENE'
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  Homogène (FFTT)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForSwap(null);
                    setPairingMode('OPPOSITION_STYLES');
                  }}
                  className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition ${
                    pairingMode === 'OPPOSITION_STYLES'
                      ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  Opposition Styles (Picot/BS)
                </button>
              </div>
            </div>

            {/* Odd Mode Toggle */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Si effectif impair ({presentPlayers.length % 2 === 1 ? 'actif' : 'en réserve'})
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForSwap(null);
                    setOddMode('GROUPE_3');
                  }}
                  className={`min-h-[40px] rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    oddMode === 'GROUPE_3'
                      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  Groupe de 3 (médian)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForSwap(null);
                    setOddMode('PANIER_BALLES');
                  }}
                  className={`min-h-[40px] rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    oddMode === 'PANIER_BALLES'
                      ? 'border-teal-500/60 bg-teal-500/15 text-teal-300'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  Panier de balles
                </button>
              </div>
            </div>
          </div>

          {/* Swap helper banner */}
          <div className="mt-4">
            {selectedForSwap ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400 bg-amber-500/20 px-3 py-2.5 text-xs font-semibold text-amber-200">
                <span className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-amber-300" />
                  Touchez un 2e joueur pour permuter avec{' '}
                  <strong className="text-white">{selectedForSwap.name}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedForSwap(null)}
                  className="rounded-lg bg-zinc-950/70 px-2 py-1 text-zinc-300 hover:text-white"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-500" />
                Permutation manuelle : touchez un joueur puis un second pour
                échanger leurs tables.
              </p>
            )}
          </div>

          {/* Tables list */}
          <div className="mt-4 space-y-3">
            {pairings.tables.map((table) => (
              <div
                key={table.tableNumber}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 items-center rounded-md bg-zinc-800 px-2 text-xs font-bold text-white">
                      Table {table.tableNumber}
                    </span>
                    {table.players.length === 3 && (
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        Trio
                      </span>
                    )}
                    {table.isStyleOpposition && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                        <Sparkles className="h-3 w-3" />
                        Opposition
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-zinc-400">
                    <Trophy className="h-3.5 w-3.5 text-amber-400/80" />
                    Moy. {table.averagePoints} pts
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {table.players.map((p) => {
                    const isPicked = selectedForSwap?.id === p.id;
                    return (
                      <button
                        key={`${p.id}-${p.rowIndex}`}
                        type="button"
                        onClick={() => handleTapPairingPlayer(p)}
                        className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] ${
                          isPicked
                            ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50'
                            : 'border-zinc-800 bg-zinc-900/80 hover:border-zinc-600'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-white">
                            {p.name}
                          </span>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            <RubberBadge side="CD" rubber={p.forehandRubber} />
                            <RubberBadge side="RV" rubber={p.backhandRubber} />
                          </div>
                        </div>
                        <span className="ml-2 shrink-0 text-xs font-bold tabular-nums text-amber-300">
                          {p.pointsFftt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Dedicated Basket Slot */}
            {pairings.basketPlayer && (
              <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-teal-300">
                    Panier de balles
                  </span>
                  <span className="text-xs text-teal-200/70">
                    Joueur impair affecté
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    pairings.basketPlayer &&
                    handleTapPairingPlayer(pairings.basketPlayer)
                  }
                  className={`flex min-h-[46px] w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                    selectedForSwap?.id === pairings.basketPlayer.id
                      ? 'border-amber-400 bg-amber-500/20 ring-2 ring-amber-400/50'
                      : 'border-teal-500/30 bg-zinc-950/90 hover:border-teal-400'
                  }`}
                >
                  <div>
                    <span className="block text-sm font-semibold text-white">
                      {pairings.basketPlayer.name}
                    </span>
                    <div className="mt-0.5 flex gap-1">
                      <RubberBadge
                        side="CD"
                        rubber={pairings.basketPlayer.forehandRubber}
                      />
                      <RubberBadge
                        side="RV"
                        rubber={pairings.basketPlayer.backhandRubber}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-teal-300">
                    {pairings.basketPlayer.pointsFftt}
                  </span>
                </button>
              </div>
            )}

            {pairings.tables.length === 0 && !pairings.basketPlayer && (
              <div className="rounded-xl border border-dashed border-zinc-800 py-8 text-center text-sm text-zinc-500">
                Pointez au moins 2 présents à gauche pour générer les tables.
              </div>
            )}
          </div>
        </div>
      </section>

      {modalOpen && (
        <PlayerModal
          initialPlayer={editingPlayer}
          onClose={() => setModalOpen(false)}
          onSubmit={handlePlayerModalSubmit}
        />
      )}
    </div>
  );
}
