import {createRoot} from 'react-dom/client';
import {PortalApp} from './portal/PortalApp.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<PortalApp />);
