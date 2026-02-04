; Custom NSIS installer script for Reviewer 2
; Simplified version to avoid integrity check errors

!macro customInstall
  ; Write installation directory to a marker file
  FileOpen $0 "$INSTDIR\install_path.txt" w
  FileWrite $0 "$INSTDIR"
  FileClose $0
!macroend

!macro customUnInstall
  ; Try to close running application before uninstall
  nsExec::Exec 'taskkill /F /IM ${PRODUCT_FILENAME}.exe /T'
  Sleep 1000

  ; Ask user if they want to delete application data
  ; Using /SD IDNO sets "No" as the default for silent uninstalls
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to delete all application data?$\r$\n$\r$\nThis includes:$\r$\n• All imported PDFs and their annotations$\r$\n• Application settings and preferences$\r$\n• Category configurations$\r$\n$\r$\nClick 'No' to keep your data for future use." \
    /SD IDNO \
    IDYES +1 IDNO +3
    ; User clicked Yes - delete app data
    RMDir /r "$APPDATA\${APP_FILENAME}"
    Goto +2
    ; User clicked No - skip deletion
    Goto +1

  ; Clean up marker file
  Delete "$INSTDIR\install_path.txt"
!macroend
