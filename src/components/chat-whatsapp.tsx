import { Bot, Check, CheckCheck, FileText, AlertCircle } from "lucide-react";
import { dataOra } from "@/lib/format";

type Msg = {
  id: string;
  direzione: "in" | "out";
  testo: string | null;
  tipo: string;
  created_at: string;
  ai_gestito: boolean;
  ai_categoria: string | null;
  da_gestire: boolean;
  document_id: string | null;
  stato_invio: string | null;
};

export function ChatWhatsapp({ messaggi }: { messaggi: Msg[] }) {
  if (!messaggi.length) return <p className="py-8 text-center text-sm text-slate-500">Nessun messaggio WhatsApp.</p>;
  return (
    <div className="space-y-2 rounded-lg bg-[#efeae2] p-4">
      {messaggi.map((m) => (
        <div key={m.id} className={`flex ${m.direzione === "out" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
              m.direzione === "out" ? "bg-[#d9fdd3]" : "bg-white"
            } ${m.da_gestire ? "ring-2 ring-red-300" : ""}`}
          >
            {m.tipo !== "text" && (
              <div className="mb-1 flex items-center gap-1 text-xs text-slate-500">
                <FileText size={12} />
                {m.document_id ? (
                  <a href={`/api/documenti/${m.document_id}`} target="_blank" className="underline">
                    allegato ({m.tipo})
                  </a>
                ) : (
                  <span>allegato ({m.tipo})</span>
                )}
              </div>
            )}
            {m.testo && <div className="whitespace-pre-wrap">{m.testo}</div>}
            <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-slate-500">
              {m.ai_gestito && m.direzione === "out" && (
                <span className="inline-flex items-center gap-0.5 text-violet-600">
                  <Bot size={11} /> AI
                </span>
              )}
              {m.da_gestire && (
                <span className="inline-flex items-center gap-0.5 text-red-600">
                  <AlertCircle size={11} /> da gestire
                </span>
              )}
              {dataOra(m.created_at)}
              {m.direzione === "out" &&
                (m.stato_invio === "read" ? (
                  <CheckCheck size={12} className="text-sky-500" />
                ) : m.stato_invio === "delivered" ? (
                  <CheckCheck size={12} />
                ) : m.stato_invio === "failed" ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : (
                  <Check size={12} />
                ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
