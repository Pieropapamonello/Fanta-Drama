import { useState } from 'react';

interface AuthFormProps {
  title: string;
  description: string;
  submitLabel: string;
  onSubmit: (email: string, password: string) => void;
}

export function AuthForm({ title, description, submitLabel, onSubmit }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-[0_25px_100px_rgba(15,23,42,0.35)]">
      <h2 className="text-3xl font-semibold text-white">{title}</h2>
      <p className="mt-3 text-slate-400">{description}</p>

      <form
        className="mt-8 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(email, password);
        }}
      >
        <label className="block text-sm text-slate-300">
          Email
          <input
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-ember"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm text-slate-300">
          Password
          <input
            className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-ember"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="mt-4 w-full rounded-2xl bg-ember px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          {submitLabel}
        </button>
      </form>
    </div>
  );
}
