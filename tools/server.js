// Servidor local: serve o app e expõe APIs Steam (progresso + busca + backups).
// Uso: node tools/server.js
const http = require("http");
const https = require("https");
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");
const { exec, execSync } = require("child_process");
const { getProgress } = require("./steam-progress.js");
const {
    fetchSteamAchievements,
    fetchAchievementDlcGroups,
} = require("./steam-achievements.js");

/** Pasta do app: ao lado do .exe (pkg) ou raiz do projeto (dev). */
const ROOT = path.resolve(
    process.pkg ? path.dirname(process.execPath) : path.join(__dirname, "..")
);
const BACKUPS_DIR = path.join(ROOT, "config", "backups");
const PORT = Number(process.env.PORT) || 5757;
const steamAppTypeCache = new Map();
const isWatchMode =
    process.execArgv.some((arg) => arg === "--watch" || arg.startsWith("--watch-")) ||
    process.argv.includes("--watch");

function killPort(port) {
    try {
        if (process.platform === "win32") {
            let stdout = "";
            try {
                stdout = execSync(`netstat -ano | findstr :${port}`, {
                    encoding: "utf8",
                    stdio: ["ignore", "pipe", "ignore"],
                });
            } catch {
                return;
            }

            const pids = new Set();
            for (const line of stdout.split(/\r?\n/)) {
                if (!/LISTENING/i.test(line)) continue;
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && /^\d+$/.test(pid) && pid !== "0") {
                    pids.add(pid);
                }
            }

            for (const pid of pids) {
                if (String(pid) === String(process.pid)) continue;
                try {
                    execSync(`taskkill /F /PID ${pid}`, {
                        stdio: "ignore",
                    });
                    console.log(`Porta ${port} liberada (PID ${pid}).`);
                } catch {
                    // processo já encerrou
                }
            }
            return;
        }

        try {
            execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
            console.log(`Porta ${port} liberada.`);
        } catch {
            // nada escutando
        }
    } catch {
        // ignore
    }
}

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => {
            raw += chunk;
            if (raw.length > 20 * 1024 * 1024) {
                reject(new Error("Payload muito grande"));
                req.destroy();
            }
        });
        req.on("end", () => resolve(raw));
        req.on("error", reject);
    });
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https
            .get(
                url,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                        "Accept-Encoding": "gzip, deflate",
                        Accept: "application/json,text/plain,*/*",
                    },
                },
                (res) => {
                    const chunks = [];
                    res.on("data", (chunk) => chunks.push(chunk));
                    res.on("end", () => {
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(`Steam respondeu ${res.statusCode}`));
                            return;
                        }
                        const buf = Buffer.concat(chunks);
                        const enc = String(res.headers["content-encoding"] || "");
                        const finish = (err, out) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            try {
                                resolve(JSON.parse(out.toString("utf8")));
                            } catch (parseErr) {
                                reject(parseErr);
                            }
                        };
                        if (enc.includes("gzip")) zlib.gunzip(buf, finish);
                        else if (enc.includes("deflate")) zlib.inflate(buf, finish);
                        else finish(null, buf);
                    });
                }
            )
            .on("error", reject);
    });
}

function ensureBackupsDir() {
    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
}

function serveStatic(req, res) {
    let reqPath = decodeURIComponent(req.url.split("?")[0]);
    if (reqPath === "/") reqPath = "/index.html";
    const cleaned = path.normalize(reqPath).replace(/^([/\\])+/, "");
    const filePath = path.resolve(ROOT, cleaned);
    const rel = path.relative(ROOT, filePath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        res.writeHead(403);
        return res.end("Forbidden");
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            return res.end("Não encontrado");
        }
        const ext = path.extname(filePath);
        const headers = {
            "Content-Type": MIME[ext] || "application/octet-stream",
        };
        if (ext === ".html" || ext === ".js" || ext === ".css") {
            headers["Cache-Control"] = "no-store, max-age=0";
        }
        res.writeHead(200, headers);
        res.end(data);
    });
}

function serveProgress(req, res) {
    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const appId = String(url.searchParams.get("appId") || "").trim() || undefined;
        const progress = getProgress(appId);
        sendJson(res, 200, progress);
    } catch (err) {
        sendJson(res, 200, { error: err.message });
    }
}

async function serveSteamSearch(req, res) {
    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const term = (url.searchParams.get("q") || "").trim();
        if (!term) {
            return sendJson(res, 200, { items: [] });
        }

        const steamUrl =
            "https://store.steampowered.com/api/storesearch/?" +
            new URLSearchParams({
                term,
                l: "brazilian",
                cc: "BR",
                category1: "998",
            }).toString();

        const data = await fetchJson(steamUrl);
        const candidates = (data.items || [])
            .filter((item) => item && item.id && isSteamSearchCandidate(item))
            .slice(0, 16);

        // Confirma tipo real na Steam (game vs dlc/music/...)
        const checked = await Promise.all(
            candidates.map(async (item) => {
                const appId = String(item.id);
                const type = await getSteamAppType(appId);
                if (type !== "game") return null;
                return {
                    appId,
                    name: item.name,
                    image:
                        item.tiny_image ||
                        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
                    steamdbUrl: `https://steamdb.info/app/${appId}/`,
                };
            })
        );

        const items = checked.filter(Boolean).slice(0, 10);
        sendJson(res, 200, { items });
    } catch (err) {
        sendJson(res, 200, { error: err.message, items: [] });
    }
}

async function getSteamAppType(appId) {
    const id = String(appId);
    if (steamAppTypeCache.has(id)) return steamAppTypeCache.get(id);

    try {
        const details = await fetchJson(
            `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(id)}&filters=basic&cc=BR&l=english`
        );
        const type = details?.[id]?.success ? String(details[id].data?.type || "").toLowerCase() : null;
        steamAppTypeCache.set(id, type);
        return type;
    } catch {
        steamAppTypeCache.set(id, null);
        return null;
    }
}

function isSteamSearchCandidate(item) {
    const type = String(item.type || "").toLowerCase();
    if (type && type !== "app" && type !== "game") return false;

    const name = String(item.name || "");
    if (!name.trim()) return false;

    // Pré-filtro rápido (a confirmação final é appdetails type=game)
    if (
        /\bDLC\b/i.test(name) ||
        /\b(soundtrack|artbook|ost)\b/i.test(name) ||
        /\b(season pass|expansion pass|cosmetic pack|theme pack)\b/i.test(name) ||
        /\b(demo|playtest|prologue)\b/i.test(name) ||
        /^atualiza(ç|c)ão para\b/i.test(name) ||
        /\bdigital (deluxe )?upgrade\b/i.test(name)
    ) {
        return false;
    }

    return true;
}

async function serveBackupSave(req, res) {
    if (req.method !== "POST") {
        return sendJson(res, 405, { error: "Use POST" });
    }

    try {
        ensureBackupsDir();
        const raw = await readBody(req);
        const body = JSON.parse(raw || "{}");
        const payload = body.pack || body.achievements;

        if (!payload || (Array.isArray(payload) === false && typeof payload !== "object")) {
            return sendJson(res, 400, { error: "payload de backup inválido" });
        }

        const safeBase = String(body.filename || `${body.appId || "jogo"}-guia.json`)
            .replace(/[^a-zA-Z0-9._-]+/g, "-")
            .replace(/^\.+/, "");
        const stamp = Date.now();
        const fileName = safeBase.replace(/\.json$/i, "") + `-${stamp}.json`;
        const filePath = path.join(BACKUPS_DIR, fileName);

        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
        sendJson(res, 200, {
            ok: true,
            path: path.relative(ROOT, filePath).replace(/\\/g, "/"),
        });
    } catch (err) {
        sendJson(res, 500, { error: err.message });
    }
}

async function serveSteamAchievements(req, res) {
    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const appId = String(url.searchParams.get("appId") || "").trim();
        if (!/^\d+$/.test(appId)) {
            return sendJson(res, 400, { error: "appId inválido" });
        }

        const result = await fetchSteamAchievements(appId);
        sendJson(res, 200, result);
    } catch (err) {
        sendJson(res, 200, { error: err.message, achievements: [] });
    }
}

async function serveSteamDlcGroups(req, res) {
    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const appId = String(url.searchParams.get("appId") || "").trim();
        if (!/^\d+$/.test(appId)) {
            return sendJson(res, 400, { error: "appId inválido" });
        }

        const result = await fetchAchievementDlcGroups(appId);
        sendJson(res, 200, {
            appId,
            groups: result.groups,
            byApiName: Object.fromEntries(result.byApiName),
        });
    } catch (err) {
        sendJson(res, 200, { appId: null, groups: [], byApiName: {}, error: err.message });
    }
}

async function serveSteamClientIcon(req, res) {
    try {
        const url = new URL(req.url, `http://localhost:${PORT}`);
        const appId = String(url.searchParams.get("appId") || "").trim();
        if (!/^\d+$/.test(appId)) {
            return sendJson(res, 400, { error: "appId inválido" });
        }

        const info = await fetchJson(`https://api.steamcmd.net/v1/info/${appId}`);
        const common = info?.data?.[appId]?.common || {};
        const clienticon = common.clienticon || common.icon || "";
        if (!clienticon) {
            return sendJson(res, 200, {
                appId,
                image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
                fallback: true,
            });
        }

        sendJson(res, 200, {
            appId,
            name: common.name || null,
            clienticon,
            icon: common.icon || null,
            // Preferir `icon` (.jpg público). clienticon.jpg costuma 404 na CDN.
            image: common.icon
                ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/${common.icon}.jpg`
                : `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/${clienticon}.jpg`,
            ico: clienticon
                ? `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/${clienticon}.ico`
                : null,
            fallback: false,
        });
    } catch (err) {
        sendJson(res, 200, { error: err.message, fallback: true });
    }
}

const server = http.createServer((req, res) => {
    if (req.url.startsWith("/api/steam-progress")) {
        return serveProgress(req, res);
    }
    if (req.url.startsWith("/api/steam-search")) {
        return serveSteamSearch(req, res);
    }
    if (req.url.startsWith("/api/steam-achievements")) {
        return serveSteamAchievements(req, res);
    }
    if (req.url.startsWith("/api/steam-dlc-groups")) {
        return serveSteamDlcGroups(req, res);
    }
    if (req.url.startsWith("/api/steam-clienticon")) {
        return serveSteamClientIcon(req, res);
    }
    if (req.url.startsWith("/api/backup")) {
        return serveBackupSave(req, res);
    }
    return serveStatic(req, res);
});

function startServer(attempt = 0) {
    killPort(PORT);

    const onError = (err) => {
        server.off("error", onError);
        if (err && err.code === "EADDRINUSE" && attempt < 5) {
            console.warn(`Porta ${PORT} ocupada, liberando e tentando de novo…`);
            killPort(PORT);
            setTimeout(() => startServer(attempt + 1), 350);
            return;
        }
        console.error(err);
        process.exit(1);
    };

    server.once("error", onError);
    server.listen(PORT, () => {
        server.off("error", onError);
        ensureBackupsDir();
        const url = `http://localhost:${PORT}/`;
        console.log(`Guia de Conquistas rodando em ${url}`);
        console.log(`Backups em: ${BACKUPS_DIR}`);
        if (isWatchMode) {
            console.log("Watch ativo: alterações em tools/ reiniciam o servidor.");
        } else {
            console.log("Deixe esta janela aberta enquanto usa o app (Ctrl+C para encerrar).");
        }

        // No watch, não abrir o browser a cada restart
        if (process.platform === "win32" && !isWatchMode) {
            exec(`start "" "${url}"`);
        }
    });
}

startServer();