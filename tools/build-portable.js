// Gera pasta portátil com .exe — a outra pessoa só abre GuiaConquistas.exe
// Uso: npm run build:exe
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "dist", "GuiaConquistas");
const EXE_NAME = "GuiaConquistas.exe";

const COPY_FILES = ["index.html", "style.css", "script.js", "package.json"];
const COPY_DIRS = [
    { from: "assets", to: "assets" },
    { from: "config", to: "config" },
];

function rmrf(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        // Não embute backups pessoais no pacote
        if (entry.name === "backups" && path.basename(src) === "config") {
            fs.mkdirSync(path.join(dest, "backups"), { recursive: true });
            fs.writeFileSync(path.join(dest, "backups", ".gitkeep"), "");
            continue;
        }
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(from, to);
        else copyFile(from, to);
    }
}

function writeLeiame() {
    const text = `Guia de Conquistas (portátil)
=============================

COMO USAR
1. Dê dois cliques em GuiaConquistas.exe
2. O navegador abre sozinho em http://localhost:5757/
3. Deixe a janela preta aberta enquanto usa o guia
4. Para fechar: feche a janela do .exe (ou Ctrl+C nela)

STEAM
- O sync de progresso lê a Steam instalada NESTE PC
- A outra pessoa precisa ter a Steam logada no Windows dela

CONTEÚDO
- Não precisa instalar Node.js
- Não precisa da pasta do projeto original
- Guia/config vem junto nesta pasta

Problemas comuns
- Antivírus pode bloquear o .exe na primeira vez — liberar/permitir
- Porta 5757 ocupada: feche outra instância do guia
`;
    fs.writeFileSync(path.join(OUT_DIR, "LEIA-ME.txt"), text, "utf8");
}

function main() {
    console.log("Limpando dist/GuiaConquistas…");
    rmrf(OUT_DIR);
    fs.mkdirSync(OUT_DIR, { recursive: true });

    console.log("Copiando arquivos do app…");
    for (const file of COPY_FILES) {
        const src = path.join(ROOT, file);
        if (fs.existsSync(src)) copyFile(src, path.join(OUT_DIR, file));
    }
    for (const dir of COPY_DIRS) {
        copyDir(path.join(ROOT, dir.from), path.join(OUT_DIR, dir.to));
    }
    writeLeiame();

    const pkgBin = path.join(
        ROOT,
        "node_modules",
        "@yao-pkg",
        "pkg",
        "lib-es5",
        "bin.js"
    );
    const pkgCli = fs.existsSync(pkgBin)
        ? `"${process.execPath}" "${pkgBin}"`
        : "npx --yes @yao-pkg/pkg";

    const serverEntry = path.join(ROOT, "tools", "server.js");
    const exeOut = path.join(OUT_DIR, EXE_NAME);

    console.log("Gerando executável (pode demorar na 1ª vez)…");
    execSync(
        `${pkgCli} "${serverEntry}" --targets node22-win-x64 --compress GZip --output "${exeOut}"`,
        { cwd: ROOT, stdio: "inherit", shell: true }
    );

    if (!fs.existsSync(exeOut)) {
        throw new Error("Falha: .exe não foi gerado.");
    }

    console.log("");
    console.log("OK — pasta pronta para enviar:");
    console.log(`  ${OUT_DIR}`);
    console.log("");
    console.log("Envie a pasta inteira GuiaConquistas (zip).");
    console.log("A outra pessoa só abre GuiaConquistas.exe");
}

main();
