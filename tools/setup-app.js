// Instalador do Guia de Conquistas.
// Empacotado como dist/GuiaConquistas-Setup.exe (npm run build:installer).
const fs = require("fs");
const path = require("path");
const { execFileSync, spawn } = require("child_process");
const readline = require("readline");

const APP_NAME = "Guia de Conquistas";
const EXE_NAME = "GuiaConquistas.exe";
const INSTALL_DIR = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local"),
    "GuiaConquistas"
);
const START_MENU_DIR = path.join(
    process.env.APPDATA || "",
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    APP_NAME
);
const DESKTOP_DIR = process.env.USERPROFILE
    ? path.join(process.env.USERPROFILE, "Desktop")
    : "";

function payloadRoot() {
    // No build/pkg: pasta "payload" embutida ao lado do setup.js
    const staged = path.join(__dirname, "payload");
    if (fs.existsSync(path.join(staged, EXE_NAME))) return staged;

    // Dev no repo (path dinâmico para o pkg não tentar embutir)
    const dist = [__dirname, "..", "dist", "GuiaConquistas"].reduce((a, b) =>
        path.join(a, b)
    );
    if (fs.existsSync(path.join(dist, EXE_NAME))) return dist;

    return staged;
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(from, to);
        else {
            fs.mkdirSync(path.dirname(to), { recursive: true });
            fs.copyFileSync(from, to);
        }
    }
}

function writeShortcut(lnkPath, target, workDir) {
    const ps = `
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut(${JSON.stringify(lnkPath)})
$s.TargetPath = ${JSON.stringify(target)}
$s.WorkingDirectory = ${JSON.stringify(workDir)}
$s.Description = ${JSON.stringify(APP_NAME)}
$s.Save()
`.trim();
    execFileSync(
        "powershell.exe",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
        { stdio: "ignore" }
    );
}

function writeUninstaller(appExe) {
    const uninstallCmd = `@echo off
title Desinstalar ${APP_NAME}
echo Removendo ${APP_NAME}...
taskkill /F /IM ${EXE_NAME} >nul 2>&1
timeout /t 1 /nobreak >nul
rmdir /s /q "%LOCALAPPDATA%\\GuiaConquistas"
rmdir /s /q "%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\${APP_NAME}"
del /f /q "%USERPROFILE%\\Desktop\\${APP_NAME}.lnk" 2>nul
reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GuiaConquistas" /f >nul 2>&1
echo Pronto.
pause
`;
    fs.writeFileSync(path.join(INSTALL_DIR, "Desinstalar.cmd"), uninstallCmd, "utf8");

    const regPs = `
$reg = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GuiaConquistas'
New-Item -Path $reg -Force | Out-Null
Set-ItemProperty $reg -Name DisplayName -Value ${JSON.stringify(APP_NAME)}
Set-ItemProperty $reg -Name DisplayIcon -Value ${JSON.stringify(appExe)}
Set-ItemProperty $reg -Name UninstallString -Value ${JSON.stringify(
        `cmd.exe /c "${path.join(INSTALL_DIR, "Desinstalar.cmd")}"`
    )}
Set-ItemProperty $reg -Name InstallLocation -Value ${JSON.stringify(INSTALL_DIR)}
Set-ItemProperty $reg -Name Publisher -Value ${JSON.stringify(APP_NAME)}
Set-ItemProperty $reg -Name NoModify -Value 1 -Type DWord
Set-ItemProperty $reg -Name NoRepair -Value 1 -Type DWord
`;
    try {
        execFileSync(
            "powershell.exe",
            ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", regPs],
            { stdio: "ignore" }
        );
    } catch (_) {
        // opcional
    }
}

function ask(question, defaultYes = true) {
    if (!process.stdin.isTTY) return Promise.resolve(defaultYes);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            const a = String(answer || "").trim().toLowerCase();
            if (!a) resolve(defaultYes);
            else resolve(a === "s" || a === "y" || a === "sim");
        });
    });
}

async function main() {
    console.log("");
    console.log(`  ${APP_NAME} — Instalador`);
    console.log("  --------------------------------");
    console.log(`  Destino: ${INSTALL_DIR}`);
    console.log("");

    const src = payloadRoot();
    if (!fs.existsSync(path.join(src, EXE_NAME))) {
        console.error("Pacote do app não encontrado dentro do instalador.");
        console.error("Gere com: npm run build:installer");
        process.exit(1);
    }

    console.log("Instalando arquivos...");
    fs.mkdirSync(INSTALL_DIR, { recursive: true });
    copyDir(src, INSTALL_DIR);

    const appExe = path.join(INSTALL_DIR, EXE_NAME);
    fs.mkdirSync(START_MENU_DIR, { recursive: true });
    writeShortcut(path.join(START_MENU_DIR, `${APP_NAME}.lnk`), appExe, INSTALL_DIR);
    writeShortcut(
        path.join(START_MENU_DIR, `Desinstalar ${APP_NAME}.lnk`),
        path.join(INSTALL_DIR, "Desinstalar.cmd"),
        INSTALL_DIR
    );

    if (await ask("Criar atalho na Área de Trabalho? [S/n] ", true)) {
        if (DESKTOP_DIR) {
            writeShortcut(path.join(DESKTOP_DIR, `${APP_NAME}.lnk`), appExe, INSTALL_DIR);
        }
    }

    writeUninstaller(appExe);

    console.log("");
    console.log("Instalação concluída.");
    console.log(`  Menu Iniciar → ${APP_NAME}`);
    console.log("");

    if (await ask("Abrir o guia agora? [S/n] ", true)) {
        spawn(appExe, [], {
            cwd: INSTALL_DIR,
            detached: true,
            stdio: "ignore",
        }).unref();
    }

    console.log("Pode fechar esta janela.");
}

main().catch((err) => {
    console.error(err);
    console.log("");
    console.log("Pressione Enter para sair...");
    try {
        process.stdin.resume();
        process.stdin.once("data", () => process.exit(1));
    } catch (_) {
        process.exit(1);
    }
});
