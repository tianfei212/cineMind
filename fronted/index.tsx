
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initFlexible } from './utils/flexible';
import { logger } from './utils/logger';

// Initialize flexible scaling
initFlexible();
logger.info('前端应用启动');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
