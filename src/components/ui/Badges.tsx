'use client';

import React from 'react';
import type {
  BasketSuitability,
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
