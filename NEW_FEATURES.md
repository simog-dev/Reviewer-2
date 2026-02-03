# Feature Roadmap

## Major Features
### 1. Evidenziazione senza annotazione
- Possibilità di evidenziare testo **senza creare un’annotazione**
- Da valutare:
  - Due bottoni separati nel pop-up: **Annotate** e **Highlight**
  - No bottoni, alla selezione del testo appare un pop-up con due icone (Una per annotate e una per highlight), se si clicca su highlight viene semplicemente evidenziato il testo (nessuna annotazione), se viene cliccato il tasto Annotate, appare il pop-up di scelta della categoria e poi si apre il modal per inserire il commento (come funziona adesso)

### 2. Importare delle annotazioni (per il futuro)
- Dopo aver caricato un PDF dev'essere possibile caricare delle annotazioni esportate in precedenza o da un altro utente
- Dobbiamo trovare un modo per verificare se quelle annotazioni appartengono a quel file. Non penso esista un modo sicuro al 100%:
  - possiamo controllare il nome, ma il nome può cambiare
  - qualche checksum forse può funzionare?
- Se non riusciamo a verificare se il PDF è lo stesso dovremmo fare apparire una modal chiedendo all'utente se vuole comunque proseguire e provare a caricare le annotazioni oppure no. Se si, deve apparire un toast actionable che chiede se confermare o annulare l'import. Nel caso di annullare vengono rimosse tutte le annotazioni create durante l'import.

---

## Minor Features
### 1. Cancella i file durante Uninstall
- Dare all'utente la possibilità di scegliere se mantenere o cancellare i dati dell'app quando si disinstalla.
