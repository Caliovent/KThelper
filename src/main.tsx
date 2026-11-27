import './legacy/v2Bridge';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { MultiplayerArena } from './modules/arena/MultiplayerArena';
import { EvolutionaryFunnelLab } from './modules/funnel/EvolutionaryFunnelLab';
import { Range3BetBuilder } from './modules/ranges/Range3BetBuilder';
import { GuidePortal } from './modules/guide/GuidePortal';
import { isMpEnabled } from './stores/arenaStore';
import './index.css';

const mountEl = document.getElementById('coach-ia-root') ?? document.getElementById('root');
if (mountEl) {
  createRoot(mountEl).render(<App />);
}

const funnelEl = document.getElementById('evolutionary-funnel-root');
if (funnelEl) {
  createRoot(funnelEl).render(<EvolutionaryFunnelLab />);
}

const builder3BetEl = document.getElementById('range-3bet-builder-root');
if (builder3BetEl) {
  createRoot(builder3BetEl).render(<Range3BetBuilder />);
}

const arenaEl = document.getElementById('arena-mp-root');
if (arenaEl && isMpEnabled()) {
  createRoot(arenaEl).render(<MultiplayerArena />);
}

const guideEl = document.getElementById('guide-portal-root');
if (guideEl) {
  createRoot(guideEl).render(<GuidePortal />);
}
