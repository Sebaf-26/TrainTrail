# Changelog

Tutte le modifiche rilevanti di TrainTrail. Le versioni più recenti sono in alto.
L'origine del progetto e le condizioni della licenza sono in [NOTICE](NOTICE).

## [0.1.0] - 2026-10-29

### Aggiunto

- Tracciamento dei viaggi in treno: ogni viaggio ha stazione di partenza e di arrivo, operatore, tipo di treno, numero del treno, binario di partenza e di arrivo, carrozza, posto, classe (1ª, 2ª) e motivo del viaggio.
- Elenco di oltre 23.000 stazioni europee, caricato al primo avvio dal dataset Trainline (licenza ODbL), con codice UIC e, per le stazioni italiane, l'id ViaggiaTreno. La ricerca funziona per nome, codice, UIC e id ViaggiaTreno.
- 88 operatori e 69 tipi di treno inclusi nell'app.
- Importazione dei biglietti da Impostazioni → Import → Ticket: si incolla il messaggio o la mail ricevuta, oppure si carica un file `.eml`, `.pkpass` (Apple Wallet) o `.txt`. Funziona anche con il link "Aggiungi a Google Wallet" quando contiene tutti i dati del biglietto.
- Dal biglietto si ricavano stazioni, orari (convertiti in UTC con il fuso della stazione), numero del treno, operatore, carrozza, posto, classe e codice di prenotazione, che finisce nelle note del viaggio. Le stazioni non riconosciute si abbinano a mano nel passaggio di importazione esistente.
- Stazioni personalizzate per i luoghi che non sono nell'elenco.
- Il biglietto importato da un `.pkpass` resta con il viaggio: dal pannello del viaggio sulla mappa si vede come biglietto, con il suo codice a barre, anche a schermo intero. Il codice è disegnato nel formato originale del pass (Aztec, QR, PDF417 o Code 128) e non viene convertito, perché lo scanner del controllore si aspetta quello. Lo vede solo chi l'ha importato: non compare nelle liste, negli export, nelle condivisioni né nelle API.
- Il pulsante "Add journey" della homepage chiede se compilare il viaggio a mano oppure importare un pass o un biglietto; la seconda scelta apre l'importazione già sulla sorgente Ticket.
- Percorso reale sui binari, opzionale e sperimentale: un servizio a parte (OpenRailRouting sui dati OpenStreetMap) calcola il tragitto tra le stazioni e la mappa lo disegna al posto della linea dritta. Si attiva con `COMPOSE_PROFILES=routing` e non parte da solo. I viaggi nuovi e importati vengono disegnati in automatico; per quelli già presenti c'è il pulsante "Draw along the rails" nel pannello del viaggio. Se il servizio non c'è o non trova un percorso resta la linea dritta. Tutto è scritto nei log con il prefisso `[rail-routing]`.
- Nota per chi aggiorna: c'è una nuova migrazione del database (tabella dei biglietti), che si applica da sola all'avvio.
- `docker-compose.yml` nella radice: costruisce l'app dal repository e la avvia con PostgreSQL, quindi funziona come stack Git in Portainer. Richiede solo `ORIGIN` e `DB_PASSWORD`; la porta predefinita è 8096 e si cambia con la variabile `PORT`.

### Modificato

- Il progetto è stato rinominato TrainTrail e il modello dati passa da voli, aeroporti, compagnie e aerei a viaggi, stazioni, operatori e treni.
- Statistiche, mappa, import ed export usano il nuovo modello; le distanze si mostrano in km o miglia.
- Il database riparte da una sola migrazione iniziale e la versione riparte da 0.1.0.

### Corretto

- La build Docker falliva perché `.dockerignore` escludeva la cartella `data/` con operatori e treni.
- Importazione di un biglietto `.pkpass` di Trenitalia: gli orari di partenza e arrivo erano sbagliati (si leggeva la data in UTC dell'intestazione, un'ora prima) e carrozza e posto venivano confusi. Ora si leggono gli orari stampati sul biglietto, le stazioni e il campo "Carr. - Posto".
- Il servizio del percorso reale non partiva: un file della configurazione aveva lo stesso nome di uno già incluso in OpenRailRouting (`preferred_direction.json`) e mancava la chiave `import.osm.ignored_highways`, richiesta dal motore. Ora usa il file incluso e la chiave è presente.
- Il servizio del percorso reale scriveva nei log la barra di avanzamento del download, illeggibile in un container: ora scrive una riga ogni 30 secondi con la dimensione scaricata, e un download interrotto riprende da dove era arrivato.
- Lo stack Git in Portainer non partiva: prima di ogni deploy provava a scaricare da Docker Hub un'immagine `traintrail` che non esiste. Ora il compose costruisce l'immagine e basta.

### Rimosso

- Codici IATA, dati di aeroporti e compagnie aeree e le funzioni specifiche del volo.
