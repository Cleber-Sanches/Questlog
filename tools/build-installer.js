// Gera GuiaConquistas-Setup.exe — instalador com atalhos e desinstalador.
// Uso: npm run build:installer
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DIST_APP = path.join(ROOT, "dist", "GuiaConquistas");
const SETUP_OUT = path.join(ROOT, "dist", "GuiaConquistas-Setup.exe");
const STAGE = path.join(ROOT, "tools", ".installer-build");
const SETUP_SRC = path.join(ROOT, "tools", "setup-app.js");

function rmrf(dir) {
    fs.rmSync(dir, { recursive: true, force: true });
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

function main() {
    console.log("1/3 Gerando pacote do app…");
    execSync("node tools/build-portable.js", { cwd: ROOT, stdio: "inherit" });

    if (!fs.existsSync(path.join(DIST_APP, "GuiaConquistas.exe"))) {
        throw new Error("dist/GuiaConquistas/GuiaConquistas.exe não encontrado.");
    }

    console.log("2/3 Preparando staging do instalador…");
    rmrf(STAGE);
    fs.mkdirSync(path.join(STAGE, "payload"), { recursive: true });
    copyDir(DIST_APP, path.join(STAGE, "payload"));
    fs.copyFileSync(SETUP_SRC, path.join(STAGE, "setup.js"));
    fs.writeFileSync(
        path.join(STAGE, "package.json"),
        JSON.stringify(
            {
                name: "guia-conquistas-setup",
                private: true,
                bin: "setup.js",
                pkg: {
                    assets: ["payload/**/*"],
                    targets: ["node22-win-x64"],
                    outputPath: path.join("..", "..", "dist"),
                },
            },
            null,
            2
        ),
        "utf8"
    );

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

    console.log("3/3 Empacotando instalador (pode demorar)…");
    execSync(
        `${pkgCli} "setup.js" --config "package.json" --targets node22-win-x64 --compress GZip --output "${SETUP_OUT}"`,
        { cwd: STAGE, stdio: "inherit", shell: true }
    );

    rmrf(STAGE);

    if (!fs.existsSync(SETUP_OUT)) {
        throw new Error("Falha: GuiaConquistas-Setup.exe não foi gerado.");
    }

    const mb = (fs.statSync(SETUP_OUT).size / (1024 * 1024)).toFixed(1);
    console.log("");
    console.log("OK — instalador pronto:");
    console.log(`  ${SETUP_OUT} (${mb} MB)`);
    console.log("");
    console.log("Envie só esse arquivo.");
    console.log("A pessoa abre → instala (atalhos + desinstalador) → usa.");
}

main();
