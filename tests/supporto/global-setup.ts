import { preparaDatabase } from "./prepara-db.mjs";

/** Prima di tutte le prove nel browser: database locale pulito con l'amministratore di prova. */
export default async function globalSetup() {
  await preparaDatabase();
}
