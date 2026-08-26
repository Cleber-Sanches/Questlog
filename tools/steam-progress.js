// Lógica compartilhada: acha a conta ativa da Steam e lê o progresso de conquistas
// de um app a partir dos caches locais em appcache/stats.
const fs = require("fs");
const path = require("path");
const { parse } = require("./bvdf.js");

const APP_ID = "2646460"; // Soulmask (default / CLI)

function findSteamPath() {
    const candidates = [
        process.env.STEAM_PATH,
        "C:/Program Files (x86)/Steam",
        "C:/Program Files/Steam",
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, "appcache", "stats"))) {
            return candidate;
        }
    }

    throw new Error(
        "Não encontrei a instalação da Steam. Defina a variável de ambiente STEAM_PATH."
    );
}

function parseTextVdfUsers(text) {
    const users = [];
    const blockRegex = /"(\d{17})"\s*\{([^}]*)\}/g;
    let match;
    while ((match = blockRegex.exec(text)) !== null) {
        const steamId64 = match[1];
        const body = match[2];
        const get = (key) => {
            const m = new RegExp(`"${key}"\\s*"([^"]*)"`).exec(body);
            return m ? m[1] : null;
        };
        users.push({
            steamId64,
            accountName: get("AccountName"),
            personaName: get("PersonaName"),
            timestamp: Number(get("Timestamp") || 0),
            autoLogin: get("AutoLogin") === "1",
        });
    }
    return users;
}

function pickActiveUser(steamPath) {
    const loginUsersPath = path.join(steamPath, "config", "loginusers.vdf");
    const text = fs.readFileSync(loginUsersPath, "utf8");
    const users = parseTextVdfUsers(text);

    if (users.length === 0) {
        throw new Error("Não encontrei nenhuma conta em loginusers.vdf.");
    }

    const autoLoginUser = users.find((u) => u.autoLogin);
    const chosen = autoLoginUser || users.sort((a, b) => b.timestamp - a.timestamp)[0];

    const steamId3 = (BigInt(chosen.steamId64) - 76561197960265728n).toString();
    return { ...chosen, steamId3 };
}

function extractIconHash(iconFile) {
    const m = /([a-f0-9]{40})/i.exec(iconFile || "");
    return m ? m[1] : null;
}

/**
 * @param {string} [appId] Steam AppID (default: Soulmask)
 * @returns {{ appId: string, steamUser: object, mtimeMs: number, achievements: object }}
 */
function getProgress(appId = APP_ID) {
    const id = String(appId || APP_ID).trim();
    if (!/^\d+$/.test(id)) {
        throw new Error("appId inválido");
    }

    const steamPath = findSteamPath();
    const user = pickActiveUser(steamPath);

    const schemaPath = path.join(steamPath, "appcache", "stats", `UserGameStatsSchema_${id}.bin`);
    const statsPath = path.join(
        steamPath,
        "appcache",
        "stats",
        `UserGameStats_${user.steamId3}_${id}.bin`
    );

    if (!fs.existsSync(schemaPath)) {
        throw new Error(
            `Schema não encontrado para o app ${id}. Abra o jogo pelo menos uma vez na Steam.`
        );
    }
    if (!fs.existsSync(statsPath)) {
        throw new Error(
            `Progresso não encontrado para essa conta (app ${id}). Abra o jogo pelo menos uma vez.`
        );
    }

    const mtimeMs = fs.statSync(statsPath).mtimeMs;

    const schema = parse(fs.readFileSync(schemaPath));
    const userStats = parse(fs.readFileSync(statsPath));

    const app = schema[id];
    if (!app?.stats) {
        throw new Error(`Schema inválido para o app ${id}.`);
    }

    const cache = userStats.cache || {};

    const achievements = {};
    for (const groupId of Object.keys(app.stats)) {
        const bits = app.stats[groupId].bits || {};
        for (const bitIndex of Object.keys(bits)) {
            const bit = bits[bitIndex];
            const unlockTs =
                cache[groupId] &&
                cache[groupId].AchievementTimes &&
                cache[groupId].AchievementTimes[bitIndex];
            const completed = unlockTs !== undefined;

            achievements[bit.name] = {
                completed,
                unlockedAt: completed ? new Date(unlockTs * 1000).toISOString() : null,
                title: bit.display?.name?.brazilian || bit.display?.name?.english || bit.name,
                icon: bit.display?.icon,
                iconHash: extractIconHash(bit.display?.icon),
                statGroup: groupId,
                bitIndex: Number(bitIndex),
            };
        }
    }

    return {
        appId: id,
        steamUser: {
            personaName: user.personaName,
            accountName: user.accountName,
            steamId3: user.steamId3,
        },
        mtimeMs,
        achievements,
    };
}

module.exports = { getProgress, APP_ID };
