/** Utilità per date/ore nel fuso Europe/Rome (il server può girare in UTC). */
const TZ = "Europe/Rome";

function offsetMs(istante: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(istante)
      .map((x) => [x.type, x.value]),
  );
  const comeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return comeUtc - Math.floor(istante.getTime() / 1000) * 1000;
}

/** "2026-11-23" + "09:30" (ora italiana) → ISO UTC */
export function romaToISO(data: string, ora: string) {
  const ipotesi = new Date(`${data}T${ora.length === 5 ? ora + ":00" : ora}Z`);
  let t = ipotesi.getTime() - offsetMs(ipotesi);
  t = ipotesi.getTime() - offsetMs(new Date(t)); // corregge a cavallo del cambio ora legale
  return new Date(t).toISOString();
}

/** ISO → { data: "YYYY-MM-DD", ora: "HH:MM", minuti: minuti dalla mezzanotte } in ora italiana */
export function partiRoma(iso: string) {
  const d = new Date(iso);
  const data = d.toLocaleDateString("sv-SE", { timeZone: TZ });
  const ora = d.toLocaleTimeString("it-IT", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const [h, m] = ora.split(":").map(Number);
  return { data, ora, minuti: h * 60 + m };
}

export function aggiungiGiorni(data: string, n: number) {
  const d = new Date(data + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lunedì della settimana che contiene la data */
export function lunediDi(data: string) {
  const d = new Date(data + "T12:00:00Z");
  const g = (d.getUTCDay() + 6) % 7; // 0 = lunedì
  return aggiungiGiorni(data, -g);
}

export function etichettaGiorno(data: string) {
  return new Date(data + "T12:00:00Z").toLocaleDateString("it-IT", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

export function oggiRoma() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}
