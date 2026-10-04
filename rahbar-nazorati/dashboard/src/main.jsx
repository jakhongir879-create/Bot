import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyTheme, getSavedTheme } from './theme.js';

applyTheme(getSavedTheme());

createRoot(document.getElementById('root')).render(<App />);
