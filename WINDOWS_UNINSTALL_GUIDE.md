# Guida per disinstallare "Reviewer 2" su Windows

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

## Metodo 2: Se non appare nella lista

1. Cerca ed elimina manualmente la cartella:
   ```
   C:\Users\<username>\AppData\Local\reviewer-2
   C:\Users\<username>\AppData\Local\pdf-reviewer
   ```

2. Elimina il collegamento sul desktop:
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
