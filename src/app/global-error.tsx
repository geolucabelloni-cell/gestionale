"use client";

import "./globals.css";

/** Errore grave che impedisce di caricare anche il menu: pagina minima ma in italiano. */
export default function ErroreGlobale({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="it">
      <body>
        <title>Errore – IOSTRANIERO</title>
        <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
          <h1 className="mb-2 text-2xl font-semibold">Il gestionale non risponde</h1>
          <p className="mb-6 text-slate-600">
            Si è verificato un errore imprevisto. I dati salvati non sono stati persi. Riprova tra qualche istante; se il problema continua, contatta la sede centrale.
          </p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => retry()}>
              Riprova
            </button>
            {/* ricaricamento completo voluto: l'app è in errore */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" className="btn-secondary">
              Pagina iniziale
            </a>
          </div>
          {error.digest && <p className="mt-6 text-xs text-slate-400">Codice per l&apos;assistenza: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
