// Sincroniza o config/soulmask-achievements-steamdb.json com o progresso real da Steam.
// Uso: node tools/sync-steam-progress.js
// (Para atualização automática enquanto joga, prefira "node tools/server.js")
const fs = require("fs");
const path = require("path");
const { getProgress, APP_ID } = require("./steam-progress.js");

const CONFIG_PATH = path.join(__dirname, "..", "config", "soulmask-achievements-steamdb.json");
const BACKUPS_DIR = path.join(__dirname, "..", "config", "backups");
const ICON_BASE = `https://shared.fastly.steamstatic.com/community_assets/images/apps/${APP_ID}/`;

function ensureBackupsDir() {
    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
}

function main() {
    const progress = getProgress();
    console.log(`Conta detectada: ${progress.steamUser.personaName} (${progress.steamUser.accountName}) - SteamID3 ${progress.steamUser.steamId3}`);

    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(`Config não encontrado em ${CONFIG_PATH}.`);
    }
    const prevList = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

    const hashToGroup = {};
    const apiNameToPrev = {};
    prevList.forEach((item) => {
        const m = /([a-f0-9]{40})/i.exec(item.icon || "");
        if (m) hashToGroup[m[1]] = item.group;
        if (item.apiName) apiNameToPrev[item.apiName] = item;
    });

    const result = [];
    let idBase = 1790000000000;
    const newlyCompleted = [];

    for (const [apiName, info] of Object.entries(progress.achievements)) {
        const prev = apiNameToPrev[apiName];
        if (info.completed && prev && !prev.completed) {
            newlyCompleted.push(info.title);
        }

        result.push({
            id: prev ? prev.id : idBase++,
            apiName,
            title: info.title,
            description: (prev && prev.description) || "",
            icon: ICON_BASE + info.icon,
            completed: info.completed,
            unlockedAt: info.unlockedAt,
            group: (info.iconHash && hashToGroup[info.iconHash]) || (prev && prev.group) || "Sem Grupo",
            statGroup: info.statGroup,
            bitIndex: info.bitIndex,
            globalPercent: prev && typeof prev.globalPercent === "number" ? prev.globalPercent : undefined,
        });
    }

    ensureBackupsDir();
    const backupPath = path.join(
        BACKUPS_DIR,
        `soulmask-achievements-steamdb.bak-${Date.now()}.json`
    );
    fs.copyFileSync(CONFIG_PATH, backupPath);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(result, null, 4), "utf8");

    const completedCount = result.filter((r) => r.completed).length;
    console.log(`\nTotal de conquistas: ${result.length}`);
    console.log(`Concluídas detectadas: ${completedCount}`);
    if (newlyCompleted.length > 0) {
        console.log(`\nNovas desde a última sincronização:`);
        newlyCompleted.forEach((t) => console.log(`  ✅ ${t}`));
    }
    console.log(`\nArquivo atualizado: ${CONFIG_PATH}`);
    console.log(`Backup salvo em: ${backupPath}`);
    console.log(`Importe pelo botão "Importar" no app para aplicar.`);
}

main();
