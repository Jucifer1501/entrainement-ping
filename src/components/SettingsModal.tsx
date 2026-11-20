'use client';

import React, { useState } from 'react';
import {
  Cloud,
  CloudOff,
  KeyRound,
  LogIn,
  LogOut,
  RefreshCw,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  getConfiguredClientId,
  getConfiguredSpreadsheetId,
  setCustomClientId,
  setCustomSpreadsheetId,
} from '@/services/googleAuth';
import { outboxQueue } from '@/services/offlineQueue';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    isSignedIn,
    signInGoogle,
    signOutGoogle,
    syncNow,
    syncStatus,
    outbox,
    pushToast,
  } = useApp();

  const [clientId, setClientId] = useState(() => getConfiguredClientId());
  const [spreadsheetId, setSpreadsheetId] = useState(() =>
    getConfiguredSpreadsheetId()
  );

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomClientId(clientId);
    setCustomSpreadsheetId(spreadsheetId);
    pushToast('success', 'Paramètres Google enregistrés localement.');
    if (isSignedIn) {
      await syncNow();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Settings className="h-5 w-5 text-amber-400" />
            Google Sheets & Hors-ligne
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-zinc-400 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Auth Status */}
        <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {isSignedIn ? (
                <Cloud className="h-5 w-5 text-emerald-400" />
              ) : (
                <CloudOff className="h-5 w-5 text-zinc-400" />
              )}
              <div>
                <p className="text-sm font-bold text-white">
                  {isSignedIn
                    ? 'Connecté à Google Sheets'
                    : 'Mode Local (hors-ligne / démo)'}
                </p>
                <p className="text-xs text-zinc-400">
                  {syncStatus.lastSyncedAt
                    ? `Dernière synchro : ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString('fr-FR')}`
                    : 'Aucune synchronisation effectuée'}
                </p>
              </div>
            </div>

            {isSignedIn ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void syncNow()}
                  className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white hover:border-amber-400"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`}
                  />
                  Sync
                </button>
                <button
                  type="button"
                  onClick={signOutGoogle}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Déco
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void signInGoogle()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400"
              >
                <LogIn className="h-3.5 w-3.5" />
                Connexion Google
              </button>
            )}
          </div>

          {syncStatus.error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {syncStatus.error}
            </p>
          )}
        </div>

        {/* Config form */}
        <form onSubmit={handleSaveConfig} className="space-y-3">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              <KeyRound className="h-3.5 w-3.5 text-amber-400" />
              Google OAuth Client ID (GIS)
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxx.apps.googleusercontent.com"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Spreadsheet ID
            </label>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 py-2.5 text-xs font-bold text-white hover:border-amber-400 hover:text-amber-300"
          >
            Enregistrer la configuration
          </button>
        </form>

        {/* Outbox Queue */}
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">
              File d’attente hors-ligne ({outbox.length})
            </h4>
            {outbox.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  outboxQueue.clear();
                  pushToast('info', 'File d’attente vidée.');
                  window.location.reload();
                }}
                className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Vider
              </button>
            )}
          </div>

          {outbox.length === 0 ? (
            <p className="text-xs text-zinc-500">
              Aucune opération en attente de synchronisation.
            </p>
          ) : (
            <div className="space-y-2">
              {outbox.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">
                      {item.type}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      essais : {item.retryCount}
                    </span>
                  </div>
                  {item.type === 'CLOSE_SESSION' && (
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-300">
                      ID_Session : {item.payload.sessionId}
                    </p>
                  )}
                  {item.lastError && (
                    <p className="mt-1 text-[11px] text-red-300">
                      {item.lastError}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
