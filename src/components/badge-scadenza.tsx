export function BadgeScadenza({ giorni }: { giorni: number | null }) {
  if (giorni === null) return null;
  if (giorni < 0) return <span className="badge bg-red-100 text-red-700">scaduto</span>;
  if (giorni <= 30) return <span className="badge bg-red-100 text-red-700">{giorni} gg</span>;
  if (giorni <= 90) return <span className="badge bg-amber-100 text-amber-700">{giorni} gg</span>;
  return null;
}
