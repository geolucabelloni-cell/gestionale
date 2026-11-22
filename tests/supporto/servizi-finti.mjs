/**
 * Servizi esterni FINTI per i test (porta 4010): Claude (Anthropic), WhatsApp Cloud API (Meta) e Callbell.
 * Le risposte sono fisse e prevedibili; nessuna chiamata esce verso internet.
 * GET /__registro restituisce tutte le richieste ricevute, POST /__azzera lo svuota.
 */
import http from "node:http";

const PORTA = Number(process.env.PORTA_SERVIZI_FINTI ?? 4010);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
let registro = [];

const messaggio = (testo) => ({
  id: "msg_finto",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [{ type: "text", text: testo }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

function rispostaAi(corpo) {
  const sys = typeof corpo.system === "string" ? corpo.system : "";
  const utente = JSON.stringify(corpo.messages ?? []);
  if (sys.includes("assistente WhatsApp")) {
    const ultimo = utente.split("CLIENTE:").pop();
    const semplice = /orari|orario/i.test(ultimo);
    return JSON.stringify(
      semplice
        ? { categoria: "informazioni_studio", rispondi_automaticamente: true, risposta: "Siamo aperti dal lunedì al venerdì 9-13 e 15-19.", messaggio_attesa: "", motivo: "Domanda sugli orari", lingua: "it" }
        : {
            categoria: "consulenza_legale",
            rispondi_automaticamente: false,
            risposta: "Buongiorno, per valutare il caso serve un appuntamento.",
            messaggio_attesa: "Abbiamo ricevuto il messaggio, un operatore ti risponderà a breve.",
            motivo: "Richiesta di valutazione legale",
            lingua: "it",
          },
    );
  }
  if (sys.includes("assistente organizzativo"))
    return JSON.stringify({
      attivita: [{ titolo: "Richiedere il CUD al cliente", descrizione: "Manca per il rinnovo", scadenza: null, priorita: "alta" }],
      appuntamenti: [{ titolo: "Impronte in Questura", tipo: "Questura – impronte", data: "2030-12-03", ora: "10:30", luogo: "Questura" }],
    });
  if (sys.includes("briefing mattutino")) return "PRIORITÀ DI OGGI:\n- Briefing di prova.";
  if (sys.includes("Abbini le colonne"))
    return JSON.stringify({
      abbinamenti: [
        { campo: "cognome", colonna: "COGNOME" },
        { campo: "nome", colonna: "NOME" },
        { campo: "codice_esterno", colonna: "CODCLI" },
        { campo: "telefono", colonna: "CELL" },
        { campo: "permesso_scadenza", colonna: "SCAD_PDS" },
        { campo: "codice_fiscale", colonna: "CF" },
      ],
    });
  if (sys.includes("archivista"))
    return JSON.stringify({ tipo_documento: "Passaporto", riepilogo: "Passaporto intestato al cliente, scade nel 2030.", cartella_suggerita: "Documenti di identità", scadenza: "2030-05-01", nome_file_suggerito: "Passaporto cliente" });
  if (sys.includes("Estrai i dati"))
    return JSON.stringify({
      tipo_documento: "Passaporto",
      nome: "Amina",
      cognome: "Benali",
      sesso: "F",
      data_nascita: "1990-03-12",
      luogo_nascita: "Casablanca",
      cittadinanza: "Marocco",
      codice_fiscale: null,
      passaporto_numero: "AB1234567",
      passaporto_scadenza: "2030-05-01",
      permesso_tipo: null,
      permesso_numero: null,
      permesso_scadenza: null,
      indirizzo: null,
    });
  return "SITUAZIONE:\n- Riepilogo di prova.";
}

const json = (res, dati, stato = 200) => {
  res.writeHead(stato, { "content-type": "application/json" });
  res.end(JSON.stringify(dati));
};

http
  .createServer(async (req, res) => {
    let testo = "";
    for await (const c of req) testo += c;
    let corpo = {};
    try {
      corpo = testo ? JSON.parse(testo) : {};
    } catch {
      /* non JSON */
    }
    if (req.url === "/__registro") return json(res, registro);
    if (req.url === "/__azzera") return ((registro = []), json(res, { ok: true }));
    registro.push({ url: req.url, metodo: req.method, corpo });

    if (req.url.startsWith("/v1/messages")) return json(res, messaggio(rispostaAi(corpo)));
    if (req.url === "/cb/v1/messages/send") return json(res, { message: { uuid: "cb-out-" + Date.now() + Math.random(), status: "enqueued" } });
    if (req.url === "/cb/file.png" || req.url === "/file-media") {
      res.writeHead(200, { "content-type": "image/png" });
      return res.end(PNG);
    }
    if (req.method === "POST" && /\/messages$/.test(req.url)) return json(res, { messages: [{ id: "wamid.OUT" + Date.now() + Math.random() }] });
    if (req.method === "GET" && /^\/v\d+\.\d+\/[\w.-]+$/.test(req.url)) return json(res, { url: `http://127.0.0.1:${PORTA}/file-media`, mime_type: "image/png", file_size: PNG.length });
    res.writeHead(404);
    res.end();
  })
  .listen(PORTA, "127.0.0.1", () => console.log(`Servizi finti in ascolto su ${PORTA}`));
