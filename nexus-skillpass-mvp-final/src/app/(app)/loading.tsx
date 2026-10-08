export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Cargando… / Loading…</span>
      <div className="h-8 w-64 rounded-lg bg-ink-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-ink-100" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 rounded-2xl bg-ink-100 lg:col-span-2" />
        <div className="h-72 rounded-2xl bg-ink-100" />
      </div>
    </div>
  );
}
