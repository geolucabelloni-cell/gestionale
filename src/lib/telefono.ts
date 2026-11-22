/** Normalizza un numero di telefono nel formato usato da WhatsApp: solo cifre, con prefisso internazionale. */
export function normalizzaTelefono(input: string | null | undefined, prefissoDefault = "39"): string | null {
  if (!input) return null;
  let s = input.trim().replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  else if (s.length <= 10) s = prefissoDefault + s; // numero nazionale (es. 3331234567)
  return s.replace(/\D/g, "") || null;
}

export function formattaTelefono(n: string | null | undefined) {
  if (!n) return "";
  return "+" + n;
}
