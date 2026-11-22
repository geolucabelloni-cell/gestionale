/** Uso: node tests/supporto/prepara-db-cli.mjs – azzera il database LOCALE e crea l'amministratore di prova. */
import { preparaDatabase } from "./prepara-db.mjs";

await preparaDatabase();
console.log("Database di test pronto");
