/**
 * useToast Hook
 * Provides a simple API for showing toast notifications
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ToastNotification, ToastMessage, ToastType } from '../components/UI/Toast';

interface ToastContextValue {
  showToast: (type: ToastType, title: string, description?: string) => void;
  showSuccess: (title: string, description?: string) => void;
  showError: (title: string, description?: string) => void;
  showInfo: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastContextProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, title: string, description?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, description }]);
  }, []);

  const showSuccess = useCallback((title: string, description?: string) => {
    showToast('success', title, description);
  }, [showToast]);

  const showError = useCallback((title: string, description?: string) => {
    showToast('error', title, description);
  }, [showToast]);

  const showInfo = useCallback((title: string, description?: string) => {
    showToast('info', title, description);
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}
      {toasts.map((toast) => (
        <ToastNotification key={toast.id} message={toast} onClose={removeToast} />
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastContextProvider');
  }
  return context;
}
