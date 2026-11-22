"use client";

import { useState } from "react";
import { CalendarPlus, MapPin } from "lucide-react";
import { FormAppuntamento, STATI_APPUNTAMENTO, type Appuntamento } from "./form-appuntamento";
import type { ApptVista } from "./settimana";
import { dataLunga } from "@/lib/format";

export function AppuntamentiCliente({
  cliente,
  appuntamenti,
  operatori,
  oggi,
}: {
  cliente: { id: string; nome: string; cognome: string };
  appuntamenti: ApptVista[];
  operatori: { id: string; nome: string }[];
  oggi: string;
}) {
  const [modifica, setModifica] = useState<Partial<Appuntamento> | null>(null);
  const futuri = appuntamenti.filter((a) => a.data >= oggi);
  const passati = appuntamenti.filter((a) => a.data < oggi).reverse();
  const Riga = ({ a }: { a: ApptVista }) => (
    <button onClick={() => setModifica(a)} className="flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-50">
      <span className="w-56 font-medium capitalize">
        {dataLunga(a.data)} · {a.ora}
      </span>
      <span className="flex-1">{a.titolo}</span>
      {a.luogo !== "In sede" && (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <MapPin size={12} /> {a.luogo}
        </span>
      )}
      {a.nomeOperatore && <span className="text-xs text-slate-500">{a.nomeOperatore}</span>}
      <span className="badge bg-slate-100 text-slate-600">{STATI_APPUNTAMENTO[a.stato]}</span>
    </button>
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Appuntamenti</h2>
        <button className="btn-primary" onClick={() => setModifica({ data: oggi, ora: "09:00", durata: 30, cliente })}>
          <CalendarPlus size={16} /> Nuovo appuntamento
        </button>
      </div>
      <div className="card divide-y divide-slate-100">
        {futuri.length === 0 && <p className="px-4 py-4 text-sm text-slate-500">Nessun appuntamento in programma.</p>}
        {futuri.map((a) => (
          <Riga key={a.id} a={a} />
        ))}
      </div>
      {passati.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer px-4 py-2.5 text-sm text-slate-500">Appuntamenti passati ({passati.length})</summary>
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {passati.map((a) => (
              <Riga key={a.id} a={a} />
            ))}
          </div>
        </details>
      )}
      {modifica && <FormAppuntamento key={modifica.id ?? "nuovo"} iniziale={modifica} operatori={operatori} onChiudi={() => setModifica(null)} />}
    </div>
  );
}
