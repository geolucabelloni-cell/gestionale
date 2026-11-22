"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, MessageCircle, CalendarClock, CalendarDays, Upload, Settings, Network, LogOut, Menu, X } from "lucide-react";

type Props = {
  nomeStudio: string;
  utente: string;
  ruolo: string;
  sede: string;
  ruoloCodice: "admin_rete" | "titolare" | "operatore";
  whatsappDaGestire: number;
  attivitaScadute: number;
};

export function Sidebar(p: Props) {
  const path = usePathname();
  const [aperto, setAperto] = useState(false);
  const voci = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agenda", label: "Agenda", icon: CalendarDays },
    { href: "/clienti", label: "Clienti", icon: Users },
    { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, badge: p.whatsappDaGestire },
    { href: "/scadenze", label: "Scadenze e attività", icon: CalendarClock, badge: p.attivitaScadute },
    ...(p.ruoloCodice !== "operatore"
      ? [
          { href: "/importa", label: "Importa da TeamSystem", icon: Upload },
          { href: "/impostazioni", label: "Impostazioni sede", icon: Settings },
        ]
      : []),
    ...(p.ruoloCodice === "admin_rete" ? [{ href: "/rete", label: "Rete franchising", icon: Network }] : []),
  ];
  const attiva = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <span className="flex items-center gap-2 font-bold text-brand-600">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-iostraniero.png" alt="" className="h-8 w-8 rounded" />
          {p.nomeStudio}
        </span>
        <button className="btn-ghost" onClick={() => setAperto(!aperto)} aria-label="Menu">
          {aperto ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      <aside
        className={`${aperto ? "block" : "hidden"} border-r border-slate-200 bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col`}
      >
        <div className="hidden items-center gap-3 px-5 py-5 lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-iostraniero.png" alt="" className="h-11 w-11 rounded-md" />
          <div>
            <div className="text-lg font-bold tracking-wide text-brand-600">{p.nomeStudio}</div>
            <div className="text-xs text-slate-500">{p.sede}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {voci.map((v) => (
            <Link
              key={v.href}
              href={v.href}
              onClick={() => setAperto(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                attiva(v.href) ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <v.icon size={18} />
              <span className="flex-1">{v.label}</span>
              {!!v.badge && <span className="badge bg-red-500 text-white">{v.badge}</span>}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="truncate text-sm font-medium">{p.utente}</div>
          <div className="mb-3 text-xs text-slate-500">{p.ruolo}</div>
          <form action="/auth/esci" method="post">
            <button className="btn-ghost w-full justify-start px-0 text-slate-500">
              <LogOut size={16} /> Esci
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
