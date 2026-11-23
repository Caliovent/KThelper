import React from 'react';

interface PokerCardVisualProps {
  card: string;
  size?: 'sm' | 'md' | 'lg';
}

const SUIT_META: Record<string, { symbol: string; colorClass: string }> = {
  s: { symbol: '♠', colorClass: 'text-slate-900' },
  h: { symbol: '♥', colorClass: 'text-rose-600' },
  d: { symbol: '♦', colorClass: 'text-sky-600' },
  c: { symbol: '♣', colorClass: 'text-emerald-700' },
};

export const PokerCardVisual: React.FC<PokerCardVisualProps> = ({ card, size = 'md' }) => {
  if (!card || card.length < 2) return null;

  const rankRaw = card[0].toUpperCase();
  const rank = rankRaw === 'T' ? '10' : rankRaw;
  const suitCode = card[1].toLowerCase();
  const suit = SUIT_META[suitCode] || SUIT_META.s;

  const dimClass =
    size === 'lg'
      ? 'w-14 h-20 rounded-xl p-2 text-base'
      : size === 'sm'
        ? 'w-9 h-12 rounded-lg p-1 text-xs'
        : 'w-11 h-16 rounded-xl p-1.5 text-sm';

  const symClass =
    size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';

  return (
    <div
      className={`poker-card ${dimClass} border border-slate-300 flex flex-col justify-between font-mono font-extrabold ${suit.colorClass} shrink-0 select-none`}
      aria-label={`${rank}${suit.symbol}`}
    >
      <span className="leading-none text-left tracking-tighter">{rank}</span>
      <span className={`leading-none text-center ${symClass}`}>{suit.symbol}</span>
    </div>
  );
};

export const HiddenPokerCard: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  const dimClass = size === 'sm' ? 'w-9 h-12 rounded-lg text-xs' : 'w-11 h-16 rounded-xl text-sm';
  return (
    <div
      className={`${dimClass} border border-rose-400/40 bg-gradient-to-br from-rose-900 to-slate-900 flex items-center justify-center font-mono font-extrabold text-rose-300 shadow shrink-0 select-none`}
    >
      ?
    </div>
  );
};
