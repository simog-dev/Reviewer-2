# Feature Roadmap

## Major Features

### 1 [COMPLETA]. Personalizzazione categorie di Highlight
- Creazione di una nuova sezione **Settings > Highlight Categories**
- Categorie di default predefinite, attivabili/disattivabili singolarmente
- Per ogni categoria:
  - Modifica del nome
  - Modifica del colore
- Creazione di nuove categorie:
  - Massimo **5 categorie attive** contemporaneamente
  - Massimo **10 categorie totali** (attive + non attive, sia custom che default)
- Riordinamento delle categorie tramite **drag & drop**
- Le modifiche devono riflettersi coerentemente su:
  - Bottoni del pop-up di Highlight
  - Filtri del pannello annotazioni
  - Card delle annotazioni

### 2. [COMPLETA] Stato di completamento del PDF
- Possibilità di segnare un PDF come **"Completato"**
- Alla marcatura come completato:
  - Opzione per aggiungere un **commento generico** (opzionale)
- Introduzione di un **filtro nella Home**:
  - Pulsanti per visualizzare: Tutti / PDF completati / PDF non completati
- Badge visivo sulle card dei PDF completati
- Bottone "Mark as Completed" nella review page che diventa "Mark as Incomplete" quando il PDF è completato
- Salvataggio automatico di: stato di completamento, commento, e timestamp

### 3. Evidenziazione senza annotazione
- Possibilità di evidenziare testo **senza creare un’annotazione**
- Da valutare:
  - Due bottoni separati nel pop-up: **Annotate** e **Highlight**
  - No bottoni, alla selezione del testo appare un pop-up con due icone (Una per annotate e una per highlight), se si clicca su highlight viene semplicemente evidenziato il testo (nessuna annotazione), se viene cliccato il tasto Annotate, appare il pop-up di scelta della categoria e poi si apre il modal per inserire il commento (come funziona adesso)

### 4. Importare delle annotazioni (per il futuro)
- Dopo aver caricato un PDF dev'essere possibile caricare delle annotazioni esportate in precedenza o da un altro utente
- Dobbiamo trovare un modo per verificare se quelle annotazioni appartengono a quel file. Non penso esista un modo sicuro al 100%:
  - possiamo controllare il nome, ma il nome può cambiare
  - qualche checksum forse può funzionare?
- Se non riusciamo a verificare se il PDF è lo stesso dovremmo fare apparire una modal chiedendo all'utente se vuole comunque proseguire e provare a caricare le annotazioni oppure no. Se si, deve apparire un toast actionable che chiede se confermare o annulare l'import. Nel caso di annullare vengono rimosse tutte le annotazioni create durante l'import.

---

## Minor Features

### 1. [COMPLETA] Note libere
- Possibilità di aggiungere una **Nota** non legata a un’evidenziazione
  - Bottone sotto i filtri nella tab Annotations "+ Note" (o simile). Al click si apre la finestra solita per aggiungere un'annotazione ma senza nessun testo di riferimento.

### 2. [COMPLETA] Miglioramento card annotazioni
- Nella card dell’annotazione mostrare:
  - Inizio e fine del testo evidenziato  
  - Esempio:  
    `(Questo è l'inizio...questa è la fine.)`

### 3. [COMPLETA] Feedback su configurazione LLM
- Hover sul bottone **“Generate review”**
- Se nessun LLM è configurato:
  - Mostrare un **pop-up informativo** (già presente)
  - Call to action per configurarlo nelle **Settings**
- Miglioramenti UI del pop-up:
  - Colori più visibili e accesi
  - La parola **“settings”** deve essere un link diretto alla pagina di configurazione LLM

### 4. Cancella i file durante Uninstall
- Dare all'utente la possibilità di scegliere se mantenere o cancellare i dati dell'app quando si disinstalla.
