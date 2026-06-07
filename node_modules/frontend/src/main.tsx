import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { LanguageProvider } from './i18n/LanguageContext';
import './styles.css';

function Root() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Unable to mount app: #root element was not found.');
}

ReactDOM.createRoot(rootElement).render(<Root />);