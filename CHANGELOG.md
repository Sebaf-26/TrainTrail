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

### Modificato

- Il progetto è stato rinominato TrainTrail e il modello dati passa da voli, aeroporti, compagnie e aerei a viaggi, stazioni, operatori e treni.
- Statistiche, mappa, import ed export usano il nuovo modello; le distanze si mostrano in km o miglia.
- Il database riparte da una sola migrazione iniziale e la versione riparte da 0.1.0.

### Rimosso

- Codici IATA, dati di aeroporti e compagnie aeree e le funzioni specifiche del volo.
