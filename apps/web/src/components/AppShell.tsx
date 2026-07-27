import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-night text-slate-100">
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-gold/75">FantaDrama</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Drama league, live in play</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <Link to="/">Home</Link>
            <Link to="/auth/login">Accedi</Link>
            <Link to="/auth/register">Registrati</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-6">{children}</main>
    </div>
  );
}
