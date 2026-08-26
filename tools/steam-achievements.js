// Lista conquistas de um app Steam (título, descrição, ícone, %, apiName).
// Fontes: Steam Community (html) + GetGlobalAchievementPercentages (sem key).
// Se existir schema local da Steam, enriquece com apiName/statGroup/bitIndex.
const https = require("https");
const http = require("http");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");
const { parse } = require("./bvdf.js");

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
    return null;
}

function fetchText(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        let parsed;
        try {
            parsed = new URL(url);
        } catch (err) {
            reject(err);
            return;
        }

        const lib = parsed.protocol === "http:" ? http : https;
        lib
            .get(
                url,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
                        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
                    },
                },
                (res) => {
                    if (
                        res.statusCode >= 300 &&
                        res.statusCode < 400 &&
                        res.headers.location &&
                        redirects < 6
                    ) {
                        const next = new URL(res.headers.location, url).toString();
                        res.resume();
                        resolve(fetchText(next, redirects + 1));
                        return;
                    }

                    const chunks = [];
                    res.on("data", (chunk) => chunks.push(chunk));
                    res.on("end", () => {
                        const raw = Buffer.concat(chunks).toString("utf8");
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(`Steam respondeu ${res.statusCode}`));
                            return;
                        }
                        resolve(raw);
                    });
                }
            )
            .on("error", reject);
    });
}

async function fetchJson(url) {
    const raw = await fetchText(url);
    return JSON.parse(raw);
}

function decodeHtml(text) {
    return String(text || "")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function extractIconHash(url) {
    const m = /([a-f0-9]{40})/i.exec(url || "");
    return m ? m[1].toLowerCase() : null;
}

function parseCommunityAchievements(html) {
    const rows = [];
    const re =
        /class="achieveRow[^"]*"[\s\S]*?<img src="([^"]+)"[\s\S]*?achievePercent">\s*([\d.,]+)\s*%[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<h5>([\s\S]*?)<\/h5>/gi;

    let match;
    while ((match = re.exec(html)) !== null) {
        const icon = match[1];
        const percentRaw = match[2].replace(",", ".");
        const globalPercent = Number(percentRaw);
        rows.push({
            title: decodeHtml(match[3]),
            description: decodeHtml(match[4]),
            icon,
            iconHash: extractIconHash(icon),
            globalPercent: Number.isFinite(globalPercent) ? globalPercent : null,
        });
    }
    return rows;
}

async function fetchGlobalPercentages(appId) {
    const url =
        "https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?" +
        new URLSearchParams({ gameid: String(appId) }).toString();
    const data = await fetchJson(url);
    const list = data?.achievementpercentages?.achievements || [];
    return list.map((item) => ({
        apiName: item.name,
        percent: Number(item.percent),
    }));
}

function readLocalSchema(appId) {
    const steamPath = findSteamPath();
    if (!steamPath) return null;

    const schemaPath = path.join(
        steamPath,
        "appcache",
        "stats",
        `UserGameStatsSchema_${appId}.bin`
    );
    if (!fs.existsSync(schemaPath)) return null;

    try {
        const schema = parse(fs.readFileSync(schemaPath));
        const app = schema[String(appId)];
        if (!app?.stats) return null;

        const byHash = new Map();
        const byApiName = new Map();

        for (const groupId of Object.keys(app.stats)) {
            const bits = app.stats[groupId].bits || {};
            for (const bitIndex of Object.keys(bits)) {
                const bit = bits[bitIndex];
                const iconFile = bit?.display?.icon || "";
                const iconHash = extractIconHash(iconFile);
                const title =
                    bit?.display?.name?.brazilian ||
                    bit?.display?.name?.english ||
                    bit?.name ||
                    "";
                const entry = {
                    apiName: bit.name,
                    title,
                    iconFile,
                    iconHash,
                    statGroup: groupId,
                    bitIndex: Number(bitIndex),
                };
                byApiName.set(bit.name, entry);
                if (iconHash) byHash.set(iconHash, entry);
            }
        }

        return { byHash, byApiName };
    } catch {
        return null;
    }
}

function matchApiNames(communityRows, globals) {
    const pool = new Map();
    for (const g of globals) {
        if (!Number.isFinite(g.percent)) continue;
        const key = g.percent.toFixed(1);
        if (!pool.has(key)) pool.set(key, []);
        pool.get(key).push(g.apiName);
    }

    return communityRows.map((row) => {
        if (row.apiName) return row;
        if (row.globalPercent == null) return row;
        const key = Number(row.globalPercent).toFixed(1);
        const list = pool.get(key);
        if (!list || list.length === 0) return row;
        return { ...row, apiName: list.shift() };
    });
}

function cleanDlcLabel(value) {
    return String(value || "")
        .replace(/[™®©]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** Nome de DLC escrito pelo publisher na descrição Steam. */
function extractDlcName(description) {
    const text = String(description || "");
    const match =
        text.match(/\(Requires DLC:\s*([^)]+)\)/i) ||
        text.match(/Requires DLC:\s*([^.)\n]+)/i) ||
        text.match(/\(DLC:\s*([^)]+)\)/i);
    if (!match) return null;
    return cleanDlcLabel(match[1]) || null;
}

/**
 * Grupos conquista→DLC (mesma curadoria usada pela extensão SteamDB).
 * Fonte pública: SteamHunters. SteamDB site/API retorna 403 para bots.
 * @returns {Promise<{ groups: Array<{ dlcAppId: number|null, dlcAppName: string, achievementApiNames: string[] }>, byApiName: Map<string,string> }>}
 */
async function fetchAchievementDlcGroups(appId) {
    const id = String(appId).trim();
    const empty = { groups: [], byApiName: new Map() };
    if (!/^\d+$/.test(id)) return empty;

    try {
        const data = await fetchJson(
            `https://steamhunters.com/api/GetAchievementGroups/v1?appId=${id}&groupBy=dlc`
        );
        const groups = Array.isArray(data?.groups) ? data.groups : [];
        const byApiName = new Map();
        const normalized = [];

        for (const group of groups) {
            const dlcAppId = group?.dlcAppId || null;
            const dlcAppName = cleanDlcLabel(group?.dlcAppName || "");
            const names = Array.isArray(group?.achievementApiNames)
                ? group.achievementApiNames
                : [];
            if (!dlcAppName || !dlcAppId || names.length === 0) continue;

            normalized.push({ dlcAppId, dlcAppName, achievementApiNames: names });
            for (const apiName of names) {
                if (apiName) byApiName.set(String(apiName), dlcAppName);
            }
        }

        return { groups: normalized, byApiName };
    } catch {
        return empty;
    }
}

/** Une aliases: "Shifting Sands" + "Soulmask: Shifting Sands" → nome mais completo. */
function canonicalizeDlcNames(achievements, preferredLabels = []) {
    const labels = new Set(
        preferredLabels.map(cleanDlcLabel).filter((n) => n && n !== "Jogo base")
    );
    for (const item of achievements) {
        const name = cleanDlcLabel(item.dlc);
        if (name && name !== "Jogo base" && name !== "Sem Grupo") labels.add(name);
        const fromDesc = extractDlcName(item.description);
        if (fromDesc) labels.add(fromDesc);
    }

    const sorted = [...labels].sort((a, b) => b.length - a.length || a.localeCompare(b));
    const aliasToCanonical = new Map();
    for (const label of sorted) {
        const lower = label.toLowerCase();
        let canonical = label;
        for (const candidate of sorted) {
            if (candidate === label) continue;
            if (candidate.toLowerCase().includes(lower) && candidate.length > label.length) {
                canonical = candidate;
                break;
            }
        }
        aliasToCanonical.set(lower, canonical);
    }

    for (const item of achievements) {
        const current = cleanDlcLabel(item.dlc);
        if (!current || current === "Jogo base" || current === "Sem Grupo") continue;
        const canonical = aliasToCanonical.get(current.toLowerCase());
        if (canonical) item.dlc = canonical;
    }
    return achievements;
}

function matchPreferredDlcLabel(name, preferredLabels) {
    const needle = cleanDlcLabel(name);
    if (!needle) return null;
    const lower = needle.toLowerCase();
    let best = null;
    for (const label of preferredLabels) {
        const clean = cleanDlcLabel(label);
        if (!clean) continue;
        const L = clean.toLowerCase();
        if (L === lower || L.includes(lower) || lower.includes(L)) {
            if (!best || clean.length > best.length) best = clean;
        }
    }
    return best;
}

/**
 * Prioridade: grupo SteamHunters/SteamDB (apiName) → Requires DLC (publisher) → mantém manual → Jogo base.
 * @param {object[]} achievements
 * @param {Map<string,string>|Record<string,string>} [apiNameToDlc]
 */
function assignDlcFields(achievements, apiNameToDlc = null) {
    const map =
        apiNameToDlc instanceof Map
            ? apiNameToDlc
            : apiNameToDlc
              ? new Map(Object.entries(apiNameToDlc))
              : new Map();
    const preferredLabels = [...new Set(map.values())];

    for (const item of achievements) {
        const apiName = item.apiName ? String(item.apiName) : "";
        const fromGroups = apiName ? map.get(apiName) : null;
        if (fromGroups) {
            item.dlc = fromGroups;
            continue;
        }

        const fromDesc = extractDlcName(item.description);
        if (fromDesc) {
            item.dlc = matchPreferredDlcLabel(fromDesc, preferredLabels) || fromDesc;
            continue;
        }

        const current = String(item.dlc || "").trim();
        if (current && current !== "Jogo base" && current !== "Sem Grupo") {
            continue;
        }
        item.dlc = "Jogo base";
    }

    canonicalizeDlcNames(achievements, preferredLabels);
    return achievements;
}

/**
 * @param {string|number} appId
 * @returns {Promise<{ appId: string, source: string, achievements: object[] }>}
 */
async function fetchSteamAchievements(appId) {
    const id = String(appId).trim();
    if (!/^\d+$/.test(id)) {
        throw new Error("appId inválido");
    }

    const communityUrl = `https://steamcommunity.com/stats/${id}/achievements/?l=brazilian`;
    let rows = [];
    try {
        const html = await fetchText(communityUrl);
        rows = parseCommunityAchievements(html);
    } catch {
        rows = [];
    }

    if (rows.length === 0) {
        // Fallback: inglês (alguns apps não têm página BR / redirecionam)
        try {
            const htmlEn = await fetchText(
                `https://steamcommunity.com/stats/${id}/achievements/?l=english`
            );
            rows = parseCommunityAchievements(htmlEn);
        } catch {
            rows = [];
        }
    }

    let source = "steam-community";
    const local = readLocalSchema(id);

    // Fallback final: só percentuais globais (+ schema local se existir)
    if (rows.length === 0) {
        const globals = await fetchGlobalPercentages(id);
        if (!globals.length) {
            throw new Error(
                "Nenhuma conquista pública encontrada. O jogo pode não ter conquistas Steam."
            );
        }
        source = "global-percent";
        rows = globals.map((g) => {
            const fromLocal = local?.byApiName?.get(g.apiName);
            const iconFile = fromLocal?.iconFile || "";
            const icon = iconFile
                ? `https://shared.fastly.steamstatic.com/community_assets/images/apps/${id}/${iconFile}`
                : "";
            return {
                title: fromLocal?.title || g.apiName,
                description: "",
                icon,
                iconHash: fromLocal?.iconHash || extractIconHash(iconFile),
                globalPercent: g.percent,
                apiName: g.apiName,
                statGroup: fromLocal?.statGroup,
                bitIndex: fromLocal?.bitIndex,
            };
        });
    } else if (local) {
        source = "steam-community+local-schema";
        rows = rows.map((row) => {
            const fromHash = row.iconHash ? local.byHash.get(row.iconHash) : null;
            if (!fromHash) return row;
            return {
                ...row,
                apiName: fromHash.apiName,
                statGroup: fromHash.statGroup,
                bitIndex: fromHash.bitIndex,
                title: row.title || fromHash.title,
            };
        });
    }

    try {
        const globals = await fetchGlobalPercentages(id);
        rows = matchApiNames(rows, globals);
        if (!source.includes("global-percent")) source += "+global-percent";
    } catch {
        // percentuais são opcionais
    }

    const dlcGroups = await fetchAchievementDlcGroups(id);
    if (dlcGroups.groups.length > 0 && !source.includes("steamhunters-dlc")) {
        source += "+steamhunters-dlc";
    }

    const nowBase = Date.now();
    const achievements = rows.map((row, index) => {
        const description = row.description || "";
        return {
            id: nowBase + index,
            apiName: row.apiName || undefined,
            title: row.title || `Conquista ${index + 1}`,
            description,
            icon: row.icon || "",
            completed: false,
            unlockedAt: null,
            group: "Sem Grupo",
            dlc: "Jogo base",
            videoUrl: "",
            guideUrl: "",
            tips: "",
            globalPercent:
                typeof row.globalPercent === "number" ? row.globalPercent : undefined,
            statGroup: row.statGroup,
            bitIndex: row.bitIndex,
        };
    });

    assignDlcFields(achievements, dlcGroups.byApiName);

    return {
        appId: id,
        source,
        achievements,
        dlcGroups: dlcGroups.groups,
    };
}

module.exports = {
    fetchSteamAchievements,
    fetchAchievementDlcGroups,
    extractDlcName,
    assignDlcFields,
    canonicalizeDlcNames,
};
