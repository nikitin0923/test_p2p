import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { P2PCISPayment } from './App';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <P2PCISPayment />
  </React.StrictMode>
);
