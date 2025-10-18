import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { attachConsole } from "@tauri-apps/plugin-log";

// Extend the Window interface to include __TAURI__
declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

(async () => {
  // Forward Rust logs to the browser/DevTools console in dev
  // Only attach console if running in Tauri
  if (window.__TAURI__) {
    await attachConsole();
  }
  // then continue your app init...
})();