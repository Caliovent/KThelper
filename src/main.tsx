import './legacy/v2Bridge';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { MultiplayerArena } from './modules/arena/MultiplayerArena';
import { GuidePortal } from './modules/guide/GuidePortal';
import { isMpEnabled } from './stores/arenaStore';
import './index.css';

const mountEl = document.getElementById('coach-ia-root') ?? document.getElementById('root');
if (mountEl) {
  createRoot(mountEl).render(<App />);
}

const arenaEl = document.getElementById('arena-mp-root');
if (arenaEl && isMpEnabled()) {
  createRoot(arenaEl).render(<MultiplayerArena />);
}

const guideEl = document.getElementById('guide-portal-root');
if (guideEl) {
  createRoot(guideEl).render(<GuidePortal />);
}
