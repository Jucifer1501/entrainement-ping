'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpen,
  Cloud,
  CloudOff,
  Loader2,
  LogIn,
  Radio,
  RefreshCw,
  Settings,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { EffectifModule } from '@/components/EffectifModule';
import { ExercicesModule } from '@/components/ExercicesModule';
import { LiveModule } from '@/components/LiveModule';
import { ClotureModule } from '@/components/ClotureModule';
import { HistoriqueModule } from '@/components/HistoriqueModule';
import { SettingsModal } from '@/components/SettingsModal';
import type { AppTab } from '@/types';

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'effectif', label: 'Effectif & Paires', shortLabel: 'Effectif', icon: Users },
  { id: 'exercices', label: 'Exercices & Plan', shortLabel: 'Exos', icon: BookOpen },
  { id: 'live', label: 'Live Table', shortLabel: 'Live', icon: Radio },
  { id: 'cloture', label: 'Clôture', shortLabel: 'Clôturer', icon: Archive },
  { id: 'historique', label: 'Historique & Stats', shortLabel: 'Stats', icon: BarChart3 },
];

export function AppShell() {
  const {
    activeTab,
    setActiveTab,
    isSignedIn,
    signInGoogle,
    syncNow,
    syncStatus,
    presentPlayers,
    toasts,
    dismissToast,
  } = useApp();

  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-obsidian text-zinc-100">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/90 bg-obsidian/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setActiveTab('effectif')}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-sm font-black text-zinc-950 shadow-md shadow-amber-500/20">
              TT
            </div>
            <div>
              <h1 className="text-sm font-black leading-none tracking-tight text-white sm:text-base">
                PingCoach Pro
              </h1>
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {presentPlayers.length} présent
                {presentPlayers.length > 1 ? 's' : ''}
              </p>
            </div>
          </button>

          {/* Desktop / iPad Navigation */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    isActive
                      ? item.id === 'live'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-100 text-zinc-950'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Sync & Auth Controls */}
          <div className="flex items-center gap-1.5">
            {!syncStatus.isOnline && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-300">
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hors ligne</span>
              </span>
            )}

            {syncStatus.pendingCount > 0 && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg border border-amber-500/50 bg-amber-500/20 px-2 py-1 text-[11px] font-bold tabular-nums text-amber-200"
                title="Opérations en file d'attente hors-ligne"
              >
                {syncStatus.pendingCount} en attente
              </button>
            )}

            {isSignedIn ? (
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={syncStatus.isSyncing}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                title="Synchroniser avec Google Sheets"
              >
                {syncStatus.isSyncing ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Cloud className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Sheets</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signInGoogle()}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-200 hover:border-amber-400 hover:text-amber-300"
                title="Se connecter à Google Sheets"
              >
                <LogIn className="h-3.5 w-3.5 text-amber-400" />
                <span>Google</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-white"
              aria-label="Paramètres Google Sheets"
            >
              {syncStatus.mode === 'google' ? (
                <Settings className="h-4 w-4" />
              ) : (
                <CloudOff className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`mx-auto max-w-7xl px-3 py-5 sm:px-6 ${
          activeTab === 'live' ? '' : 'pb-24 md:pb-8'
        }`}
      >
        {/* Error banner (shown on OAuth or Google Sheets error, NEVER falls back to demo data) */}
        {syncStatus.error && (
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-200">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p className="font-bold text-red-100">
                  Erreur de connexion Google Sheets
                </p>
                <p className="mt-1 leading-relaxed text-red-200/90">
                  {syncStatus.error}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-red-400"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Réessayer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void signInGoogle()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Connexion Google
                </button>
              )}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-xl border border-red-500/40 bg-zinc-950/60 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-zinc-900"
              >
                Paramètres
              </button>
            </div>
          </div>
        )}

        {/* Loading state while fetching real Google Sheets right after OAuth */}
        {syncStatus.dataSource === 'loading' && syncStatus.isSyncing ? (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950 px-6 py-14 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p className="mt-4 text-base font-bold text-white">
              Chargement de votre Google Sheets…
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Lecture des onglets Profils joueurs, Banque Exo, Préparation et Séances.
            </p>
          </div>
        ) : !isSignedIn && syncStatus.dataSource === 'empty' ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
              <Cloud className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-xl font-extrabold text-white">
              Connectez votre classeur Google Sheets
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Connectez-vous avec Google OAuth pour charger vos joueurs, votre
              banque d’exercices, votre préparation et votre historique réel
              depuis le classeur{' '}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-amber-300">
                {syncStatus.spreadsheetId.slice(0, 14)}…
              </code>
              .
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void signInGoogle()}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
              >
                <LogIn className="h-4 w-4" />
                Se connecter avec Google
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm font-semibold text-zinc-200 hover:border-zinc-600"
              >
                <Settings className="h-4 w-4" />
                Configurer Client ID
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'effectif' && <EffectifModule />}
            {activeTab === 'exercices' && <ExercicesModule />}
            {activeTab === 'live' && <LiveModule />}
            {activeTab === 'cloture' && <ClotureModule />}
            {activeTab === 'historique' && <HistoriqueModule />}
          </>
        )}
      </main>

      {/* Mobile Bottom Tab Bar (hidden in Live mode to prioritize one-handed timer dock) */}
      {activeTab !== 'live' && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800 bg-obsidian/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md md:hidden"
          aria-label="Navigation mobile"
        >
          <div className="grid grid-cols-5 gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-[50px] flex-col items-center justify-center rounded-xl text-[11px] font-bold transition ${
                    isActive
                      ? item.id === 'live'
                        ? 'bg-amber-500 text-zinc-950'
                        : 'bg-zinc-900 text-amber-400'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="mb-0.5 h-5 w-5" />
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed right-3 top-16 z-50 flex w-[calc(100%-1.5rem)] max-w-sm flex-col gap-2 sm:right-6">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold shadow-xl backdrop-blur-md ${
                toast.tone === 'success'
                  ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'
                  : toast.tone === 'warning'
                    ? 'border-amber-500/40 bg-amber-950/90 text-amber-200'
                    : toast.tone === 'error'
                      ? 'border-red-500/40 bg-red-950/90 text-red-200'
                      : 'border-zinc-700 bg-zinc-900/95 text-zinc-100'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 opacity-70 hover:opacity-100"
                aria-label="Fermer notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
