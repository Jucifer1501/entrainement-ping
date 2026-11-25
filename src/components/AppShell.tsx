'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  BookOpen,
  Cloud,
  CloudOff,
  Eye,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
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
    authMode,
    viewerUser,
    isReadOnly,
    isSignedIn,
    signInGoogle,
    signInWithPassword,
    signOut,
    syncNow,
    syncStatus,
    presentPlayers,
    toasts,
    dismissToast,
  } = useApp();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleViewerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword || loginBusy) return;
    setLoginBusy(true);
    setLoginError(null);
    try {
      await signInWithPassword(loginEmail.trim(), loginPassword);
      setLoginPassword('');
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : 'Connexion impossible.'
      );
    } finally {
      setLoginBusy(false);
    }
  };

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
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Navigation principale"
          >
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

            {!isReadOnly && syncStatus.pendingCount > 0 && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-lg border border-amber-500/50 bg-amber-500/20 px-2 py-1 text-[11px] font-bold tabular-nums text-amber-200"
                title="Opérations en file d'attente hors-ligne"
              >
                {syncStatus.pendingCount} en attente
              </button>
            )}

            {authMode === 'viewer' ? (
              <>
                <span
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/15 px-2.5 py-1.5 text-xs font-bold text-sky-300"
                  title={`Connecté en lecture seule (${viewerUser?.email ?? ''})`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Lecture seule</span>
                </span>
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  disabled={syncStatus.isSyncing}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-sky-400 hover:text-sky-300"
                  title="Actualiser les données"
                  aria-label="Actualiser les données"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${syncStatus.isSyncing ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-red-500/50 hover:text-red-300"
                  title="Déconnexion"
                  aria-label="Déconnexion"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : authMode === 'google' ? (
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

            {authMode !== 'viewer' && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-white"
                aria-label="Paramètres Google Sheets"
              >
                {authMode === 'google' ? (
                  <Settings className="h-4 w-4" />
                ) : (
                  <CloudOff className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className={`mx-auto max-w-7xl px-3 py-5 sm:px-6 ${
          activeTab === 'live' ? '' : 'pb-24 md:pb-8'
        }`}
      >
        {/* Read-Only Banner for Email/Password Viewers */}
        {isReadOnly && activeTab !== 'live' && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-500/35 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-200">
            <span className="flex items-center gap-2">
              <Eye className="h-4 w-4 shrink-0 text-sky-400" />
              <span>
                Connecté en <strong>mode lecture seule</strong> (
                {viewerUser?.name ?? viewerUser?.email}) — Consultation libre
                sans modification du Google Sheets.
              </span>
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-sky-500/30 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-zinc-900"
            >
              Déconnexion
            </button>
          </div>
        )}

        {/* Error banner (NEVER falls back to demo data) */}
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
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="rounded-xl border border-red-500/40 bg-zinc-950/60 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-zinc-900"
                >
                  Paramètres
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading state while fetching real Google Sheets right after login */}
        {syncStatus.dataSource === 'loading' && syncStatus.isSyncing ? (
          <div className="mx-auto flex max-w-md flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950 px-6 py-14 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <p className="mt-4 text-base font-bold text-white">
              Chargement de votre Google Sheets…
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Lecture des onglets Profils joueurs, Banque Exo, Préparation et
              Séances.
            </p>
          </div>
        ) : !isSignedIn && syncStatus.dataSource === 'empty' ? (
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
            {/* Admin Google OAuth Login Card */}
            <div className="flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-7">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                  <Cloud className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-white">
                  Accès Entraîneur (Google)
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Accès complet en <strong>lecture et écriture</strong> sur le
                  classeur{' '}
                  <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-amber-300">
                    {syncStatus.spreadsheetId.slice(0, 14)}…
                  </code>
                  . Ajout de joueurs, d’exercices, sauvegarde de préparation et
                  clôture de séances.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => void signInGoogle()}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400"
                >
                  <LogIn className="h-4 w-4" />
                  Se connecter avec Google
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-zinc-300 hover:border-zinc-600"
                >
                  <Settings className="h-4 w-4" />
                  Paramètres OAuth / Classeur
                </button>
              </div>
            </div>

            {/* Viewer Email + Password Login Card (Strict Read-Only) */}
            <div className="flex flex-col justify-between rounded-3xl border border-sky-500/30 bg-zinc-950 p-6 sm:p-7">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400">
                    <Eye className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-[11px] font-bold text-sky-300">
                    Lecture seule
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-extrabold text-white">
                  Accès Invité (E-mail)
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                  Connectez-vous avec votre adresse e-mail et mot de passe pour
                  consulter l’effectif, les exercices, le mode Live et
                  l’historique <strong>sans modifier le Google Sheets</strong>.
                </p>

                <form onSubmit={handleViewerLogin} className="mt-5 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Adresse e-mail
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="prenom@club.fr"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pl-10 pr-3.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="password"
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pl-10 pr-3.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  {loginError && (
                    <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3.5 py-2.5 text-xs text-red-200">
                      {loginError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loginBusy}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-black text-zinc-950 shadow-lg shadow-sky-500/15 transition hover:bg-sky-400 disabled:opacity-50"
                  >
                    {loginBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Connexion...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Connexion lecture seule
                      </>
                    )}
                  </button>
                </form>
              </div>
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
