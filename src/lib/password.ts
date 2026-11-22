/** Regole minime per le password (stesse in tutto il gestionale). */
export const PASSWORD_MIN = 10;

export function controllaPassword(pw: string, conferma?: string): string | null {
  if (pw.length < PASSWORD_MIN) return `La password deve avere almeno ${PASSWORD_MIN} caratteri`;
  if (!/[A-Za-zÀ-ÿ]/.test(pw) || !/\d/.test(pw)) return "La password deve contenere sia lettere sia numeri";
  if (conferma !== undefined && pw !== conferma) return "Le due password non coincidono";
  return null;
}
