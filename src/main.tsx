import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister any stale dev-sw.js service worker that may block preview iframe rendering
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      if (reg.active?.scriptURL.includes('dev-sw.js') || reg.installing?.scriptURL.includes('dev-sw.js') || reg.waiting?.scriptURL.includes('dev-sw.js')) {
        reg.unregister();
      }
    }
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
