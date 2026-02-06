import './index.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { ServerProvider } from './contexts/ServerContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ServerProvider>
        <App />
      </ServerProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
