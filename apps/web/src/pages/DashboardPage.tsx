export function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-8 shadow-[0_25px_100px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-gold/80">Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">La tua squadra</h2>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
            Ultimo aggiornamento: -
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
          <p className="text-sm uppercase tracking-[0.35em] text-gold/80">Team</p>
          <div className="mt-4 text-2xl font-semibold text-white">SQUADRA DRAMA</div>
          <p className="mt-2 text-slate-400">Capitano: TBD</p>
          <p className="mt-2 text-slate-400">Budget residuo: 32</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
          <p className="text-sm uppercase tracking-[0.35em] text-gold/80">Punteggio</p>
          <div className="mt-4 text-4xl font-semibold text-white">1.240</div>
          <p className="mt-2 text-slate-400">Ultimo evento: +25</p>
        </div>
      </section>
    </div>
  );
}
