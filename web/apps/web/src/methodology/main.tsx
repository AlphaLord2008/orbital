import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/design-system.css';
import './methodology.css';
import { Methodology } from './Methodology';

const container = document.getElementById('root');
if (!container) throw new Error('ORBITAL: #root element missing from methodology.html');

createRoot(container).render(
  <StrictMode>
    <Methodology />
  </StrictMode>,
);
