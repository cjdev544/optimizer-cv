import React from 'react';
import ReactDOM from 'react-dom/client';
import { CvOptimizerPanel } from '@/features/cv-optimizer/components/CvOptimizerPanel';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CvOptimizerPanel />
  </React.StrictMode>,
);
