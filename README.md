# IOSTRANIERO – Gestionale

Gestionale web per studi di diritto dell'immigrazione organizzati in rete di franchising.
Sostituisce le funzioni usate del gestionale TeamSystem e aggiunge l'integrazione con
WhatsApp e con l'intelligenza artificiale (Claude di Anthropic).

## Cosa fa

| Area | Funzioni |
|---|---|
| **Anagrafiche** | Dati personali, contatti, lingua preferita, passaporto e permesso di soggiorno con scadenze, consenso privacy, etichette, ricerca veloce. **Compila da documento**: carichi la foto del passaporto/permesso e l'AI riempie i campi. |
| **Diario del cliente** | Una nota per ogni visita, numerata in ordine progressivo (n. 1, 2, 3…), raggruppata per giorno, con autore e ora. Le note non si modificano: si aggiunge una *rettifica* (storico affidabile). |
| **Archivio documenti** | Cartelle e sottocartelle illimitate per cliente (7 cartelle predefinite alla creazione). Caricamento multiplo, anteprima, download, sposta, rinomina. L'AI riconosce il documento, scrive un riepilogo (con eventuale scadenza) e lo archivia nella cartella giusta. |
| **Pratiche** | Rinnovi, ricongiungimenti, cittadinanza, flussi, ricorsi… con stato, riferimento Questura/Prefettura e prossima scadenza. |
| **WhatsApp + AI** | I messaggi arrivano nel gestionale e si collegano al cliente dal numero. L'AI legge anagrafica, diario e pratiche e **risponde da sola alle domande semplici** (orari, documenti da portare, stato pratica, conferme), nella lingua del cliente. Consulenze legali, urgenze (espulsioni, scadenze) e casi dubbi vanno a un operatore con **bozza di risposta già pronta** e un messaggio di cortesia al cliente. Foto e documenti inviati su WhatsApp vengono archiviati e classificati in automatico. Più messaggi di fila ricevono una sola risposta. |
| **Assistente AI sul cliente** | "Riepiloga la storia del cliente" prima dell'appuntamento e domande libere ("quali documenti mancano?"). |
| **Agenda appuntamenti** | Vista settimanale per operatore (colori), appuntamenti in sede o in Questura/Prefettura, avviso sovrapposizioni, stati (confermato, completato, non presentato), appuntamenti nella scheda cliente e "Appuntamenti di oggi" in dashboard. |
| **Scadenze e attività** | Sostituisce i fogli Excel: attività con scadenza, priorità e assegnatario, raggruppate in Scadute / Oggi / 7 giorni / Più avanti, spunta di completamento. In più le scadenze automatiche di permessi, passaporti e pratiche a 30/60/90/180 giorni. |
| **Agente AI** | Dopo ogni nota del diario l'AI propone le attività e gli appuntamenti che contiene ("manca il CUD", "impronte in Questura il 3/12 alle 10:30") da aggiungere con un clic. Lo stesso dalle conversazioni WhatsApp. **Briefing del giorno**: priorità, appuntamenti da preparare, attività e WhatsApp in attesa. |
| **Importazione da TeamSystem** | CSV di anagrafiche e note: abbinamento automatico delle colonne (anche con l'AI), anteprima, nessun duplicato se si reimporta, note numerate in ordine cronologico. |
| **Franchising** | Ogni sede vede solo i propri dati (isolamento nel database). La sede centrale vede tutto, apre nuove sedi con il titolare in un minuto e ha la dashboard della rete. Ruoli: *Sede centrale*, *Titolare sede*, *Operatore*. Registro attività per GDPR. |

## Architettura

- **Next.js 16** (interfaccia web e API), utilizzabile da PC, tablet e telefono.
- **Supabase**: database PostgreSQL, login utenti, archivio file. Regione UE (Francoforte) per il GDPR.
  La separazione tra sedi è garantita dal database (Row Level Security), non solo dall'interfaccia.
- **Claude (Anthropic)** per l'AI — modello configurabile con `AI_MODEL`.
- **WhatsApp**: tramite **Callbell** (il fornitore attuale) oppure direttamente con la **WhatsApp Business Cloud API** di Meta. Si sceglie per ogni sede.

```
src/
  app/(app)/          pagine del gestionale (dashboard, clienti, whatsapp, scadenze, impostazioni, rete)
  app/api/whatsapp/   webhook che riceve i messaggi da Meta
  lib/ai/claude.ts    tutte le funzioni AI (risposte WhatsApp, riepiloghi, lettura documenti)
  lib/whatsapp*.ts    invio/ricezione WhatsApp e logica di risposta automatica
supabase/migrations/  schema del database, sicurezza e archivio file
scripts/crea-admin.mjs  crea il primo utente della sede centrale
```

## Messa online (circa 1 ora)

### 1. Supabase
1. Crea un progetto su [supabase.com](https://supabase.com) scegliendo la regione **Central EU (Frankfurt)**.
2. Installa le dipendenze e collega il progetto:
   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref <ID-progetto>
   npx supabase db push
   ```
3. In *Authentication → Providers → Email* disattiva "Allow new users to sign up" (gli utenti li crea la sede centrale).

### 2. Hosting (Vercel)
1. Importa il repository su [vercel.com](https://vercel.com), regione funzioni **Frankfurt (fra1)**.
2. Inserisci le variabili d'ambiente elencate in `.env.example`.
3. Crea il primo amministratore (dal tuo PC, con un file `.env.local` che contiene URL e service role key):
   ```bash
   node --env-file=.env.local scripts/crea-admin.mjs tua@email.it "PasswordSicura!" "Nome Cognome" "Sede centrale"
   ```

### 3. AI
Crea una chiave su [console.anthropic.com](https://console.anthropic.com) e impostala in `ANTHROPIC_API_KEY`.
Senza chiave il gestionale funziona lo stesso: le funzioni AI vengono nascoste e i messaggi WhatsApp vanno tutti agli operatori.

### 4a. WhatsApp con Callbell (consigliato per partire: nessun cambio di numero)
1. In Callbell: *Impostazioni → API* → crea una chiave API.
2. Nel gestionale, *Impostazioni sede*: scegli **Callbell**, incolla la chiave e salva. Compare l'**URL del webhook** della sede (contiene un codice segreto).
3. In Callbell: *Impostazioni → Integrazioni → Webhook* → incolla l'URL e attiva gli eventi `message_created` e `message_status_updated`.
4. Compila le **Informazioni per l'AI** della sede.

Gli operatori possono continuare a rispondere anche dall'app Callbell: quei messaggi vengono registrati nel gestionale e chiudono la conversazione "da gestire".

> L'integrazione Callbell è scritta sul formato documentato della loro API ma va **verificata con il vostro account** (primo messaggio di prova) prima di attivare le risposte automatiche.

### 4b. In alternativa: WhatsApp Cloud API diretta di Meta
1. Su [developers.facebook.com](https://developers.facebook.com) crea un'app di tipo *Business* e aggiungi il prodotto **WhatsApp**.
2. Registra il numero della sede (il numero non deve essere in uso sull'app WhatsApp normale).
3. Crea un *System User* nel Business Manager con un token permanente (permessi `whatsapp_business_messaging`, `whatsapp_business_management`) → `WHATSAPP_ACCESS_TOKEN`.
4. *WhatsApp → Configuration → Webhook*: URL `https://<dominio>/api/whatsapp/webhook`, token di verifica = `WHATSAPP_VERIFY_TOKEN`, sottoscrivi il campo **messages**.
5. Copia l'*App Secret* (Impostazioni app → Di base) in `WHATSAPP_APP_SECRET`.
6. Nel gestionale, *Impostazioni sede*: inserisci il **Phone Number ID** e compila le **Informazioni per l'AI** (orari, indirizzo, documenti richiesti…). L'AI risponde solo con quello che è scritto lì.

Ogni sede in franchising può avere il proprio numero WhatsApp: basta inserire il suo Phone Number ID (e, se è su un altro Business Manager, il suo token) nelle impostazioni della sede.

> Regola di Meta: si può scrivere liberamente al cliente solo entro 24 ore dal suo ultimo messaggio. Oltre servono messaggi *modello* approvati (vedi Sviluppi futuri).

## Sviluppo in locale

```bash
npm install
npx supabase start          # richiede Docker
cp .env.example .env.local  # inserisci URL e chiavi stampate da "supabase start"
node --env-file=.env.local scripts/crea-admin.mjs admin@test.it "Password123!" "Admin" "Sede centrale"
npm run dev
```

## Costi indicativi

| Voce | Costo |
|---|---|
| Supabase Pro (database, file, login) | ~25 $/mese per tutta la rete |
| Vercel Pro | ~20 $/mese |
| AI (Claude) | a consumo: pochi centesimi per messaggio/documento analizzato |
| WhatsApp | le risposte entro 24 h al messaggio del cliente sono gratuite; i messaggi modello si pagano a conversazione |

## Sviluppi futuri consigliati
- **Promemoria automatici** WhatsApp il giorno prima dell'appuntamento e per i permessi in scadenza (richiedono messaggi modello approvati, gestibili da Callbell).
- **Prenotazione appuntamenti via WhatsApp** da parte dell'AI.
- **Collegamento ad agenti esterni** (es. Claude Desktop/Cowork) tramite un connettore MCP del gestionale.
- **Trascrizione dei messaggi vocali** WhatsApp.
- Fatturazione/incassi e firma elettronica dei mandati.
