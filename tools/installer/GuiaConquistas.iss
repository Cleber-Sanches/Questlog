; Instalador Windows — Guia de Conquistas
; Compilar: ISCC.exe tools\installer\GuiaConquistas.iss
; (ou npm run build:installer)

#define MyAppName "Guia de Conquistas"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Guia de Conquistas"
#define MyAppExeName "GuiaConquistas.exe"
#define MyAppURL "http://localhost:5757/"

[Setup]
AppId={{A7C3E9F1-2B4D-4E6A-9C8F-1D2E3F4A5B6C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={localappdata}\GuiaConquistas
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
; Sem admin — instala na pasta do usuário
PrivilegesRequired=lowest
OutputDir=..\..\dist
OutputBaseFilename=GuiaConquistas-Setup
SetupIconFile=
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayIcon={app}\{#MyAppExeName}
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
InfoBeforeFile=
LicenseFile=
CloseApplications=force
RestartApplications=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"; Flags: checkedonce

[Files]
Source: "..\..\dist\GuiaConquistas\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{group}\Desinstalar {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Abrir {#MyAppName} agora"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\config\backups"
Type: dirifempty; Name: "{app}"
