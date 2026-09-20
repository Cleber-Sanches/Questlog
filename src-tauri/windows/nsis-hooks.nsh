; Ícone dedicado para arquivos .questlog (DefaultIcon).
; O template NSIS do Tauri aponta DefaultIcon para o .exe; trocamos depois da associação.

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\Questlog Guide\DefaultIcon" "" "$\"$INSTDIR\resources\questlog-file.ico$\",0"
  !insertmacro UPDATEFILEASSOC
!macroend
