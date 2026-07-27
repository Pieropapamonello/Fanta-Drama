export function HomePage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-[0_25px_100px_rgba(15,23,42,0.35)]">
        <p className="text-sm uppercase tracking-[0.35em] text-gold/80">Welcome to FantaDrama</p>
        <h2 className="mt-4 text-4xl font-semibold text-white">Il fantasy game del drama narrativo</h2>
        <p className="mt-4 max-w-2xl text-slate-300">
          Crea la tua squadra, scegli un capitano, colleziona punti evento e ricevi aggiornamenti live direttamente sul tuo bot Telegram.
        </p>
      </section>
    </div>
  );
}
