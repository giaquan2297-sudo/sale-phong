import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/Toast';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import InventoryPage from './pages/InventoryPage';

const LandlordsPage = lazy(() => import('./pages/LandlordsPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const CommissionsPage = lazy(() => import('./pages/CommissionsPage'));
const SheetsPage = lazy(() => import('./pages/SheetsPage'));
const StoragePage = lazy(() => import('./pages/StoragePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PublicCartPage = lazy(() => import('./pages/PublicCartPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="p-8 text-center text-sm text-slate-500">Đang tải trang...</div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/share/:slug" element={<PublicCartPage />} />
                <Route element={<Layout />}>
                  <Route path="/" element={<InventoryPage />} />
                  <Route path="/landlords" element={<LandlordsPage />} />
                  <Route path="/customers" element={<CustomersPage />} />
                  <Route path="/commissions" element={<CommissionsPage />} />
                  <Route path="/sheets" element={<SheetsPage />} />
                  <Route path="/storage" element={<StoragePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
