import { MainLayout } from './components/Layout/MainLayout';
import { ToastProvider } from './components/UI/Toast';
import { ToastContextProvider } from './hooks/useToast';

export default function App() {
  return (
    <ToastProvider>
      <ToastContextProvider>
        <MainLayout />
      </ToastContextProvider>
    </ToastProvider>
  );
}
