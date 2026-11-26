'use client';

import React from 'react';
import type {
  BasketSuitability,
  GroupeCible,
  NiveauCible,
  PicotCompatibility,
  RubberType,
} from '@/types';

const RUBBER_STYLES: Record<RubberType, string> = {
  BS: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Soft: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Picot long': 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold',
  'Anti-top': 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40 font-semibold',
};

export function RubberBadge({
  side,
  rubber,
}: {
  side: 'CD' | 'RV';
  rubber: RubberType;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${RUBBER_STYLES[rubber]}`}
    >
      <span className="opacity-70">{side}</span>
      <span>{rubber}</span>
    </span>
  );
}

const PICOT_STYLES: Record<PicotCompatibility, string> = {
  'Spécifique Picot':
    'bg-amber-500/20 text-amber-300 border-amber-500/45 font-semibold',
  Adapté: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'À adapter': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'Non adapté': 'bg-zinc-800 text-zinc-400 border-zinc-700',
};

export function PicotBadge({
  compatibility,
}: {
  compatibility: PicotCompatibility;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${PICOT_STYLES[compatibility]}`}
    >
      {compatibility}
    </span>
  );
}

const BASKET_STYLES: Record<BasketSuitability, string> = {
  Oui: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  Possible: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  'Non adapté': 'bg-zinc-900 text-zinc-500 border-zinc-800',
};

export function BasketBadge({
  suitability,
}: {
  suitability: BasketSuitability;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${BASKET_STYLES[suitability]}`}
    >
      Panier : {suitability}
    </span>
  );
}

const NIVEAU_STYLES: Record<NiveauCible, string> = {
  'Tous niveaux': 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80',
  Débutant: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Intermédiaire: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  Confirmé: 'bg-amber-500/15 text-amber-300 border-amber-500/35',
};

export function NiveauBadge({
  niveau = 'Tous niveaux',
}: {
  niveau?: NiveauCible;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${NIVEAU_STYLES[niveau]}`}
    >
      {niveau}
    </span>
  );
}

export function GroupeBadge({
  groupe = 'Tous',
}: {
  groupe?: GroupeCible;
}) {
  const style =
    groupe === 'Groupe A (Confirmés)'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
      : groupe === 'Groupe B (Débutants)'
        ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
        : 'bg-zinc-800 text-zinc-300 border-zinc-700';
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${style}`}
    >
      {groupe}
    </span>
  );
}
