import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { exposeBuildInfo } from './config/buildInfo';
import { LanguageProvider } from './i18n/LanguageContext';
import './styles/legacy.css';
import './styles/foundation.css';
import './styles/marketplace.css';
import './styles/pages.css';

function Root() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

exposeBuildInfo();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Unable to mount app: #root element was not found.');
}

ReactDOM.createRoot(rootElement).render(<Root />);