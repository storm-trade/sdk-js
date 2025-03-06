import './polyfills'; // Must be first import
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Environment variables validation function
const validateRequiredEnvVars = () => {
  const requiredVars = [
    'VITE_STORM_API_URL',
    'VITE_ORACLE_URL',
    'VITE_TON_CENTER_URL',
  ];
  
  const missingVars = requiredVars.filter(varName => !import.meta.env[varName]);
  
  if (missingVars.length > 0) {
    const errorElement = document.createElement('div');
    errorElement.style.color = 'red';
    errorElement.style.fontFamily = 'monospace';
    errorElement.style.padding = '20px';
    errorElement.style.maxWidth = '800px';
    errorElement.style.margin = '50px auto';
    errorElement.style.border = '2px solid red';
    errorElement.style.borderRadius = '5px';
    errorElement.style.backgroundColor = '#fff0f0';
    
    errorElement.innerHTML = `
      <h1>Environment Configuration Error</h1>
      <p>The following required environment variables are missing:</p>
      <ul>
        ${missingVars.map(varName => `<li><code>${varName}</code></li>`).join('')}
      </ul>
      <p>Please make sure you have created a <code>.env</code> file with all required variables.</p>
      <p>You can copy the <code>.env.example</code> file as a starting point:</p>
      <pre>cp .env.example .env</pre>
      <p>Then edit the file to add your actual values.</p>
      <p><strong>Note:</strong> After updating the <code>.env</code> file, you'll need to restart the development server.</p>
    `;
    
    document.body.innerHTML = '';
    document.body.appendChild(errorElement);
    
    // Prevent the React app from rendering
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// Validate environment variables before rendering the app
validateRequiredEnvVars();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
