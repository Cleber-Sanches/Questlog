; Ícone dedicado para arquivos .questlog (DefaultIcon).
; Nome fixo distinto do exe evita cache do Explorer reusar ícone velho.

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\Questlog Guide\DefaultIcon" "" "$\"$INSTDIR\resources\questlog-file.ico$\",0"
  !insertmacro UPDATEFILEASSOC
!macroend
