import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TelegramCallbackPage } from './pages/TelegramCallbackPage';

function NotFoundPage() {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 text-center text-slate-200 shadow-[0_25px_100px_rgba(15,23,42,0.35)]">
      <h2 className="text-4xl font-semibold">404</h2>
      <p className="mt-3 text-slate-400">Pagina non trovata.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/telegram-callback" element={<TelegramCallbackPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
