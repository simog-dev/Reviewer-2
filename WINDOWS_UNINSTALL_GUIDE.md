# Guida per disinstallare "Reviewer 2" su Windows

## 💾 Gestione dei dati durante la disinstallazione

Durante il processo di disinstallazione, ti verrà chiesto se vuoi **eliminare tutti i dati dell'applicazione** oppure **mantenerli** per un uso futuro.

**I dati includono:**
- Tutti i PDF importati e le relative annotazioni
- Impostazioni e preferenze dell'applicazione
- Configurazioni delle categorie

**Nota:** La scelta predefinita è "No" (mantieni i dati). Se scegli di mantenere i dati, potrai reinstallare l'applicazione in futuro e ritrovare tutto come lo avevi lasciato.

## ⚠️ IMPORTANTE: Prima di disinstallare

**Chiudi completamente l'applicazione Reviewer 2** prima di procedere con la disinstallazione. Se l'app è in esecuzione, otterrai l'errore "Installer integrity check has failed".

### Come chiudere completamente l'app:
1. Chiudi tutte le finestre di Reviewer 2
2. Controlla nella system tray (area notifiche) se l'icona è ancora presente
3. Se presente, fai click destro → Esci
4. Apri Task Manager (Ctrl+Shift+Esc) e verifica che "Reviewer2.exe" non sia in esecuzione

## Metodo 1: Pannello di controllo (Raccomandato)

1. **Assicurati che Reviewer 2 sia completamente chiuso**
2. Premi `Win + I` per aprire Impostazioni
3. Vai su **App → App installate**
4. Cerca "Reviewer 2"
5. Clicca sui tre puntini → **Disinstalla**
6. Segui le istruzioni della procedura guidata

## Metodo 2: Eliminazione manuale dei dati dell'applicazione

Se hai scelto di **mantenere i dati** durante la disinstallazione ma ora vuoi eliminarli, oppure se l'app non appare nella lista delle applicazioni installate:

1. Elimina manualmente la cartella dei dati dell'applicazione:
   ```
   C:\Users\<username>\AppData\Roaming\reviewer-2
   ```
   **Nota:** Questa cartella contiene tutti i tuoi PDF, annotazioni e impostazioni.

2. Elimina il collegamento sul desktop (se presente):
   - Tasto destro sul collegamento → Elimina

3. (Opzionale) Pulisci il registro:
   - Premi `Win + R`, digita `regedit`
   - Cerca `Reviewer 2` e elimina le chiavi trovate
   - **ATTENZIONE**: fai backup del registro prima!

## Metodo 3: Uninstaller manuale

Cerca il file di disinstallazione nella cartella di installazione:

**Installazione standard:**
```
C:\Program Files\Reviewer 2\Uninstall Reviewer 2.exe
```

**Installazione personalizzata:**
Se hai installato in una cartella personalizzata, cerca il file nella cartella che hai scelto:
```
<tua_cartella>\Reviewer 2\Uninstall Reviewer 2.exe
```

**Nota importante:** Se hai installato in una cartella personalizzata e l'uninstaller non funziona:
1. Fai click destro sul file "Uninstall Reviewer 2.exe"
2. Seleziona "Esegui come amministratore"
3. Segui le istruzioni

## Metodo 4: Uninstaller dal registro (per installazioni personalizzate)

Se hai installato in una cartella personalizzata e nessuno dei metodi sopra funziona:

1. Premi `Win + R` e digita `regedit`
2. Vai a: `HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`
3. Cerca una chiave che contiene "Reviewer 2"
4. Controlla il valore "InstallLocation" per trovare dove è installata l'app
5. Vai a quella cartella e esegui "Uninstall Reviewer 2.exe" come amministratore
