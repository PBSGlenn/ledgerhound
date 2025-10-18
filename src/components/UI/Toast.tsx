/**
 * Toast Notification Component
 * Displays temporary notifications for success, error, and info messages
 */

import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import * as Toast from '@radix-ui/react-toast';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastNotificationProps {
  message: ToastMessage;
  onClose: (id: string) => void;
}

export function ToastNotification({ message, onClose }: ToastNotificationProps) {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-600" />,
    error: <XCircle className="w-5 h-5 text-red-600" />,
    info: <Info className="w-5 h-5 text-blue-600" />,
  };

  const bgColors = {
    success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
  };

  const titleColors = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    info: 'text-blue-800 dark:text-blue-200',
  };

  const descColors = {
    success: 'text-green-700 dark:text-green-300',
    error: 'text-red-700 dark:text-red-300',
    info: 'text-blue-700 dark:text-blue-300',
  };

  return (
    <Toast.Root
      className={`${bgColors[message.type]} border rounded-lg shadow-lg p-4 flex items-start gap-3 w-full max-w-md`}
      duration={5000}
      onOpenChange={(open) => {
        if (!open) onClose(message.id);
      }}
    >
      <div className="flex-shrink-0">{icons[message.type]}</div>
      <div className="flex-1">
        <Toast.Title className={`font-semibold ${titleColors[message.type]}`}>
          {message.title}
        </Toast.Title>
        {message.description && (
          <Toast.Description className={`text-sm mt-1 ${descColors[message.type]}`}>
            {message.description}
          </Toast.Description>
        )}
      </div>
      <Toast.Close className="flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
        <X className="w-4 h-4" />
      </Toast.Close>
    </Toast.Root>
  );
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  return (
    <Toast.Provider swipeDirection="right">
      {children}
      <Toast.Viewport className="fixed bottom-0 right-0 flex flex-col gap-2 p-6 w-full max-w-md z-50" />
    </Toast.Provider>
  );
}
