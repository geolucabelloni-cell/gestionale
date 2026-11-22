export default function Caricamento() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-4" aria-busy="true" aria-label="Caricamento">
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="h-4 w-96 max-w-full rounded bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-slate-100" />
    </div>
  );
}
