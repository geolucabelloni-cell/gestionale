"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";
import { cercaClienti } from "@/app/(app)/whatsapp/actions";

export type ClienteScelto = { id: string; nome: string; cognome: string } | null;

/** Campo di ricerca cliente: scrive l'id in un input nascosto `name`. */
export function ClientePicker({ name, iniziale, onChange }: { name: string; iniziale?: ClienteScelto; onChange?: (c: ClienteScelto) => void }) {
  const [scelto, setScelto] = useState<ClienteScelto>(iniziale ?? null);
  const [q, setQ] = useState("");
  const [risultati, setRisultati] = useState<{ id: string; nome: string; cognome: string; telefono: string | null }[]>([]);
  const [, avvia] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const h = setTimeout(() => avvia(async () => setRisultati(await cercaClienti(q))), 250);
    return () => clearTimeout(h);
  }, [q]);

  const scegli = (c: ClienteScelto) => {
    setScelto(c);
    setQ("");
    setRisultati([]);
    onChange?.(c);
  };

  if (scelto)
    return (
      <div className="input flex items-center justify-between">
        <input type="hidden" name={name} value={scelto.id} />
        <span>
          {scelto.cognome} {scelto.nome}
        </span>
        <button type="button" onClick={() => scegli(null)} className="text-slate-400 hover:text-slate-600" aria-label="Rimuovi cliente">
          <X size={16} />
        </button>
      </div>
    );

  return (
    <div className="relative">
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca cliente (nome, cognome, telefono…)" />
      {q.trim().length >= 2 && risultati.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {risultati.map((c) => (
            <button key={c.id} type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => scegli(c)}>
              <span>
                {c.cognome} {c.nome}
              </span>
              <span className="text-xs text-slate-400">{c.telefono ? "+" + c.telefono : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
