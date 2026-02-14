import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface Toast {
  id: string;
  message: string;
  level: 'error' | 'info';
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, level?: 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, level: 'error' | 'info' = 'error') => {
    const id = String(++nextId);
    setToasts((prev) => [...prev, { id, message, level }]);

    // Auto-dismiss info toasts after 5s, error toasts after 10s
    const timeout = level === 'error' ? 10000 : 5000;
    setTimeout(() => removeToast(id), timeout);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
