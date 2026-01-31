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

---

## Minor Features

### 1. Note libere
- Possibilità di aggiungere una **Nota** non legata a un’evidenziazione
- La nota appare come **comment** nella lista delle annotazioni

### 2. Miglioramento card annotazioni
- Nella card dell’annotazione mostrare:
  - Inizio e fine del testo evidenziato  
  - Esempio:  
    `(Questo è l'inizio...questa è la fine.)`

### 3. Feedback su configurazione LLM
- Hover sul bottone **“Generate review”**
- Se nessun LLM è configurato:
  - Mostrare un **pop-up informativo**
  - Call to action per configurarlo nelle **Settings**
- Miglioramenti UI del pop-up:
  - Colori più visibili e accesi
  - La parola **“settings”** deve essere un link diretto alla pagina di configurazione LLM
