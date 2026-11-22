import Link from "next/link";

/** Riquadro usato dalle pagine di errore e "non trovato". */
export function PaginaErrore({ titolo, testo, codice, children }: { titolo: string; testo: string; codice?: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-iostraniero.png" alt="" className="mb-6 h-16 w-16 rounded-lg" />
      <h1 className="mb-2 text-2xl font-semibold">{titolo}</h1>
      <p className="mb-6 text-slate-600">{testo}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {children}
        <Link href="/" className="btn-secondary">
          Torna alla pagina iniziale
        </Link>
      </div>
      {codice && <p className="mt-6 text-xs text-slate-400">Codice per l&apos;assistenza: {codice}</p>}
    </div>
  );
}
