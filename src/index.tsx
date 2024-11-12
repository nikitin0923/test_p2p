import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import P2PCISPayment from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <P2PCISPayment />
    </React.StrictMode>
  );
}