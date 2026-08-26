// ======================================
// GUIA DE CONQUISTAS - SOULMASK
// Versão 2.2
// ======================================

// ==============================
// Ícones (SVG inline, sem dependência externa)
// ==============================

const ICON = {
    edit: '<i class="ph-duotone ph-pencil-simple" aria-hidden="true"></i>',
    trash: '<i class="ph-duotone ph-trash" aria-hidden="true"></i>',
    check: '<i class="ph-duotone ph-check-circle" aria-hidden="true"></i>',
    circle: '<i class="ph-duotone ph-circle" aria-hidden="true"></i>',
    folder: '<i class="ph-duotone ph-folder-simple" aria-hidden="true"></i>',
    award: '<i class="ph-duotone ph-trophy" aria-hidden="true"></i>',
    platinum: '<i class="ph-bold ph-trophy" aria-hidden="true"></i>',
    refresh: '<i class="ph-duotone ph-arrows-clockwise" aria-hidden="true"></i>',
    checkQuiet: '<i class="ph-bold ph-check" aria-hidden="true"></i>',
    warningQuiet: '<i class="ph-bold ph-warning" aria-hidden="true"></i>',
    hand: '<i class="ph-duotone ph-hand" aria-hidden="true"></i>',
    play: '<i class="ph-duotone ph-play-circle" aria-hidden="true"></i>',
    book: '<i class="ph-duotone ph-book-open" aria-hidden="true"></i>',
    note: '<i class="ph-duotone ph-note" aria-hidden="true"></i>',
    archive: '<i class="ph-duotone ph-archive" aria-hidden="true"></i>',
    unarchive: '<i class="ph-duotone ph-arrow-counter-clockwise" aria-hidden="true"></i>',
    funnel: '<i class="ph-duotone ph-funnel" aria-hidden="true"></i>',
    dotOnline: '<span class="statusDot online"></span>',
    dotOffline: '<span class="statusDot offline"></span>',
};

// ==============================
// Banco de Dados & Estado
// ==============================

let achievements = [];
let currentFilter = "all";
let currentView = "flat"; // "flat" | "grouped" | "dlc" | "level" | "reqLevel"

const GROUP_BY_LABELS = {
    flat: "Lista",
    grouped: "Grupos",
    dlc: "DLC",
    level: "Dificuldade",
    reqLevel: "Nível",
};

/** Filtros combináveis (Sets vazios = sem restrição). */
const facetFilters = {
    difficulties: new Set(), // easy|medium|hard|none
    reqLevels: new Set(), // "10"|"15–50"|"none"
    dlcs: new Set(), // nome DLC ou "Jogo base"
};

const DIFFICULTY_META = {
    easy: { label: "Fácil", section: "Fácil", order: 2 },
    medium: { label: "Médio", section: "Médio", order: 3 },
    hard: { label: "Difícil", section: "Difícil", order: 4 },
};

function normalizeDifficulty(value) {
    const v = String(value || "")
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    if (!v) return "";
    if (v === "easy" || v === "facil") return "easy";
    if (v === "medium" || v === "medio") return "medium";
    if (v === "hard" || v === "dificil") return "hard";
    // Labels da IA: "Fácil", "Médio-Difícil", "facil/medio", etc.
    if (v.includes("dificil") || v.includes("hard")) return "hard";
    if (v.includes("medio") || v.includes("medium")) return "medium";
    if (v.includes("facil") || v.includes("easy")) return "easy";
    return "";
}

function difficultyLabel(value) {
    const key = normalizeDifficulty(value);
    return key ? DIFFICULTY_META[key].label : "";
}

/** Nível recomendado do jogo: "20" ou "15–50". */
function normalizeReqLevel(value) {
    if (value == null || value === "") return "";
    if (Array.isArray(value) && value.length >= 2) {
        return `${Number(value[0])}–${Number(value[1])}`;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(Math.round(value));
    }
    const s = String(value).trim().replace(/^Nv\.?\s*/i, "");
    const range = s.match(/^(\d+)\s*[–\-]\s*(\d+)$/);
    if (range) return `${range[1]}–${range[2]}`;
    const n = s.match(/^(\d+)/);
    return n ? n[1] : "";
}

function formatReqLevelLabel(value) {
    const v = normalizeReqLevel(value);
    return v ? `Nv. ${v}` : "";
}

function parseReqLevelFromTips(tips) {
    const m = String(tips || "").match(/^Nv\.\s*(\d+(?:\s*[–\-]\s*\d+)?)/i);
    return m ? normalizeReqLevel(m[1]) : "";
}

function resolveReqLevel(item) {
    return normalizeReqLevel(item?.reqLevel) || parseReqLevelFromTips(item?.tips);
}

/** Ícone hexagonal estilo Linear para dificuldade / perdível. */
function difficultyIcon(value) {
    const key = normalizeDifficulty(value);
    if (key === "easy") {
        // traço curto — leve, sem parecer "concluído"
        return `<svg class="diffHex is-easy" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path class="diffHexShape" d="M8 1.4 13.6 4.6v6.8L8 14.6 2.4 11.4V4.6L8 1.4Z"/><path class="diffHexMark" d="M5.6 8h4.8" fill="none" stroke-linecap="round"/></svg>`;
    }
    if (key === "medium") {
        return `<svg class="diffHex is-medium" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path class="diffHexShape" d="M8 1.4 13.6 4.6v6.8L8 14.6 2.4 11.4V4.6L8 1.4Z"/><circle class="diffHexMark" cx="8" cy="8" r="2.1" fill="none"/></svg>`;
    }
    if (key === "hard") {
        // ponto sólido — peso/alerta, sem parecer "cancelado"
        return `<svg class="diffHex is-hard" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path class="diffHexShape" d="M8 1.4 13.6 4.6v6.8L8 14.6 2.4 11.4V4.6L8 1.4Z"/><circle class="diffHexMark is-fill" cx="8" cy="8" r="1.7"/></svg>`;
    }
    return "";
}

function missableIcon() {
    return `<svg class="diffHex is-missable" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path class="diffHexShape" d="M8 1.4 13.6 4.6v6.8L8 14.6 2.4 11.4V4.6L8 1.4Z"/><path class="diffHexMark" d="M8 5.2v3.2M8 10.8h.01" fill="none" stroke-linecap="round"/></svg>`;
}

function levelSectionKey(item) {
    if (item?.missable) return "Perdíveis";
    const key = normalizeDifficulty(item?.difficulty);
    if (key) return DIFFICULTY_META[key].section;
    return "Sem dificuldade";
}

function reqLevelSectionKey(item) {
    const req = resolveReqLevel(item);
    return req ? formatReqLevelLabel(req) : "Sem nível";
}

function reqLevelSectionSort(a, b) {
    if (a === "Sem nível") return 1;
    if (b === "Sem nível") return -1;
    const na = Number(String(a).match(/(\d+)/)?.[1] || 9998);
    const nb = Number(String(b).match(/(\d+)/)?.[1] || 9998);
    if (na !== nb) return na - nb;
    return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

/** Busca por nível: "20", "nv 20", "nível 50", "15-50". */
function matchesReqLevelSearch(item, text) {
    const req = resolveReqLevel(item);
    if (!req) return false;
    const label = formatReqLevelLabel(req).toLowerCase();
    const compact = req.toLowerCase().replace("–", "-");
    const q = String(text || "").toLowerCase().trim();
    if (!q) return false;
    if (label.includes(q) || compact.includes(q) || req.toLowerCase().includes(q)) {
        return true;
    }
    const tagged = q.match(/^(?:nv\.?|nvl|nivel|nível)\s*(\d+(?:\s*[–\-]\s*\d+)?)$/i);
    if (tagged) return normalizeReqLevel(tagged[1]) === normalizeReqLevel(req);
    if (/^\d+$/.test(q)) {
        const parts = req.split("–");
        return parts[0] === q || parts[1] === q || req === q;
    }
    return false;
}
const COLLAPSED_SECTIONS_KEY = "guia-collapsed-sections";
let collapsedSections = loadCollapsedSections();

function loadCollapsedSections() {
    try {
        const raw = JSON.parse(localStorage.getItem(COLLAPSED_SECTIONS_KEY) || "{}");
        return raw && typeof raw === "object" ? raw : {};
    } catch {
        return {};
    }
}

function saveCollapsedSections() {
    localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify(collapsedSections));
}

function sectionCollapseKey(sectionName) {
    return `${activeGameAppId || "none"}::${currentView}::${sectionName}`;
}
let editingId = null;
let pastedImage = "";
let games = [];
let activeGameAppId = null;
let gameSearchTimer = null;
let lastSteamAchievements = null; // { [apiName]: { completed, unlockedAt, iconHash, ... } }
let pendingManualItem = null;

const DEFAULT_GAME = {
    appId: "2646460",
    name: "Soulmask",
    // `icon` da Steam (jpg público). clienticon .jpg costuma 404.
    clienticon: "a6e8a3962f1110deb848aeb979e306c6416972fd",
    image: "https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/2646460/a6e8a3962f1110deb848aeb979e306c6416972fd.jpg",
    links: [
        {
            id: "soulmask-map",
            label: "Mapa interativo",
            url: "https://gamingwithdaopa.ellatha.com/soulmask/map/",
        },
    ],
};

const GAMES_KEY = "gamesList";
const ACTIVE_GAME_KEY = "activeGameAppId";
const LEGACY_ACHIEVEMENTS_KEY = "achievements";
const STEAM_CLIENTICON_URL = "/api/steam-clienticon";

function escapeAttr(value) {
    return String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function setTooltip(el, text, pos) {
    if (!el) return;
    const value = (text || "").trim();
    if (!value) {
        el.removeAttribute("data-tooltip");
        el.removeAttribute("data-tooltip-pos");
        el.removeAttribute("title");
        return;
    }
    el.setAttribute("data-tooltip", value);
    if (pos) el.setAttribute("data-tooltip-pos", pos);
    else el.removeAttribute("data-tooltip-pos");
    el.removeAttribute("title");
}

// ==============================
// Popover de dicas (substitui tooltip longo)
// ==============================

let tipsPopoverEl = null;
let tipsPopoverAnchor = null;

function ensureTipsPopover() {
    if (tipsPopoverEl) return tipsPopoverEl;
    tipsPopoverEl = document.createElement("div");
    tipsPopoverEl.className = "tipsPopover hidden";
    tipsPopoverEl.setAttribute("role", "dialog");
    tipsPopoverEl.innerHTML = `
        <div class="tipsPopoverHead">
            <span class="tipsPopoverLabel"><i class="ph-duotone ph-note" aria-hidden="true"></i> Dica</span>
            <button type="button" class="tipsPopoverClose" aria-label="Fechar">
                <i class="ph-bold ph-x" aria-hidden="true"></i>
            </button>
        </div>
        <p class="tipsPopoverTitle"></p>
        <p class="tipsPopoverText"></p>
    `;
    document.body.appendChild(tipsPopoverEl);

    tipsPopoverEl.querySelector(".tipsPopoverClose")?.addEventListener("click", (e) => {
        e.stopPropagation();
        closeTipsPopover();
    });

    document.addEventListener("click", (e) => {
        if (!tipsPopoverEl || tipsPopoverEl.classList.contains("hidden")) return;
        if (tipsPopoverEl.contains(e.target)) return;
        if (e.target.closest("button.helpTip")) return;
        closeTipsPopover();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeTipsPopover();
    });

    window.addEventListener(
        "scroll",
        () => {
            if (tipsPopoverAnchor && tipsPopoverEl && !tipsPopoverEl.classList.contains("hidden")) {
                positionTipsPopover(tipsPopoverAnchor);
            }
        },
        true
    );

    window.addEventListener("resize", () => closeTipsPopover());
    return tipsPopoverEl;
}

function closeTipsPopover() {
    if (!tipsPopoverEl) return;
    tipsPopoverEl.classList.add("hidden");
    if (tipsPopoverAnchor) {
        tipsPopoverAnchor.setAttribute("aria-expanded", "false");
        tipsPopoverAnchor.classList.remove("isOpen");
    }
    tipsPopoverAnchor = null;
}

function positionTipsPopover(anchor) {
    if (!tipsPopoverEl || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const pop = tipsPopoverEl;
    pop.style.visibility = "hidden";
    pop.classList.remove("hidden");
    const popW = pop.offsetWidth;
    const popH = pop.offsetHeight;
    const gap = 10;
    const pad = 10;

    let top = rect.top - popH - gap;
    let place = "top";
    if (top < pad) {
        top = rect.bottom + gap;
        place = "bottom";
    }
    if (top + popH > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - popH - pad);
    }

    let left = rect.left + rect.width / 2 - popW / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - popW - pad));

    pop.style.top = `${Math.round(top)}px`;
    pop.style.left = `${Math.round(left)}px`;
    pop.dataset.place = place;
    pop.style.visibility = "";
}

function toggleTipsPopover(anchor, tips, title) {
    const pop = ensureTipsPopover();
    if (tipsPopoverAnchor === anchor && !pop.classList.contains("hidden")) {
        closeTipsPopover();
        return;
    }

    if (tipsPopoverAnchor && tipsPopoverAnchor !== anchor) {
        tipsPopoverAnchor.setAttribute("aria-expanded", "false");
        tipsPopoverAnchor.classList.remove("isOpen");
    }

    tipsPopoverAnchor = anchor;
    anchor.setAttribute("aria-expanded", "true");
    anchor.classList.add("isOpen");

    const titleEl = pop.querySelector(".tipsPopoverTitle");
    const textEl = pop.querySelector(".tipsPopoverText");
    if (titleEl) {
        titleEl.textContent = title || "";
        titleEl.classList.toggle("hidden", !title);
    }
    if (textEl) textEl.textContent = String(tips || "").trim();

    positionTipsPopover(anchor);
}

function achievementsKey(appId) {
    return `achievements_${appId}`;
}

function isSteamAppIconUrl(url) {
    return /\/steamcommunity\/public\/images\/apps\/\d+\/[a-f0-9]+\.(jpg|png|ico)/i.test(url || "");
}

function gameImageCandidates(game) {
    const appId = game.appId;
    const list = [];
    if (game.image) list.push(game.image);
    if (game.clienticon) {
        list.push(`https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/${game.clienticon}.jpg`);
        list.push(`https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/${appId}/${game.clienticon}.jpg`);
    }
    if (game.icon) {
        list.push(`https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${appId}/${game.icon}.jpg`);
    }
    list.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_184x69.jpg`);
    list.push(`https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`);
    return [...new Set(list.filter(Boolean))];
}

/** Capas da Store (alta resolução) — para cards grandes, não para o seletor. */
function gameCoverCandidates(game) {
    const appId = game?.appId;
    if (!appId) return gameImageCandidates(game || {});
    const list = [
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
        `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_616x353.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_616x353.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/capsule_231x87.jpg`,
    ];
    return [...new Set([...list, ...gameImageCandidates(game)])];
}

function gameImageUrl(game) {
    return gameImageCandidates(game)[0];
}

async function resolveClientIcon(game) {
    if (!game?.appId) return game;
    if (game.icon || (game.image && isSteamAppIconUrl(game.image) && !/404/.test(game.image))) {
        // Ainda assim atualiza se não tiver hash de icon
        if (game.icon && game.image) return game;
    }

    try {
        const res = await fetch(`${STEAM_CLIENTICON_URL}?appId=${encodeURIComponent(game.appId)}`, {
            cache: "no-store",
        });
        const data = await res.json();
        if (data.icon) game.icon = data.icon;
        if (data.clienticon) game.clienticon = data.clienticon;
        if (data.image) game.image = data.image;
    } catch {
        // Sem servidor local: mantém a imagem atual
    }
    return game;
}

function setGameIcon(imgEl, fallbackEl, game, { preferCover = false, persist = true } = {}) {
    if (!imgEl || !fallbackEl) return;

    const initials = gameInitials(game.name);
    fallbackEl.textContent = initials;
    fallbackEl.hidden = false;
    imgEl.hidden = true;
    imgEl.removeAttribute("src");

    const candidates = preferCover ? gameCoverCandidates(game) : gameImageCandidates(game);
    let index = 0;

    const tryNext = () => {
        if (index >= candidates.length) {
            imgEl.hidden = true;
            fallbackEl.hidden = false;
            return;
        }
        const url = candidates[index++];
        const probe = new Image();
        probe.onload = () => {
            imgEl.src = url;
            imgEl.alt = game.name || "";
            imgEl.hidden = false;
            fallbackEl.hidden = true;
            // Persiste só ícones pequenos do seletor — capa HD não deve sobrescrever
            if (persist && !preferCover && game.image !== url) {
                game.image = url;
                saveGames();
            }
        };
        probe.onerror = tryNext;
        probe.src = url;
    };

    tryNext();
}

function gameInitials(name) {
    return (name || "??")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
}

// ==============================
// Elementos DOM
// ==============================

const achievementList = document.getElementById("achievementList");
const search = document.getElementById("search");
const modal = document.getElementById("modal");
const newAchievement = document.getElementById("newAchievement");
const cancel = document.getElementById("cancel");
const modalClose = document.getElementById("modalClose");
const modalModeLabel = document.getElementById("modalModeLabel");
const saveAchievement = document.getElementById("saveAchievement");
const deleteAchievementBtn = document.getElementById("deleteAchievementBtn");
const title = document.getElementById("title");
const groupInput = document.getElementById("group");
const groupList = document.getElementById("groupList");
const description = document.getElementById("description");
const videoUrlInput = document.getElementById("videoUrl");
const guideUrlInput = document.getElementById("guideUrl");
const tipsInput = document.getElementById("tips");
const reqLevelInput = document.getElementById("reqLevel");
const difficultyInput = document.getElementById("difficulty");
const missableInput = document.getElementById("missable");
const difficultySeg = document.querySelector(".diffSeg");

function setDifficultyUI(value) {
    const next = normalizeDifficulty(value);
    if (difficultyInput) difficultyInput.value = next;
    if (!difficultySeg) return;
    difficultySeg.querySelectorAll(".diffSegBtn").forEach((btn) => {
        const active = String(btn.dataset.diff || "") === next;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
}

if (difficultySeg) {
    difficultySeg.querySelectorAll("[data-diff-icon]").forEach((slot) => {
        slot.innerHTML = difficultyIcon(slot.getAttribute("data-diff-icon"));
    });
    difficultySeg.addEventListener("click", (event) => {
        const btn = event.target.closest(".diffSegBtn");
        if (!btn || !difficultySeg.contains(btn)) return;
        setDifficultyUI(btn.dataset.diff || "");
    });
}
const pasteArea = document.getElementById("pasteArea");
const groupByWrap = document.getElementById("groupByWrap");
const groupByTrigger = document.getElementById("groupByTrigger");
const groupByMenu = document.getElementById("groupByMenu");
const groupByValue = document.getElementById("groupByValue");
const filtersWrap = document.getElementById("filtersWrap");
const filtersTrigger = document.getElementById("filtersTrigger");
const filtersPanel = document.getElementById("filtersPanel");
const filtersCount = document.getElementById("filtersCount");
const filtersClearBtn = document.getElementById("filtersClearBtn");
const filterDifficultyChips = document.getElementById("filterDifficultyChips");
const filterReqLevelChips = document.getElementById("filterReqLevelChips");
const filterDlcChips = document.getElementById("filterDlcChips");
const syncStatusEl = document.getElementById("syncStatus");
const syncNowBtn = document.getElementById("syncNow");
const toastContainer = document.getElementById("toastContainer");
const confirmManualModal = document.getElementById("confirmManualModal");
const confirmManualCancel = document.getElementById("confirmManualCancel");
const confirmManualOk = document.getElementById("confirmManualOk");
const confirmManualTitle = document.getElementById("confirmManualTitle");
const confirmManualGroup = document.getElementById("confirmManualGroup");
const confirmManualIcon = document.getElementById("confirmManualIcon");
const videoPlayerModal = document.getElementById("videoPlayerModal");
const videoPlayerClose = document.getElementById("videoPlayerClose");
const videoPlayerTitle = document.getElementById("videoPlayerTitle");
const videoPlayerFrame = document.getElementById("videoPlayerFrame");
const videoPlayerOpenExternal = document.getElementById("videoPlayerOpenExternal");
const confirmDeleteGameModal = document.getElementById("confirmDeleteGameModal");
const confirmDeleteGameCancel = document.getElementById("confirmDeleteGameCancel");
const confirmDeleteGameOk = document.getElementById("confirmDeleteGameOk");
const confirmDeleteGameTitle = document.getElementById("confirmDeleteGameTitle");
const confirmDeleteGameAppId = document.getElementById("confirmDeleteGameAppId");
const confirmDeleteGameIcon = document.getElementById("confirmDeleteGameIcon");
const confirmDeleteGameFallback = document.getElementById("confirmDeleteGameFallback");
const confirmDeleteGameNote = document.getElementById("confirmDeleteGameNote");
const confirmDeleteGameCodeEl = document.getElementById("confirmDeleteGameCode");
const confirmDeleteGameCodeInput = document.getElementById("confirmDeleteGameCodeInput");
const confirmDeleteGameCodeHint = document.getElementById("confirmDeleteGameCodeHint");
let pendingDeleteGameAppId = null;
let pendingDeleteGameCode = "";
const gameSwitcher = document.getElementById("gameSwitcher");
const gameSwitcherTrigger = document.getElementById("gameSwitcherTrigger");
const gameSwitcherMenu = document.getElementById("gameSwitcherMenu");
const gameSearchInput = document.getElementById("gameSearchInput");
const gameLibraryList = document.getElementById("gameLibraryList");
const gameLibraryLabel = document.getElementById("gameLibraryLabel");
const gameSearchResults = document.getElementById("gameSearchResults");
const gameSearchLabel = document.getElementById("gameSearchLabel");
const gameSwitcherHint = document.getElementById("gameSwitcherHint");
const openArchivedGamesBtn = document.getElementById("openArchivedGames");
const archivedCountEl = document.getElementById("archivedCount");
const guideView = document.getElementById("guideView");
const archivedView = document.getElementById("archivedView");
const archivedGamesGrid = document.getElementById("archivedGamesGrid");
const archivedBackBtn = document.getElementById("archivedBackBtn");
const archivedSearch = document.getElementById("archivedSearch");
const archivedPageSubtitle = document.getElementById("archivedPageSubtitle");
const manageLinksModal = document.getElementById("manageLinksModal");
const manageLinksClose = document.getElementById("manageLinksClose");
const manageLinksSubtitle = document.getElementById("manageLinksSubtitle");
const gameLinksList = document.getElementById("gameLinksList");
const gameLinksAddBtn = document.getElementById("gameLinksAddBtn");
const gameLinksForm = document.getElementById("gameLinksForm");
const gameLinkLabelInput = document.getElementById("gameLinkLabelInput");
const gameLinkUrlInput = document.getElementById("gameLinkUrlInput");
const gameLinksFormCancel = document.getElementById("gameLinksFormCancel");
const gameLinksTrigger = document.getElementById("gameLinksTrigger");
const gameLinksHeaderMenu = document.getElementById("gameLinksHeaderMenu");
const activeGameIcon = document.getElementById("activeGameIcon");
const activeGameIconFallback = document.getElementById("activeGameIconFallback");
const activeGameName = document.getElementById("activeGameName");

const STEAM_SYNC_URL = "/api/steam-progress";
const STEAM_SEARCH_URL = "/api/steam-search";
const STEAM_SYNC_INTERVAL_MS = 20000;

// Elementos do Backup
const exportGuideBtn = document.getElementById("exportGuideBtn");
const importGuideBtn = document.getElementById("importGuideBtn");
const importGuideFile = document.getElementById("importGuideFile");
const exportProfileBtn = document.getElementById("exportProfileBtn");
const importProfileBtn = document.getElementById("importProfileBtn");
const importProfileFile = document.getElementById("importProfileFile");

// Contadores na Sidebar
const countAll = document.getElementById("countAll");
const countCompleted = document.getElementById("countCompleted");
const countPending = document.getElementById("countPending");

// ==============================
// Inicialização
// ==============================

init();

function init() {
    loadGames();
    loadAchievements();
    validateAchievements();
    saveAchievements();
    bindEvents();
    bindGameSwitcherEvents();
    renderActiveGame();
    renderGameLibrary();
    renderAchievements();
    refreshGameIcons();
    refreshDlcGroupsFromSteam();

    // Sincronização automática com o progresso real da Steam (via tools/server.js).
    // Se o app foi aberto direto do index.html (sem servidor), isso falha
    // silenciosamente e o app continua funcionando normalmente.
    bootstrapSoulmaskFresh()
        .then(() => {
            syncWithSteam();
            setInterval(syncWithSteam, STEAM_SYNC_INTERVAL_MS);
            window.addEventListener("focus", syncWithSteam);
        })
        .catch(() => {
            applyBundledSoulmaskGuide();
            syncWithSteam();
            setInterval(syncWithSteam, STEAM_SYNC_INTERVAL_MS);
            window.addEventListener("focus", syncWithSteam);
        });
}

/** Limpa o app inteiro uma vez (jogos, conquistas, flags) e recomeça só com Soulmask. */
async function bootstrapSoulmaskFresh() {
    const resetFlag = "app-full-reset-v6";
    if (localStorage.getItem(resetFlag) === "1") {
        await applyBundledSoulmaskGuide();
        return;
    }

    // Apaga TODO o localStorage do app
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(resetFlag, "1");

    // Estado em memória: só Soulmask limpo
    games = [{ ...DEFAULT_GAME, links: [] }];
    activeGameAppId = DEFAULT_GAME.appId;
    achievements = [];
    collapsedSections = {};
    editingId = null;
    saveGames();
    saveAchievements();
    renderActiveGame();
    renderGameLibrary();
    renderAchievements();

    await importSteamAchievements(DEFAULT_GAME.appId, {
        force: true,
        quiet: true,
        wipeGuide: true,
    });
    await applyBundledSoulmaskGuide({ force: true });
    renderActiveGame();
    renderGameLibrary();
    renderAchievements();
}

// ==============================
// Sincronização automática com a Steam
// ==============================

async function syncWithSteam({ manual = false, silentToasts = false } = {}) {
    if (!activeGameAppId) {
        resetSyncButton();
        return;
    }

    if (manual && syncNowBtn) {
        syncNowBtn.disabled = true;
        syncNowBtn.classList.add("isSyncing");
        const label = syncNowBtn.querySelector(".syncBtnLabel");
        if (label) label.textContent = "Sync";
    }

    let data;
    try {
        const res = await fetch(
            `${STEAM_SYNC_URL}?appId=${encodeURIComponent(activeGameAppId)}`,
            { cache: "no-store" }
        );
        data = await res.json();
    } catch {
        // Sem servidor local rodando (app aberto direto do arquivo).
        if (syncStatusEl) {
            if (manual) {
                syncStatusEl.classList.remove("hidden");
                syncStatusEl.classList.add("offline");
                syncStatusEl.classList.remove("isFresh");
                syncStatusEl.innerHTML = `${ICON.warningQuiet} Sem servidor`;
            } else {
                syncStatusEl.classList.add("hidden");
            }
        }
        resetSyncButton();
        return;
    }

    if (data.error) {
        lastSteamAchievements = null;
        if (syncStatusEl) {
            if (manual) {
                syncStatusEl.classList.remove("hidden");
                syncStatusEl.classList.add("offline");
                syncStatusEl.classList.remove("isFresh");
                const short = /abra o jogo/i.test(data.error)
                    ? "Abra o jogo na Steam"
                    : "Sem cache Steam";
                syncStatusEl.innerHTML = `${ICON.warningQuiet} ${short}`;
                setTooltip(syncStatusEl, data.error, "left");
            } else {
                syncStatusEl.classList.add("hidden");
            }
        }
        resetSyncButton();
        return;
    }

    lastSteamAchievements = data.achievements || null;

    // Mapa auxiliar por hash do ícone: cobre o caso de itens importados sem apiName.
    const byIconHash = {};
    Object.entries(data.achievements || {}).forEach(([apiName, info]) => {
        if (info.iconHash) byIconHash[info.iconHash] = { apiName, ...info };
    });

    function extractIconHash(icon) {
        const m = /([a-f0-9]{40})/i.exec(icon || "");
        return m ? m[1] : null;
    }

    const newlyUnlocked = [];
    let changed = false;
    let backfilled = false;
    let revoked = 0;

    achievements.forEach((item) => {
        let info = item.apiName ? data.achievements[item.apiName] : null;

        if (!info) {
            const hash = extractIconHash(item.icon);
            const match = hash ? byIconHash[hash] : null;
            if (match) {
                item.apiName = match.apiName;
                backfilled = true;
                info = match;
            }
        }

        if (!info) return;

        if (info.completed) {
            if (!item.completed) {
                item.completed = true;
                item.unlockedAt = info.unlockedAt;
                item.completedManual = false;
                changed = true;
                newlyUnlocked.push(item);
            } else {
                if (item.completedManual) {
                    item.completedManual = false;
                    changed = true;
                }
                if (info.unlockedAt && item.unlockedAt !== info.unlockedAt) {
                    item.unlockedAt = info.unlockedAt;
                    backfilled = true;
                }
            }
            return;
        }

        if (item.completed && !item.completedManual) {
            item.completed = false;
            item.unlockedAt = null;
            changed = true;
            revoked += 1;
        }
    });

    if (changed || backfilled) {
        saveAchievements();
    }
    if (changed) {
        renderAchievements();
        if (!silentToasts) newlyUnlocked.forEach(showUnlockToast);
    }

    if (syncStatusEl) {
        syncStatusEl.classList.remove("hidden", "offline");
        const now = new Date().toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
        });
        if (newlyUnlocked.length > 0) {
            syncStatusEl.classList.add("isFresh");
            syncStatusEl.innerHTML = `${ICON.checkQuiet} ${newlyUnlocked.length} nova(s) · ${now}`;
        } else if (revoked > 0) {
            syncStatusEl.classList.remove("isFresh");
            syncStatusEl.innerHTML = `${ICON.checkQuiet} Corrigido · ${now}`;
        } else {
            syncStatusEl.classList.remove("isFresh");
            syncStatusEl.innerHTML = `${ICON.checkQuiet} Atualizado · ${now}`;
        }
        setTooltip(syncStatusEl, "", "left");
    }

    resetSyncButton();
}

function extractIconHashFromUrl(icon) {
    const m = /([a-f0-9]{40})/i.exec(icon || "");
    return m ? m[1] : null;
}

function getSteamInfoForItem(item) {
    if (!lastSteamAchievements) return null;
    if (item.apiName && lastSteamAchievements[item.apiName]) {
        return lastSteamAchievements[item.apiName];
    }
    const hash = extractIconHashFromUrl(item.icon);
    if (!hash) return null;
    return Object.values(lastSteamAchievements).find(info => info.iconHash === hash) || null;
}

function openConfirmManualModal(item) {
    pendingManualItem = item;
    if (confirmManualTitle) {
        confirmManualTitle.textContent = item.title || "Conquista sem título";
    }
    if (confirmManualGroup) {
        confirmManualGroup.textContent = item.group || "Sem Grupo";
    }
    if (confirmManualIcon) {
        confirmManualIcon.src = getAchievementIcon(item.icon);
        confirmManualIcon.alt = item.title || "";
        confirmManualIcon.onerror = () => {
            confirmManualIcon.src = "assets/logo.png";
        };
    }
    if (confirmManualModal) confirmManualModal.classList.remove("hidden");
}

function closeConfirmManualModal() {
    pendingManualItem = null;
    if (confirmManualModal) confirmManualModal.classList.add("hidden");
}

function confirmManualCompletion() {
    if (!pendingManualItem) {
        closeConfirmManualModal();
        return;
    }
    const item = pendingManualItem;
    item.completed = true;
    item.completedManual = true;
    item.unlockedAt = null;
    closeConfirmManualModal();
    saveAchievements();
    renderAchievements();
}

function markAchievementCompleted(item, { manual = false } = {}) {
    item.completed = true;
    item.completedManual = Boolean(manual);
    if (!manual) {
        const steam = getSteamInfoForItem(item);
        item.unlockedAt = steam?.unlockedAt || item.unlockedAt || null;
    } else {
        item.unlockedAt = null;
    }
    saveAchievements();
    renderAchievements();
}

function markAchievementIncomplete(item) {
    item.completed = false;
    item.completedManual = false;
    item.unlockedAt = null;
    saveAchievements();
    renderAchievements();
}

function resetSyncButton() {
    if (!syncNowBtn) return;
    syncNowBtn.disabled = false;
    syncNowBtn.classList.remove("isSyncing");
    const label = syncNowBtn.querySelector(".syncBtnLabel");
    if (label) label.textContent = "Sync";
}

const unlockToastQueue = [];
let unlockToastsVisible = 0;
const UNLOCK_TOAST_MAX = 3;
const UNLOCK_TOAST_LIFE_MS = 3400;
const IMPORT_TOAST_LIFE_MS = 5200;
const importingAppIds = new Set();

function showUnlockToast(item) {
    if (!toastContainer || !item) return;
    unlockToastQueue.push({
        item,
        headline: "Conquista desbloqueada!",
    });
    pumpUnlockToasts();
}

function showImportAchievementToasts(items, gameName) {
    if (!toastContainer || !Array.isArray(items) || items.length === 0) return;

    // Limpa toasts antigos (evita resumo duplicado de import paralelo / cache)
    toastContainer.innerHTML = "";
    unlockToastQueue.length = 0;
    unlockToastsVisible = 0;

    const batch = document.createElement("div");
    batch.className = "toastImportBatch";
    batch.setAttribute("role", "status");

    const summary = document.createElement("div");
    summary.className = "toast toastSummary";
    summary.innerHTML = `
        <div class="toastBody">
            <div class="toastTitle">${ICON.award} Conquistas importadas</div>
            <div class="toastName">${items.length} de ${escapeHtml(gameName || "jogo")}</div>
        </div>
    `;
    batch.appendChild(summary);

    const frag = document.createDocumentFragment();
    for (const item of items) {
        const toast = document.createElement("div");
        toast.className = "toast toastImportItem";
        let iconSrc = "";
        try {
            iconSrc = getAchievementIcon(item && item.icon);
        } catch {
            iconSrc = getAchievementIcon("");
        }
        toast.innerHTML = `
            <img src="${escapeHtml(iconSrc)}" alt="" loading="lazy">
            <div class="toastBody">
                <div class="toastTitle">${ICON.award} Conquista importada</div>
                <div class="toastName">${escapeHtml((item && item.title) || "Conquista")}</div>
            </div>
        `;
        frag.appendChild(toast);
    }
    batch.appendChild(frag);
    toastContainer.appendChild(batch);

    const life = Math.min(
        16000,
        IMPORT_TOAST_LIFE_MS + Math.max(0, items.length - 1) * 120
    );
    setTimeout(() => {
        batch.classList.add("isLeaving");
        const finish = () => {
            if (batch.parentNode) batch.remove();
        };
        batch.addEventListener("animationend", finish, { once: true });
        setTimeout(finish, 400);
    }, life);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function pumpUnlockToasts() {
    while (unlockToastsVisible < UNLOCK_TOAST_MAX && unlockToastQueue.length > 0) {
        const entry = unlockToastQueue.shift();
        renderUnlockToast(entry);
    }
}

function renderUnlockToast(entry) {
    const item = entry?.item || entry;
    const headline = entry?.headline || "Conquista desbloqueada!";
    unlockToastsVisible += 1;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
        <img src="${getAchievementIcon(item.icon)}" alt="">
        <div class="toastBody">
            <div class="toastTitle">${ICON.award} ${headline}</div>
            <div class="toastName">${escapeHtml(item.title || "Conquista")}</div>
        </div>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("toastOut");
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            toast.remove();
            unlockToastsVisible = Math.max(0, unlockToastsVisible - 1);
            pumpUnlockToasts();
        };
        toast.addEventListener("animationend", finish, { once: true });
        setTimeout(finish, 350);
    }, UNLOCK_TOAST_LIFE_MS);
}

// ==============================
// Eventos
// ==============================

function bindEvents() {
    if (newAchievement) newAchievement.onclick = openModal;
    if (cancel) cancel.onclick = closeModal;
    if (modalClose) modalClose.onclick = closeModal;
    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }
    if (saveAchievement) saveAchievement.onclick = saveCurrentAchievement;
    if (deleteAchievementBtn) {
        deleteAchievementBtn.onclick = () => {
            if (editingId == null) return;
            deleteAchievement(editingId);
        };
    }
    if (confirmManualCancel) confirmManualCancel.onclick = closeConfirmManualModal;
    if (confirmManualOk) confirmManualOk.onclick = confirmManualCompletion;
    if (confirmManualModal) {
        confirmManualModal.addEventListener("click", (e) => {
            if (e.target === confirmManualModal) closeConfirmManualModal();
        });
    }
    if (videoPlayerClose) videoPlayerClose.onclick = closeVideoPlayerModal;
    if (videoPlayerModal) {
        videoPlayerModal.addEventListener("click", (e) => {
            if (e.target === videoPlayerModal) closeVideoPlayerModal();
        });
    }
    if (confirmDeleteGameCancel) confirmDeleteGameCancel.onclick = closeConfirmDeleteGameModal;
    if (confirmDeleteGameOk) confirmDeleteGameOk.onclick = confirmDeleteGame;
    if (confirmDeleteGameModal) {
        confirmDeleteGameModal.addEventListener("click", (e) => {
            if (e.target === confirmDeleteGameModal) closeConfirmDeleteGameModal();
        });
    }
    if (confirmDeleteGameCodeInput) {
        confirmDeleteGameCodeInput.addEventListener("input", () => {
            confirmDeleteGameCodeInput.value = confirmDeleteGameCodeInput.value
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
            syncDeleteConfirmCodeState();
        });
        confirmDeleteGameCodeInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (confirmDeleteGameOk && !confirmDeleteGameOk.disabled) {
                    confirmDeleteGame();
                }
            }
        });
    }
    
    if (search) {
        search.addEventListener("input", renderAchievements);
    }

    if (pasteArea) {
        pasteArea.addEventListener("click", () => {
            pasteArea.focus();
        });
    }

    document.addEventListener("paste", pasteImage);

    // Filtros da Sidebar
    document.querySelectorAll("[data-filter]").forEach(button => {
        button.addEventListener("click", () => {
            document
                .querySelectorAll("[data-filter]")
                .forEach(item => item.classList.remove("active"));

            button.classList.add("active");
            currentFilter = button.dataset.filter;
            renderAchievements();
        });
    });

    // Backup
    if (exportGuideBtn) {
        exportGuideBtn.onclick = () => {
            setHeaderLinksMenuOpen(false);
            exportGameGuide();
        };
    }
    if (importGuideBtn && importGuideFile) {
        importGuideBtn.onclick = () => {
            setHeaderLinksMenuOpen(false);
            importGuideFile.click();
        };
        importGuideFile.onchange = (e) => importGameGuide(e.target.files[0]);
    }
    if (exportProfileBtn) {
        exportProfileBtn.onclick = () => exportUserProfile();
    }
    if (importProfileBtn && importProfileFile) {
        importProfileBtn.onclick = () => importProfileFile.click();
        importProfileFile.onchange = (e) => importUserProfile(e.target.files[0]);
    }

    // Sincronizar agora
    if (syncNowBtn) {
        syncNowBtn.onclick = () => syncWithSteam({ manual: true });
    }

    setupListControls();
}

const STEAM_DLC_GROUPS_URL = "/api/steam-dlc-groups";

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

/** Une aliases da mesma DLC: "Shifting Sands" + "Soulmask: Shifting Sands" → o nome mais completo. */
function canonicalizeDlcNames(list, preferredLabels = []) {
    const items = Array.isArray(list) ? list : [];
    const labels = new Set(
        preferredLabels.map(cleanDlcLabel).filter((n) => n && n !== "Jogo base")
    );
    for (const item of items) {
        const name = cleanDlcLabel(item.dlc);
        if (name && name !== "Jogo base" && name !== "Sem Grupo") labels.add(name);
        const fromDesc = extractDlcName(item.description);
        if (fromDesc) labels.add(fromDesc);
    }

    const sorted = [...labels].sort((a, b) => b.length - a.length || a.localeCompare(b, "pt-BR"));
    const aliasToCanonical = new Map();

    for (const label of sorted) {
        const lower = label.toLowerCase();
        let canonical = label;
        for (const candidate of sorted) {
            if (candidate === label) continue;
            const c = candidate.toLowerCase();
            // "Shifting Sands" ⊆ "Soulmask: Shifting Sands"
            if (c.includes(lower) && candidate.length > label.length) {
                canonical = candidate;
                break;
            }
        }
        aliasToCanonical.set(lower, canonical);
    }

    for (const item of items) {
        const current = cleanDlcLabel(item.dlc);
        if (!current || current === "Jogo base" || current === "Sem Grupo") continue;
        const canonical = aliasToCanonical.get(current.toLowerCase());
        if (canonical) item.dlc = canonical;
    }
    return items;
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

function assignDlcFields(list, apiNameToDlc = null, { force = false } = {}) {
    const items = Array.isArray(list) ? list : [];
    const map =
        apiNameToDlc instanceof Map
            ? apiNameToDlc
            : apiNameToDlc
              ? new Map(Object.entries(apiNameToDlc))
              : new Map();
    const preferredLabels = [...new Set(map.values())];

    for (const item of items) {
        const apiName = item.apiName ? String(item.apiName) : "";
        const fromGroups = apiName ? map.get(apiName) : null;
        const fromDesc = extractDlcName(item.description);
        const fromDescResolved = fromDesc
            ? matchPreferredDlcLabel(fromDesc, preferredLabels) || fromDesc
            : null;

        if (fromGroups) {
            item.dlc = fromGroups;
            continue;
        }
        if (fromDescResolved) {
            item.dlc = fromDescResolved;
            continue;
        }
        if (force) {
            item.dlc = "Jogo base";
            continue;
        }

        const current = String(item.dlc || "").trim();
        if (current && current !== "Jogo base" && current !== "Sem Grupo") {
            continue;
        }
        item.dlc = "Jogo base";
    }

    canonicalizeDlcNames(items, preferredLabels);
    return items;
}

function shortDlcLabel(name) {
    const raw = String(name || "").trim();
    if (!raw) return "";
    return raw.replace(/^Soulmask:\s*/i, "").trim() || raw;
}

function resolveAchievementDlc(item) {
    if (!item) return "Jogo base";
    const fromField = cleanDlcLabel(item.dlc);
    if (fromField && fromField !== "Sem Grupo" && fromField !== "Jogo base") {
        return fromField;
    }
    return extractDlcName(item.description) || "Jogo base";
}

/** Aplica o guia de platina embutido do Soulmask (grupos + dicas + links). */
async function applyBundledSoulmaskGuide({ force = false } = {}) {
    if (String(activeGameAppId) !== "2646460") return;
    if (!achievements.length) return;

    const flagKey = "soulmask-guia-platina-applied-v9";
    const already = localStorage.getItem(flagKey) === "1";
    // v5: primeira aplicação sempre força (zera curadoria antiga)
    const forceApply = force || !already;

    if (!forceApply) {
        const ungrouped = achievements.filter(
            (a) => !a.group || a.group === "Sem Grupo"
        ).length;
        const noGuide = achievements.filter(
            (a) => !String(a.tips || "").trim() && !String(a.guideUrl || "").trim()
        ).length;
        if (ungrouped < achievements.length * 0.5 && noGuide < achievements.length * 0.5) {
            return;
        }
    }

    try {
        const res = await fetch("/config/soulmask-guia-platina.json", {
            cache: "no-store",
        });
        if (!res.ok) return;
        const pack = await res.json();
        if (!pack || pack.type !== GUIDE_PACK_TYPE || !Array.isArray(pack.achievements)) {
            return;
        }

        const game = getActiveGame();
        if (game) {
            if (forceApply) replaceGameLinksFromPack(game, pack.game?.links || []);
            else mergeGameLinksFromPack(game, pack.game?.links || []);
        }

        let updated = 0;
        for (const overlay of pack.achievements) {
            const target = findGuideMatch(achievements, overlay);
            if (!target) continue;
            if (applyGuideOverlay(target, overlay, { force: forceApply })) updated += 1;
        }

        if (updated > 0 || forceApply) {
            validateAchievements();
            saveAchievements();
            saveGames();
            renderActiveGame();
            renderAchievements();
        }
        localStorage.setItem(flagKey, "1");
    } catch {
        // sem servidor / arquivo ausente
    }
}

/** Reaplica grupos DLC da curadoria SteamDB/SteamHunters (via servidor local). */
async function refreshDlcGroupsFromSteam() {
    if (!activeGameAppId || !achievements.length) return;
    try {
        const res = await fetch(
            `${STEAM_DLC_GROUPS_URL}?appId=${encodeURIComponent(activeGameAppId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const byApiName = data?.byApiName || {};
        if (!byApiName || typeof byApiName !== "object") return;

        const before = achievements.map((a) => a.dlc).join("\0");
        // force: sobrescreve heurísticas antigas; só mantém Requires DLC + grupos oficiais
        assignDlcFields(achievements, byApiName, { force: true });
        const after = achievements.map((a) => a.dlc).join("\0");
        if (before !== after) {
            saveAchievements();
            renderAchievements();
        }
    } catch {
        // Sem servidor local, mantém Requires DLC / valor já salvo.
    }
}

// ==============================
// Modal
// ==============================

function openModal() {
    editingId = null;
    clearForm();
    updateGroupSuggestions();
    if (modalModeLabel) modalModeLabel.textContent = "Nova conquista";
    modal.classList.remove("hidden");
    if (saveAchievement) saveAchievement.textContent = "Salvar";
    if (deleteAchievementBtn) deleteAchievementBtn.classList.add("hidden");
    title?.focus();
}

function closeModal() {
    modal.classList.add("hidden");
    clearForm();
    editingId = null;
    if (deleteAchievementBtn) deleteAchievementBtn.classList.add("hidden");
}

function resetPasteArea() {
    if (!pasteArea) return;
    pasteArea.innerHTML = `
        <span class="drawerIconPlaceholder">
            <i class="ph-duotone ph-image" aria-hidden="true"></i>
        </span>
    `;
}

function renderPastePreview(src) {
    if (!pasteArea) return;
    pasteArea.innerHTML = `<img src="${src}" alt="">`;
}

function clearForm() {
    title.value = "";
    if (groupInput) groupInput.value = "";
    description.value = "";
    if (videoUrlInput) videoUrlInput.value = "";
    if (guideUrlInput) guideUrlInput.value = "";
    if (tipsInput) tipsInput.value = "";
    if (reqLevelInput) reqLevelInput.value = "";
    setDifficultyUI("");
    if (missableInput) missableInput.checked = false;
    pastedImage = "";
    resetPasteArea();
}

function normalizeExternalUrl(value) {
    const raw = (value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
}

/** ID de um vídeo YouTube único (não busca/playlist/canal). */
function getYoutubeVideoId(url) {
    try {
        const u = new URL(normalizeExternalUrl(url));
        const host = u.hostname.replace(/^www\./i, "").toLowerCase();
        if (host === "youtu.be") {
            const id = u.pathname.split("/").filter(Boolean)[0] || "";
            return /^[\w-]{11}$/.test(id) ? id : null;
        }
        if (
            host === "youtube.com" ||
            host === "m.youtube.com" ||
            host === "music.youtube.com" ||
            host === "youtube-nocookie.com"
        ) {
            if (u.pathname === "/watch" || u.pathname === "/watch/") {
                const id = u.searchParams.get("v") || "";
                return /^[\w-]{11}$/.test(id) ? id : null;
            }
            const m = u.pathname.match(/^\/(embed|shorts|live)\/([\w-]{11})(?:\/|$)/i);
            return m ? m[2] : null;
        }
    } catch (_) {
        /* ignore */
    }
    return null;
}

function getVimeoVideoId(url) {
    try {
        const u = new URL(normalizeExternalUrl(url));
        const host = u.hostname.replace(/^www\./i, "").toLowerCase();
        if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
        const parts = u.pathname.split("/").filter(Boolean);
        if (host === "player.vimeo.com" && parts[0] === "video" && /^\d+$/.test(parts[1] || "")) {
            return parts[1];
        }
        if (/^\d+$/.test(parts[0] || "")) return parts[0];
    } catch (_) {
        /* ignore */
    }
    return null;
}

/** Busca, playlist ou canal — vários vídeos: abre fora do app. */
function isVideoBrowseUrl(url) {
    try {
        const u = new URL(normalizeExternalUrl(url));
        const host = u.hostname.replace(/^www\./i, "").toLowerCase();
        if (!host.includes("youtube") && host !== "youtu.be" && !host.includes("vimeo")) {
            return false;
        }
        const path = u.pathname.toLowerCase();
        if (
            path.startsWith("/results") ||
            path.startsWith("/playlist") ||
            path.startsWith("/channel/") ||
            path.startsWith("/c/") ||
            path.startsWith("/user/") ||
            path.startsWith("/@") ||
            path.startsWith("/feed") ||
            path.startsWith("/hashtag/")
        ) {
            return true;
        }
        if (u.searchParams.has("search_query") || u.searchParams.has("q")) return true;
    } catch (_) {
        /* ignore */
    }
    return false;
}

/**
 * @returns {{ mode: 'embed'|'external', url: string, embedUrl?: string } | null}
 */
function resolveVideoAction(url) {
    const openUrl = normalizeExternalUrl(url);
    if (!openUrl) return null;
    if (isVideoBrowseUrl(openUrl)) {
        return { mode: "external", url: openUrl };
    }
    const yt = getYoutubeVideoId(openUrl);
    if (yt) {
        return {
            mode: "embed",
            url: openUrl,
            embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0`,
        };
    }
    const vimeo = getVimeoVideoId(openUrl);
    if (vimeo) {
        return {
            mode: "embed",
            url: openUrl,
            embedUrl: `https://player.vimeo.com/video/${vimeo}?autoplay=1`,
        };
    }
    return { mode: "external", url: openUrl };
}

function openAchievementVideo(url, title) {
    const action = resolveVideoAction(url);
    if (!action) return;
    if (action.mode === "external") {
        window.open(action.url, "_blank", "noopener,noreferrer");
        return;
    }
    openVideoPlayerModal(action, title);
}

function openVideoPlayerModal(action, title) {
    if (!videoPlayerModal || !videoPlayerFrame) return;
    if (videoPlayerTitle) {
        videoPlayerTitle.textContent = String(title || "Assistir").trim() || "Assistir";
    }
    if (videoPlayerOpenExternal) {
        videoPlayerOpenExternal.href = action.url;
    }
    videoPlayerFrame.src = action.embedUrl || "";
    videoPlayerModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeVideoPlayerModal() {
    if (!videoPlayerModal) return;
    videoPlayerModal.classList.add("hidden");
    if (videoPlayerFrame) videoPlayerFrame.src = "";
    // Mantém scroll travado se o drawer de conquista estiver aberto
    if (!modal || modal.classList.contains("hidden")) {
        document.body.style.overflow = "";
    }
}

// Preenche o datalist com os grupos já usados, para autocompletar
function updateGroupSuggestions() {
    if (!groupList) return;
    const groups = [...new Set(achievements.map(a => a.group).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
    groupList.innerHTML = groups
        .map(g => `<option value="${g}"></option>`)
        .join("");
}

// ==============================
// Colar Imagem
// ==============================

function pasteImage(event) {
    if (modal.classList.contains("hidden")) {
        return;
    }

    const items = event.clipboardData.items;

    for (const item of items) {
        if (!item.type.startsWith("image")) {
            continue;
        }

        const file = item.getAsFile();
        const reader = new FileReader();

        reader.onload = function(e) {
            pastedImage = e.target.result;
            renderPastePreview(pastedImage);
        };

        reader.readAsDataURL(file);
    }
}

// ==============================
// LocalStorage
// ==============================

function saveAchievements() {
    if (!activeGameAppId) return;
    localStorage.setItem(
        achievementsKey(activeGameAppId),
        JSON.stringify(achievements)
    );
}

function loadAchievements() {
    if (!activeGameAppId) {
        achievements = [];
        return;
    }

    const data = localStorage.getItem(achievementsKey(activeGameAppId));
    if (data) {
        try {
            achievements = JSON.parse(data);
            return;
        } catch {
            achievements = [];
            return;
        }
    }

    achievements = [];
}

// ==============================
// Seletor de jogos (Steam)
// ==============================

function loadGames() {
    try {
        games = JSON.parse(localStorage.getItem(GAMES_KEY) || "[]");
    } catch {
        games = [];
    }

    if (!Array.isArray(games) || games.length === 0) {
        games = [{ ...DEFAULT_GAME }];
        localStorage.setItem(GAMES_KEY, JSON.stringify(games));
    } else {
        let changed = false;
        games = games.map((g) => {
            let next = { ...g };

            // Soulmask: corrige icon 404 antigo + mapa padrão
            if (next.appId === DEFAULT_GAME.appId) {
                const brokenClientIcon =
                    next.clienticon === "05ae5035124b03ce93caf38afa4e3b35d7b2b455" ||
                    /05ae5035124b03ce93caf38afa4e3b35d7b2b455/.test(next.image || "");
                if (brokenClientIcon || !next.icon) {
                    next = {
                        ...next,
                        icon: DEFAULT_GAME.clienticon,
                        clienticon: DEFAULT_GAME.clienticon,
                        image: DEFAULT_GAME.image,
                    };
                    changed = true;
                }
            }

            const normalized = normalizeGameLinks(next);
            if (normalized.changed) {
                next = normalized.game;
                changed = true;
            }

            const nextImage = gameImageUrl(next);
            if (next.image !== nextImage) {
                next.image = nextImage;
                changed = true;
            }
            return next;
        });
        if (changed) localStorage.setItem(GAMES_KEY, JSON.stringify(games));
    }

    // Migra conquistas antigas (chave única) para o Soulmask
    const legacy = localStorage.getItem(LEGACY_ACHIEVEMENTS_KEY);
    const soulKey = achievementsKey(DEFAULT_GAME.appId);
    if (legacy && !localStorage.getItem(soulKey)) {
        localStorage.setItem(soulKey, legacy);
    }

    activeGameAppId = localStorage.getItem(ACTIVE_GAME_KEY) || games[0].appId;
    if (!games.some((g) => g.appId === activeGameAppId)) {
        activeGameAppId = games[0].appId;
    }
    localStorage.setItem(ACTIVE_GAME_KEY, activeGameAppId);
}

async function refreshGameIcons() {
    let changed = false;
    for (const game of games) {
        const before = JSON.stringify({
            image: game.image,
            icon: game.icon,
            clienticon: game.clienticon,
        });
        await resolveClientIcon(game);
        const after = JSON.stringify({
            image: game.image,
            icon: game.icon,
            clienticon: game.clienticon,
        });
        if (before !== after) changed = true;
    }
    if (changed) saveGames();
    renderActiveGame();
    renderGameLibrary();
}

function saveGames() {
    localStorage.setItem(GAMES_KEY, JSON.stringify(games));
    localStorage.setItem(ACTIVE_GAME_KEY, activeGameAppId);
}

function getActiveGame() {
    return games.find((g) => g.appId === activeGameAppId) || games[0] || DEFAULT_GAME;
}

function newLinkId() {
    return `link_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeGameLinks(game) {
    let changed = false;
    let next = { ...game };
    let links = Array.isArray(next.links) ? [...next.links] : [];

    if (typeof next.mapUrl === "string" && next.mapUrl.trim()) {
        const mapUrl = next.mapUrl.trim();
        const already = links.some((l) => String(l?.url || "").trim() === mapUrl);
        if (!already) {
            links.unshift({
                id: newLinkId(),
                label: "Mapa interativo",
                url: mapUrl,
            });
            changed = true;
        }
        delete next.mapUrl;
        changed = true;
    }

    if (
        next.appId === DEFAULT_GAME.appId &&
        links.length === 0 &&
        Array.isArray(DEFAULT_GAME.links)
    ) {
        links = DEFAULT_GAME.links.map((l) => ({ ...l, id: l.id || newLinkId() }));
        changed = true;
    }

    const cleaned = links
        .filter((l) => l && String(l.url || "").trim())
        .map((l) => ({
            id: String(l.id || newLinkId()),
            label: String(l.label || "Link").trim() || "Link",
            url: String(l.url || "").trim(),
        }));

    if (JSON.stringify(cleaned) !== JSON.stringify(next.links || [])) {
        next.links = cleaned;
        changed = true;
    } else {
        next.links = cleaned;
    }

    return { game: next, changed };
}

function getGameLinks(game = getActiveGame()) {
    if (!game) return [];
    const { game: normalized } = normalizeGameLinks(game);
    return Array.isArray(normalized.links) ? normalized.links : [];
}


function setGameLinksFormOpen(open) {
    if (!gameLinksForm) return;
    gameLinksForm.classList.toggle("hidden", !open);
    if (gameLinksAddBtn) gameLinksAddBtn.classList.toggle("hidden", open);
    if (open) {
        if (gameLinkLabelInput) gameLinkLabelInput.value = "";
        if (gameLinkUrlInput) gameLinkUrlInput.value = "";
        setTimeout(() => gameLinkLabelInput?.focus(), 0);
    }
}

function setHeaderLinksMenuOpen(open) {
    if (!gameLinksHeaderMenu || !gameLinksTrigger) return;
    gameLinksHeaderMenu.classList.toggle("hidden", !open);
    gameLinksTrigger.setAttribute("aria-expanded", open ? "true" : "false");
}

function openManageLinksModal() {
    setHeaderLinksMenuOpen(false);
    setGameMenuOpen(false);
    const game = getActiveGame();
    if (manageLinksSubtitle) {
        manageLinksSubtitle.textContent = game?.name || "Jogo";
    }
    renderGameLinks();
    setGameLinksFormOpen(false);
    if (manageLinksModal) manageLinksModal.classList.remove("hidden");
}

function closeManageLinksModal() {
    setGameLinksFormOpen(false);
    if (manageLinksModal) manageLinksModal.classList.add("hidden");
}

function renderGameLinks() {
    if (!gameLinksList) return;
    const links = getGameLinks();
    gameLinksList.innerHTML = "";

    if (links.length === 0) {
        const empty = document.createElement("p");
        empty.className = "gameLinksEmpty";
        empty.textContent = "Nenhum link ainda. Adicione mapa, wiki, guia ou qualquer URL útil.";
        gameLinksList.appendChild(empty);
        return;
    }

    links.forEach((link) => {
        const row = document.createElement("div");
        row.className = "gameLinkRow";

        const open = document.createElement("a");
        open.className = "gameLinkOpen";
        open.href = link.url;
        open.target = "_blank";
        open.rel = "noopener noreferrer";
        open.title = link.url;
        open.innerHTML = `<i class="ph-duotone ph-link-simple" aria-hidden="true"></i><span>${escapeHtml(link.label)}</span>`;
        open.addEventListener("click", (e) => e.stopPropagation());

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "gameLinkRemove";
        remove.title = "Remover link";
        remove.setAttribute("aria-label", `Remover ${link.label}`);
        remove.innerHTML = '<i class="ph-bold ph-x" aria-hidden="true"></i>';
        remove.addEventListener("click", (e) => {
            e.stopPropagation();
            removeGameLink(link.id);
        });

        row.append(open, remove);
        gameLinksList.appendChild(row);
    });
}

function renderHeaderLinksMenu() {
    if (!gameLinksHeaderMenu || !gameLinksTrigger) return;
    const links = getGameLinks();
    const game = getActiveGame();
    gameLinksHeaderMenu.innerHTML = "";

    gameLinksTrigger.classList.toggle("isEmpty", links.length === 0);
    setTooltip(
        gameLinksTrigger,
        links.length
            ? `Links de ${game?.name || "jogo"}`
            : "Adicione links úteis no seletor de jogos",
        "bottom"
    );

    if (links.length === 0) {
        const empty = document.createElement("p");
        empty.className = "gameLinksHeaderEmpty";
        empty.textContent = "Nenhum link neste jogo.";
        gameLinksHeaderMenu.appendChild(empty);
    } else {
        links.forEach((link) => {
            const item = document.createElement("a");
            item.className = "gameLinksHeaderItem";
            item.href = link.url;
            item.target = "_blank";
            item.rel = "noopener noreferrer";
            item.setAttribute("role", "menuitem");
            item.innerHTML = `<i class="ph-duotone ph-arrow-square-out" aria-hidden="true"></i><span>${escapeHtml(link.label)}</span>`;
            item.addEventListener("click", () => setHeaderLinksMenuOpen(false));
            gameLinksHeaderMenu.appendChild(item);
        });
    }

    const manageWrap = document.createElement("div");
    manageWrap.className = "gameLinksHeaderManage";
    const manage = document.createElement("button");
    manage.type = "button";
    manage.className = "gameLinksHeaderItem";
    manage.setAttribute("role", "menuitem");
    manage.innerHTML = `<i class="ph-duotone ph-gear-six" aria-hidden="true"></i><span>Gerenciar links</span>`;
    manage.addEventListener("click", () => openManageLinksModal());
    manageWrap.appendChild(manage);
    gameLinksHeaderMenu.appendChild(manageWrap);
}

function addGameLink(label, url) {
    const game = getActiveGame();
    if (!game) return false;
    const cleanUrl = String(url || "").trim();
    const cleanLabel = String(label || "").trim() || "Link";
    if (!cleanUrl) return false;
    if (!/^https?:\/\//i.test(cleanUrl)) return false;

    const links = getGameLinks(game);
    links.push({ id: newLinkId(), label: cleanLabel, url: cleanUrl });
    game.links = links;
    delete game.mapUrl;
    saveGames();
    renderGameLinks();
    renderHeaderLinksMenu();
    return true;
}

function removeGameLink(linkId) {
    const game = getActiveGame();
    if (!game) return;
    game.links = getGameLinks(game).filter((l) => l.id !== linkId);
    delete game.mapUrl;
    saveGames();
    renderGameLinks();
    renderHeaderLinksMenu();
}

function renderActiveGame() {
    const game = getActiveGame();
    if (activeGameName) activeGameName.textContent = game.name;
    setGameIcon(activeGameIcon, activeGameIconFallback, game);
    document.title = `Guia de Conquistas - ${game.name}`;
    renderGameLinks();
    renderHeaderLinksMenu();
    setGameLinksFormOpen(false);
    setHeaderLinksMenuOpen(false);
}

function gameMatchesQuery(game, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
        String(game.name || "").toLowerCase().includes(q) ||
        String(game.appId || "").includes(q)
    );
}

function setGameArchived(appId, archived) {
    const game = games.find((g) => g.appId === String(appId));
    if (!game) return;

    game.archived = Boolean(archived);
    saveGames();

    if (game.archived && game.appId === activeGameAppId) {
        const next = games.find((g) => !g.archived && g.appId !== game.appId);
        if (next) {
            selectGame(next.appId);
            renderArchivedPage();
            return;
        }
    }

    renderGameLibrary();
    renderArchivedPage();
}

function removeGame(appId) {
    const id = String(appId);
    const game = games.find((g) => g.appId === id);
    if (!game) return;
    openConfirmDeleteGameModal(game);
}

function generateDeleteConfirmCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i += 1) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
}

function loadDeleteModalCover(game) {
    if (!confirmDeleteGameIcon || !confirmDeleteGameFallback) return;

    const initials = gameInitials(game.name);
    confirmDeleteGameFallback.textContent = initials;
    confirmDeleteGameFallback.hidden = false;
    confirmDeleteGameIcon.hidden = true;
    confirmDeleteGameIcon.removeAttribute("src");

    // Header nativo da Store (proporção correta 460×215)
    const candidates = [
        `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appId}/header.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/header.jpg`,
        `https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/header.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/capsule_616x353.jpg`,
        `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/capsule_231x87.jpg`,
    ];
    let index = 0;

    const tryNext = () => {
        if (index >= candidates.length) {
            confirmDeleteGameIcon.hidden = true;
            confirmDeleteGameFallback.hidden = false;
            return;
        }
        const url = candidates[index++];
        const probe = new Image();
        probe.onload = () => {
            confirmDeleteGameIcon.src = url;
            confirmDeleteGameIcon.alt = game.name || "";
            confirmDeleteGameIcon.hidden = false;
            confirmDeleteGameFallback.hidden = true;
        };
        probe.onerror = tryNext;
        probe.src = url;
    };

    tryNext();
}

function syncDeleteConfirmCodeState() {
    if (!confirmDeleteGameOk) return;
    const typed = (confirmDeleteGameCodeInput?.value || "").trim().toUpperCase();
    const match = Boolean(pendingDeleteGameCode) && typed === pendingDeleteGameCode;
    confirmDeleteGameOk.disabled = !match;
    if (confirmDeleteGameCodeHint) {
        const showError =
            typed.length > 0 && !match && typed.length >= pendingDeleteGameCode.length;
        confirmDeleteGameCodeHint.classList.toggle("hidden", !showError);
    }
}

function openConfirmDeleteGameModal(game) {
    pendingDeleteGameAppId = String(game.appId);
    pendingDeleteGameCode = generateDeleteConfirmCode();

    if (confirmDeleteGameTitle) {
        confirmDeleteGameTitle.textContent = game.name || "Jogo";
    }
    const confirmDeleteGameAppIdValue = document.getElementById("confirmDeleteGameAppIdValue");
    if (confirmDeleteGameAppIdValue) {
        confirmDeleteGameAppIdValue.textContent = String(game.appId || "—");
    }
    if (confirmDeleteGameNote) {
        confirmDeleteGameNote.textContent =
            "Esta ação é permanente. As conquistas importadas deste jogo serão apagadas.";
    }
    if (confirmDeleteGameCodeEl) {
        confirmDeleteGameCodeEl.textContent = pendingDeleteGameCode;
    }
    if (confirmDeleteGameCodeInput) {
        confirmDeleteGameCodeInput.value = "";
    }
    if (confirmDeleteGameCodeHint) {
        confirmDeleteGameCodeHint.classList.add("hidden");
    }
    if (confirmDeleteGameOk) confirmDeleteGameOk.disabled = true;

    loadDeleteModalCover(game);

    if (confirmDeleteGameModal) confirmDeleteGameModal.classList.remove("hidden");
    setGameMenuOpen(false);
}

function closeConfirmDeleteGameModal() {
    pendingDeleteGameAppId = null;
    pendingDeleteGameCode = "";
    if (confirmDeleteGameCodeInput) confirmDeleteGameCodeInput.value = "";
    if (confirmDeleteGameOk) confirmDeleteGameOk.disabled = true;
    if (confirmDeleteGameCodeHint) confirmDeleteGameCodeHint.classList.add("hidden");
    if (confirmDeleteGameModal) confirmDeleteGameModal.classList.add("hidden");
}

function confirmDeleteGame() {
    const id = pendingDeleteGameAppId;
    const typed = (confirmDeleteGameCodeInput?.value || "").trim().toUpperCase();
    if (!id || !pendingDeleteGameCode || typed !== pendingDeleteGameCode) {
        if (confirmDeleteGameCodeHint) confirmDeleteGameCodeHint.classList.remove("hidden");
        confirmDeleteGameCodeInput?.focus();
        return;
    }

    const wasActive = activeGameAppId === id;
    games = games.filter((g) => g.appId !== id);
    try {
        localStorage.removeItem(achievementsKey(id));
    } catch {
        // ignore
    }

    if (games.length === 0) {
        games = [{ ...DEFAULT_GAME }];
    }

    closeConfirmDeleteGameModal();

    if (wasActive) {
        const next = games.find((g) => !g.archived) || games[0];
        activeGameAppId = null;
        saveGames();
        selectGame(next.appId);
    } else {
        saveGames();
        renderGameLibrary();
        renderArchivedPage();
    }
}

function createGameLibraryItem(game) {
    const row = document.createElement("div");
    row.className =
        "gameSwitcherItemRow" + (game.appId === activeGameAppId ? " isActive" : "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gameSwitcherItem";
    btn.setAttribute("role", "option");

    const img = document.createElement("img");
    img.alt = "";
    img.hidden = true;

    const fallback = document.createElement("span");
    fallback.className = "gameSwitcherIconFallback";
    fallback.hidden = false;
    fallback.textContent = gameInitials(game.name);

    const name = document.createElement("span");
    name.className = "gameSwitcherItemName";
    name.textContent = game.name;
    name.title = game.name;

    const meta = document.createElement("span");
    meta.className = "gameSwitcherItemMeta";
    meta.textContent = game.appId;

    const text = document.createElement("span");
    text.className = "gameSwitcherItemText";
    text.append(name, meta);

    btn.append(img, fallback, text);
    btn.addEventListener("click", () => selectGame(game.appId));

    const actions = document.createElement("div");
    actions.className = "gameSwitcherItemActions";

    const archiveBtn = document.createElement("button");
    archiveBtn.type = "button";
    archiveBtn.className = "gameSwitcherArchiveBtn";
    archiveBtn.title = "Arquivar";
    archiveBtn.setAttribute("aria-label", "Arquivar");
    archiveBtn.innerHTML = ICON.archive;
    archiveBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        setGameArchived(game.appId, true);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "gameSwitcherDeleteBtn";
    deleteBtn.title = "Remover da lista";
    deleteBtn.setAttribute("aria-label", "Remover da lista");
    deleteBtn.innerHTML = ICON.trash;
    deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeGame(game.appId);
    });

    actions.append(archiveBtn, deleteBtn);
    row.append(btn, actions);
    setGameIcon(img, fallback, game);
    return row;
}

function renderGameLibrary() {
    if (!gameLibraryList) return;

    const query = (gameSearchInput?.value || "").trim();
    const searching = query.length >= 2;

    const activeGames = games.filter((g) => !g.archived);
    const archivedCount = games.filter((g) => g.archived).length;
    const visibleActive = activeGames.filter((g) => gameMatchesQuery(g, query));

    gameLibraryList.innerHTML = "";
    visibleActive.forEach((game) => {
        gameLibraryList.appendChild(createGameLibraryItem(game));
    });

    if (gameLibraryLabel) {
        const emptySearch = searching && visibleActive.length === 0;
        gameLibraryLabel.classList.toggle("hidden", emptySearch);
        gameLibraryLabel.textContent = searching
            ? `Na biblioteca (${visibleActive.length})`
            : "Seus jogos";
    }
    gameLibraryList.classList.toggle("hidden", searching && visibleActive.length === 0);

    if (archivedCountEl) archivedCountEl.textContent = String(archivedCount);
    if (openArchivedGamesBtn) {
        openArchivedGamesBtn.classList.toggle("isEmpty", archivedCount === 0);
        openArchivedGamesBtn.hidden = false;
    }
}

function getGameAchievementStats(appId) {
    try {
        const raw = localStorage.getItem(achievementsKey(appId));
        const list = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(list) || list.length === 0) {
            return { total: 0, completed: 0, platinum: false };
        }
        const completed = list.filter((a) => a && a.completed).length;
        const total = list.length;
        return {
            total,
            completed,
            platinum: completed === total,
        };
    } catch {
        return { total: 0, completed: 0, platinum: false };
    }
}

function isArchivedPageOpen() {
    return archivedView && !archivedView.classList.contains("hidden");
}

function openArchivedPage() {
    setGameMenuOpen(false);
    if (guideView) guideView.classList.add("hidden");
    if (archivedView) archivedView.classList.remove("hidden");
    if (archivedSearch) archivedSearch.value = "";
    renderArchivedPage();
    if (archivedSearch) setTimeout(() => archivedSearch.focus(), 0);
}

function closeArchivedPage() {
    if (archivedView) archivedView.classList.add("hidden");
    if (guideView) guideView.classList.remove("hidden");
}

function renderArchivedPage() {
    if (!archivedGamesGrid) return;

    const query = (archivedSearch?.value || "").trim();
    const archivedGames = games
        .filter((g) => g.archived)
        .filter((g) => gameMatchesQuery(g, query))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));

    const totalArchived = games.filter((g) => g.archived).length;
    if (archivedCountEl) archivedCountEl.textContent = String(totalArchived);
    if (openArchivedGamesBtn) {
        openArchivedGamesBtn.classList.toggle("isEmpty", totalArchived === 0);
    }
    if (archivedPageSubtitle) {
        archivedPageSubtitle.textContent =
            totalArchived === 0
                ? "nenhum"
                : query
                  ? `${archivedGames.length} de ${totalArchived}`
                  : `${totalArchived} jogos`;
    }

    if (!isArchivedPageOpen()) return;

    archivedGamesGrid.innerHTML = "";

    if (totalArchived === 0) {
        archivedGamesGrid.innerHTML = `
            <div class="archivedEmpty">
                <div class="empty-icon" aria-hidden="true">${ICON.archive}</div>
                <p>Nenhum jogo arquivado</p>
                <span>Use o ícone de arquivo na lista de jogos para arquivar.</span>
            </div>
        `;
        return;
    }

    if (archivedGames.length === 0) {
        archivedGamesGrid.innerHTML = `
            <div class="archivedEmpty">
                <p>Nenhum resultado para “${escapeHtml(query)}”</p>
            </div>
        `;
        return;
    }

    archivedGames.forEach((game) => {
        const stats = getGameAchievementStats(game.appId);
        const card = document.createElement("article");
        card.className =
            "archivedGameCard" + (stats.platinum ? " isPlatinum" : "");

        const img = document.createElement("img");
        img.alt = "";
        img.hidden = true;
        img.loading = "lazy";
        img.decoding = "async";

        const fallback = document.createElement("span");
        fallback.className = "archivedGameFallback";
        fallback.textContent = gameInitials(game.name);

        const progressLabel =
            stats.total === 0
                ? "Sem conquistas salvas"
                : stats.platinum
                  ? "Platinado"
                  : `${stats.completed}/${stats.total} conquistas`;

        const body = document.createElement("div");
        body.className = "archivedGameBody";
        body.innerHTML = `
            <div class="archivedGameTitleRow">
                <h2 class="archivedGameName">${escapeHtml(game.name || "Jogo")}</h2>
                ${
                    stats.platinum
                        ? `<span class="archivedPlatinumBadge" title="Todas as conquistas concluídas">${ICON.platinum}<span>Platinado</span></span>`
                        : ""
                }
            </div>
            <p class="archivedGameMeta">
                <span>AppID ${escapeHtml(game.appId)}</span>
                ${
                    stats.platinum
                        ? ""
                        : `<span class="archivedGameMetaSep" aria-hidden="true">·</span>
                <span class="archivedGameProgress">${escapeHtml(progressLabel)}</span>`
                }
                ${
                    stats.platinum
                        ? `<span class="archivedGameMetaSep" aria-hidden="true">·</span>
                <span class="archivedGameProgress isPlatinum">${stats.completed}/${stats.total} conquistas</span>`
                        : ""
                }
            </p>
            ${
                stats.total > 0
                    ? `<div class="archivedProgressTrack" aria-hidden="true"><span class="archivedProgressFill" style="width:${Math.round((stats.completed / stats.total) * 100)}%"></span></div>`
                    : ""
            }
        `;

        const actions = document.createElement("div");
        actions.className = "archivedGameActions";

        const restoreBtn = document.createElement("button");
        restoreBtn.type = "button";
        restoreBtn.className = "archivedActionBtn archivedActionBtn--ghost";
        restoreBtn.title = "Desarquivar";
        restoreBtn.setAttribute("aria-label", "Desarquivar");
        restoreBtn.innerHTML = ICON.unarchive;
        restoreBtn.addEventListener("click", () => {
            setGameArchived(game.appId, false);
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "archivedActionBtn archivedActionBtn--danger";
        deleteBtn.title = "Remover da lista";
        deleteBtn.setAttribute("aria-label", "Remover da lista");
        deleteBtn.innerHTML = ICON.trash;
        deleteBtn.addEventListener("click", () => {
            removeGame(game.appId);
        });

        const openBtn = document.createElement("button");
        openBtn.type = "button";
        openBtn.className = "archivedActionBtn archivedActionBtn--primary";
        openBtn.title = "Abrir no guia";
        openBtn.innerHTML = `<span>Abrir</span><i class="ph-bold ph-arrow-right" aria-hidden="true"></i>`;
        openBtn.addEventListener("click", () => {
            selectGame(game.appId);
            closeArchivedPage();
        });

        actions.append(restoreBtn, deleteBtn, openBtn);

        const media = document.createElement("div");
        media.className = "archivedGameMedia";
        media.append(img, fallback);
        if (stats.platinum) {
            const shine = document.createElement("span");
            shine.className = "archivedPlatinumShine";
            shine.setAttribute("aria-hidden", "true");
            media.appendChild(shine);
        }

        card.append(media, body, actions);
        archivedGamesGrid.appendChild(card);
        setGameIcon(img, fallback, game, { preferCover: true, persist: false });
    });
}

function setGameMenuOpen(open) {
    if (!gameSwitcherMenu || !gameSwitcherTrigger) return;
    gameSwitcherMenu.classList.toggle("hidden", !open);
    gameSwitcherTrigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && gameSearchInput) {
        gameSearchInput.value = "";
        clearGameSearchResults();
        renderGameLibrary();
        setTimeout(() => gameSearchInput.focus(), 0);
    }
}

function clearGameSearchResults() {
    if (gameSearchResults) gameSearchResults.innerHTML = "";
    if (gameSearchLabel) gameSearchLabel.classList.add("hidden");
    if (gameSwitcherHint) {
        gameSwitcherHint.classList.remove("isError");
        gameSwitcherHint.textContent = "Digite o nome para filtrar ou adicionar um jogo.";
    }
}

function bindGameSwitcherEvents() {
    if (!gameSwitcherTrigger) return;

    gameSwitcherTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = gameSwitcherTrigger.getAttribute("aria-expanded") !== "true";
        setGameMenuOpen(open);
    });

    document.addEventListener("click", (e) => {
        const linksHeader = document.getElementById("gameLinksHeader");
        if (!linksHeader || !linksHeader.contains(e.target)) {
            setHeaderLinksMenuOpen(false);
        }
        if (!gameSwitcher || gameSwitcher.contains(e.target)) return;
        setGameMenuOpen(false);
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (manageLinksModal && !manageLinksModal.classList.contains("hidden")) {
                closeManageLinksModal();
                return;
            }
            setHeaderLinksMenuOpen(false);
            setGameMenuOpen(false);
            setGameLinksFormOpen(false);
        }
    });

    if (gameSearchInput) {
        gameSearchInput.addEventListener("input", () => {
            const q = gameSearchInput.value.trim();
            clearTimeout(gameSearchTimer);
            renderGameLibrary();
            if (q.length < 2) {
                clearGameSearchResults();
                return;
            }
            gameSearchTimer = setTimeout(() => searchSteamGames(q), 320);
        });

        gameSearchInput.addEventListener("keydown", (e) => {
            e.stopPropagation();
        });
    }

    if (gameLinksAddBtn) {
        gameLinksAddBtn.addEventListener("click", () => setGameLinksFormOpen(true));
    }

    if (gameLinksFormCancel) {
        gameLinksFormCancel.addEventListener("click", () => setGameLinksFormOpen(false));
    }

    if (gameLinksForm) {
        gameLinksForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const ok = addGameLink(gameLinkLabelInput?.value, gameLinkUrlInput?.value);
            if (ok) {
                setGameLinksFormOpen(false);
            } else if (gameLinkUrlInput) {
                gameLinkUrlInput.focus();
                gameLinkUrlInput.style.borderColor = "#EF4444";
                setTimeout(() => {
                    gameLinkUrlInput.style.borderColor = "";
                }, 1200);
            }
        });
    }

    if (manageLinksClose) {
        manageLinksClose.addEventListener("click", () => closeManageLinksModal());
    }

    if (manageLinksModal) {
        manageLinksModal.addEventListener("click", (e) => {
            if (e.target === manageLinksModal) closeManageLinksModal();
        });
    }

    if (gameLinksTrigger) {
        gameLinksTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const open = gameLinksHeaderMenu?.classList.contains("hidden");
            setHeaderLinksMenuOpen(Boolean(open));
            if (open) renderHeaderLinksMenu();
        });
    }

    if (gameLinksHeaderMenu) {
        gameLinksHeaderMenu.addEventListener("click", (e) => e.stopPropagation());
    }

    if (openArchivedGamesBtn) {
        openArchivedGamesBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openArchivedPage();
        });
    }

    if (archivedBackBtn) {
        archivedBackBtn.addEventListener("click", () => closeArchivedPage());
    }

    if (archivedSearch) {
        archivedSearch.addEventListener("input", () => renderArchivedPage());
    }
}

async function searchSteamGames(query) {
    if (!gameSearchResults) return;

    gameSearchResults.innerHTML = `<button type="button" class="gameSwitcherItem" disabled>Buscando...</button>`;
    if (gameSearchLabel) gameSearchLabel.classList.remove("hidden");
    if (gameSwitcherHint) {
        gameSwitcherHint.classList.remove("isError");
        gameSwitcherHint.textContent = "Buscando na Steam Store / SteamDB...";
    }

    try {
        const res = await fetch(`${STEAM_SEARCH_URL}?q=${encodeURIComponent(query)}`, {
            cache: "no-store",
        });
        const data = await res.json();

        if (data.error) {
            throw new Error(data.error);
        }

        const items = data.items || [];
        gameSearchResults.innerHTML = "";

        if (items.length === 0) {
            gameSearchResults.innerHTML = `<button type="button" class="gameSwitcherItem" disabled>Nenhum jogo encontrado</button>`;
            if (gameSwitcherHint) {
                gameSwitcherHint.textContent = "Tente outro nome (ex.: Soulmask, Elden Ring).";
            }
            return;
        }

        items.forEach((item) => {
            const existing = games.find((g) => g.appId === item.appId);
            const status = !existing
                ? "Adicionar"
                : existing.archived
                  ? "Arquivado"
                  : "Na biblioteca";
            const statusClass =
                status === "Adicionar" ? "gameSwitcherItemAdd" : "gameSwitcherItemMeta";
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "gameSwitcherItem";
            btn.innerHTML = `
                <img src="${item.image}" alt="" hidden>
                <span class="gameSwitcherIconFallback">${gameInitials(item.name)}</span>
                <span class="gameSwitcherItemText">
                    <span class="gameSwitcherItemName" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
                    <span class="${statusClass}">${status}</span>
                </span>
            `;
            const resultImg = btn.querySelector("img");
            const resultFallback = btn.querySelector(".gameSwitcherIconFallback");
            setGameIcon(resultImg, resultFallback, item);
            btn.addEventListener("click", () => {
                addOrSelectGame({
                    appId: item.appId,
                    name: item.name,
                    image: item.image,
                });
            });
            gameSearchResults.appendChild(btn);
        });

        if (gameSwitcherHint) {
            gameSwitcherHint.textContent = "Clique em um resultado para adicionar / selecionar.";
        }
    } catch (err) {
        gameSearchResults.innerHTML = "";
        if (gameSearchLabel) gameSearchLabel.classList.add("hidden");
        if (gameSwitcherHint) {
            gameSwitcherHint.classList.add("isError");
            gameSwitcherHint.textContent =
                "Não foi possível buscar. Abra pelo Iniciar Guia.bat (servidor local).";
        }
        console.error(err);
    }
}

async function addOrSelectGame(game) {
    const resolved = await resolveClientIcon({
        appId: String(game.appId),
        name: game.name,
        image: game.image,
        clienticon: game.clienticon,
    });

    const existing = games.find((g) => g.appId === resolved.appId);
    if (!existing) {
        games.push({
            appId: resolved.appId,
            name: resolved.name,
            image: resolved.image || gameImageUrl(resolved),
            clienticon: resolved.clienticon || undefined,
        });
        saveGames();
    } else {
        if (resolved.clienticon) existing.clienticon = resolved.clienticon;
        if (resolved.image) existing.image = resolved.image;
        if (resolved.name) existing.name = resolved.name;
        if (existing.archived) existing.archived = false;
        saveGames();
    }
    selectGame(resolved.appId);
}

function selectGame(appId) {
    if (appId === activeGameAppId) {
        setGameMenuOpen(false);
        closeArchivedPage();
        renderGameLibrary();
        return;
    }

    saveAchievements();
    activeGameAppId = appId;
    lastSteamAchievements = null;
    saveGames();
    loadAchievements();
    validateAchievements();
    renderActiveGame();
    renderGameLibrary();
    renderAchievements();
    setGameMenuOpen(false);
    closeArchivedPage();

    if (achievements.length === 0) {
        importSteamAchievements(activeGameAppId).then(() => applyBundledSoulmaskGuide());
    } else {
        syncWithSteam();
        refreshDlcGroupsFromSteam();
        applyBundledSoulmaskGuide();
    }
}

async function importSteamAchievements(
    appId,
    { force = false, quiet = false, wipeGuide = false } = {}
) {
    const id = String(appId || activeGameAppId || "");
    if (!id) return { ok: false, reason: "no-app" };

    if (importingAppIds.has(id)) {
        return { ok: false, reason: "busy" };
    }

    if (!force && achievements.length > 0) {
        return { ok: false, reason: "already-has-data" };
    }

    importingAppIds.add(id);
    try {
        if (gameSwitcherHint && !quiet) {
            gameSwitcherHint.classList.remove("isError");
            gameSwitcherHint.textContent = "Importando conquistas da Steam…";
        }

        const res = await fetch(`/api/steam-achievements?appId=${encodeURIComponent(id)}`);
        const data = await res.json();

        if (data.error || !Array.isArray(data.achievements) || data.achievements.length === 0) {
            if (gameSwitcherHint && !quiet) {
                gameSwitcherHint.classList.add("isError");
                gameSwitcherHint.textContent =
                    data.error || "Nenhuma conquista encontrada para este jogo.";
            }
            return { ok: false, reason: "empty", error: data.error };
        }

        // Conquistas sempre vêm da Steam; preserva progresso (e guia, se não for wipe).
        const previous = achievements.slice();
        achievements = data.achievements.map((item) => {
            const prev = findGuideMatch(previous, item);
            const merged = {
                ...item,
                completed: Boolean(prev?.completed),
                completedManual: Boolean(prev?.completedManual && prev?.completed),
                unlockedAt: prev?.unlockedAt || null,
                videoUrl: "",
                guideUrl: "",
                tips: "",
                group: "Sem Grupo",
                difficulty: "",
                missable: false,
                dlc: resolveAchievementDlc(item),
            };
            if (!wipeGuide) applyGuideOverlay(merged, prev);
            return merged;
        });
        saveAchievements();
        validateAchievements();
        renderAchievements();

        if (id === activeGameAppId) {
            // Sync marca as já desbloqueadas sem toast duplicado — o import
            // já mostra o resumo + um card por conquista.
            syncWithSteam({ silentToasts: true });
        }

        if (gameSwitcherHint && !quiet) {
            gameSwitcherHint.classList.remove("isError");
            gameSwitcherHint.textContent = `${achievements.length} conquistas importadas.`;
        }
        if (!quiet) {
            const game = games.find((g) => g.appId === id);
            showImportAchievementToasts(achievements, game?.name || "jogo");
        }
        return { ok: true, count: achievements.length };
    } catch (err) {
        if (gameSwitcherHint && !quiet) {
            gameSwitcherHint.classList.add("isError");
            gameSwitcherHint.textContent =
                "Falha ao importar. Use o Iniciar Guia.bat (servidor local).";
        }
        console.error(err);
        return { ok: false, reason: "network", error: err.message };
    } finally {
        importingAppIds.delete(id);
    }
}

// ==============================
// Criar / Editar Conquista
// ==============================

function saveCurrentAchievement() {
    if (title.value.trim() === "") {
        alert("Informe um nome para a conquista.");
        return;
    }

    const groupValue = groupInput ? groupInput.value.trim() : "";
    const videoUrl = normalizeExternalUrl(videoUrlInput ? videoUrlInput.value : "");
    const guideUrl = normalizeExternalUrl(guideUrlInput ? guideUrlInput.value : "");
    const tips = tipsInput ? tipsInput.value.trim() : "";
    const reqLevel =
        normalizeReqLevel(reqLevelInput ? reqLevelInput.value : "") ||
        parseReqLevelFromTips(tips);
    const difficulty = normalizeDifficulty(difficultyInput ? difficultyInput.value : "");
    const missable = Boolean(missableInput?.checked);

    const descriptionValue = description.value.trim();
    if (editingId === null) {
        achievements.push({
            id: Date.now(),
            title: title.value.trim(),
            group: groupValue || "Sem Grupo",
            description: descriptionValue,
            icon: pastedImage,
            completed: false,
            completedManual: false,
            videoUrl,
            guideUrl,
            tips,
            reqLevel,
            difficulty,
            missable,
            dlc: extractDlcName(descriptionValue) || "Jogo base",
        });
    } else {
        const achievement = achievements.find(a => a.id === editingId);
        if (achievement) {
            achievement.title = title.value.trim();
            achievement.group = groupValue || "Sem Grupo";
            achievement.description = descriptionValue;
            achievement.icon = pastedImage !== "" ? pastedImage : achievement.icon;
            achievement.videoUrl = videoUrl;
            achievement.guideUrl = guideUrl;
            achievement.tips = tips;
            achievement.reqLevel = reqLevel;
            achievement.difficulty = difficulty;
            achievement.missable = missable;
            achievement.dlc = extractDlcName(descriptionValue) || "Jogo base";
        }
    }

    saveAchievements();
    renderAchievements();
    closeModal();
}

// ==============================
// Criar Card
// ==============================

function createAchievementCard(item, container) {
    container = container || achievementList;
    const card = document.createElement("div");
    const isManual = Boolean(item.completed && item.completedManual);
    card.dataset.achievementId = String(item.id);
    card.className = "achievement"
        + (item.completed ? " isCompleted" : "")
        + (isManual ? " isManual" : "");

    const hasGlobalPercent = typeof item.globalPercent === "number";
    const hasVideo = Boolean(item.videoUrl);
    const videoAction = hasVideo ? resolveVideoAction(item.videoUrl) : null;
    const videoEmbeds = videoAction?.mode === "embed";
    const hasGuide = Boolean(item.guideUrl);
    const hasTips = Boolean(item.tips && item.tips.trim());
    const showGroup = currentView === "flat" && item.group;
    const dlcName = resolveAchievementDlc(item);
    const showDlc = currentView === "flat" && dlcName && dlcName !== "Jogo base";
    const diffKey = normalizeDifficulty(item.difficulty);
    const diffLabel = difficultyLabel(item.difficulty);
    const showMissable = Boolean(item.missable);
    const showDifficulty = Boolean(diffKey);
    const reqLevel = resolveReqLevel(item);
    const reqLevelLabel = formatReqLevelLabel(reqLevel);
    const showReqLevel = Boolean(reqLevelLabel);

    const videoTooltip = videoEmbeds
        ? "Assistir no guia"
        : hasVideo
          ? "Abrir busca / página no navegador"
          : "Sem vídeo";
    const videoLink = hasVideo
        ? `<button type="button" class="helpLink helpVideo" data-tooltip="${escapeAttr(videoTooltip)}" data-tooltip-pos="top" aria-label="${escapeAttr(videoTooltip)}">${ICON.play}<span>Vídeo</span></button>`
        : `<span class="helpLink isDisabled" data-tooltip="Sem vídeo" data-tooltip-pos="top" aria-disabled="true">${ICON.play}<span>Vídeo</span></span>`;
    const guideLink = hasGuide
        ? `<a class="helpLink" href="${escapeAttr(item.guideUrl)}" target="_blank" rel="noopener noreferrer" data-tooltip="Abrir guia" data-tooltip-pos="top">${ICON.book}<span>Guia</span></a>`
        : `<span class="helpLink isDisabled" data-tooltip="Sem guia" data-tooltip-pos="top" aria-disabled="true">${ICON.book}<span>Guia</span></span>`;
    const tipsLink = hasTips
        ? `<button type="button" class="helpLink helpTip" aria-expanded="false" aria-label="Ver dicas">${ICON.note}<span>Dicas</span></button>`
        : `<span class="helpLink isDisabled" data-tooltip="Sem dicas" data-tooltip-pos="top" aria-disabled="true">${ICON.note}<span>Dicas</span></span>`;

    card.innerHTML = `
        ${hasGlobalPercent ? `<div class="achieveFillBg" style="width:${item.globalPercent}%"></div>` : ""}

        <img
            class="achievementIcon"
            src="${getAchievementIcon(item.icon)}"
            alt="${item.title}"
        >

        <div class="info">
            <div class="titleRow">
                <h2>${item.title}${isManual ? `<span class="manualBadge" data-tooltip="Concluída manualmente. Ainda não na Steam.">${ICON.hand} Manual</span>` : ""}</h2>
                ${(showDifficulty || showMissable || showDlc || showReqLevel) ? `
                    <div class="titleMarks">
                        ${showReqLevel ? `<span class="levelTag" data-tooltip="Nível recomendado · ${escapeAttr(reqLevelLabel)}" data-tooltip-pos="top" aria-label="${escapeAttr(reqLevelLabel)}">${escapeHtml(reqLevelLabel)}</span>` : ""}
                        ${showDlc ? `<span class="steamDlcTag" data-tooltip="DLC · ${escapeAttr(dlcName)}" data-tooltip-pos="top">DLC</span>` : ""}
                        ${showMissable ? `<span class="diffChip is-iconOnly is-missable" data-tooltip="Perdível" data-tooltip-pos="top" aria-label="Perdível">${missableIcon()}</span>` : ""}
                        ${showDifficulty ? `<span class="diffChip is-iconOnly is-${diffKey}" data-tooltip="${escapeAttr(diffLabel)}" data-tooltip-pos="top" aria-label="${escapeAttr(diffLabel)}">${difficultyIcon(diffKey)}</span>` : ""}
                    </div>
                ` : ""}
            </div>
            <p>${item.description || ""}</p>
            <div class="cardMeta">
                ${showGroup ? `<span class="metaChip groupBadge">${ICON.folder}<span>${escapeHtml(item.group)}</span></span>` : ""}
                <div class="helpLinks">
                    ${videoLink}
                    ${guideLink}
                    ${tipsLink}
                </div>
            </div>
        </div>

        <div class="actions">
            <label class="status" data-tooltip="${item.completed ? (isManual ? "Concluída manualmente" : "Clique para desmarcar") : "Marcar como concluída"}" data-tooltip-pos="left">
                <input type="checkbox" ${item.completed ? "checked" : ""}>
                <span class="statusIcon statusIconOff" aria-hidden="true">${ICON.circle}</span>
                <span class="statusIcon statusIconOn" aria-hidden="true">${ICON.check}</span>
                <span class="statusLabel">${item.completed ? (isManual ? "Manual" : "Concluída") : "Concluir"}</span>
            </label>
            ${hasGlobalPercent ? `
                <span class="globalStat" data-tooltip="${escapeAttr(item.globalPercent.toFixed(1))}% dos jogadores na Steam" data-tooltip-pos="left">
                    ${item.globalPercent.toFixed(1)}%
                </span>
            ` : ""}
        </div>
    `;

    card.classList.add("isClickable");
    card.addEventListener("click", (e) => {
        if (e.target.closest(".status, button, a, input, label, .globalStat, .helpLinks, .cardMeta, .titleMarks")) return;
        editAchievement(item.id);
    });
    setTooltip(card.querySelector(".info h2"), "Clique para editar", "top");

    const tipBtn = card.querySelector("button.helpTip");
    if (tipBtn && hasTips) {
        tipBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTipsPopover(tipBtn, item.tips, item.title);
        });
    }

    const videoBtn = card.querySelector("button.helpVideo");
    if (videoBtn && item.videoUrl) {
        videoBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openAchievementVideo(item.videoUrl, item.title);
        });
    }

    const checkbox = card.querySelector("input[type='checkbox']");
    checkbox.addEventListener("change", async () => {
        if (!checkbox.checked) {
            markAchievementIncomplete(item);
            return;
        }

        // Em qualquer jogo: se a Steam ainda não desbloqueou, pede confirmação Manual.
        if (!lastSteamAchievements) {
            checkbox.checked = false;
            checkbox.disabled = true;
            await syncWithSteam({ manual: true });
            checkbox.disabled = false;
        }

        const steam = getSteamInfoForItem(item);
        if (steam && !steam.completed) {
            checkbox.checked = false;
            openConfirmManualModal(item);
            return;
        }

        // Sem cache Steam (jogo nunca aberto): ainda permite marcar, mas como Manual.
        if (!steam && !lastSteamAchievements) {
            checkbox.checked = false;
            openConfirmManualModal(item);
            return;
        }

        markAchievementCompleted(item, { manual: false });
    });

    container.appendChild(card);
}

// ==============================
// Editar Conquista
// ==============================

function editAchievement(id) {
    const achievement = achievements.find(item => item.id === id);
    if (!achievement) {
        return;
    }

    editingId = id;
    title.value = achievement.title;
    if (groupInput) groupInput.value = achievement.group || "";
    description.value = achievement.description || "";
    if (videoUrlInput) videoUrlInput.value = achievement.videoUrl || "";
    if (guideUrlInput) guideUrlInput.value = achievement.guideUrl || "";
    if (tipsInput) tipsInput.value = achievement.tips || "";
    if (reqLevelInput) reqLevelInput.value = resolveReqLevel(achievement);
    setDifficultyUI(achievement.difficulty);
    if (missableInput) missableInput.checked = Boolean(achievement.missable);
    pastedImage = achievement.icon || "";
    updateGroupSuggestions();

    if (pastedImage) renderPastePreview(pastedImage);
    else resetPasteArea();

    if (modalModeLabel) modalModeLabel.textContent = "Editar conquista";
    saveAchievement.textContent = "Salvar alterações";
    if (deleteAchievementBtn) deleteAchievementBtn.classList.remove("hidden");
    modal.classList.remove("hidden");
}

// ==============================
// Excluir Conquista
// ==============================

function deleteAchievement(id) {
    const achievement = achievements.find(item => item.id === id);
    if (!achievement) {
        return;
    }

    const confirmDelete = confirm(
        `Deseja realmente excluir a conquista "${achievement.title}"?`
    );

    if (!confirmDelete) {
        return;
    }

    achievements = achievements.filter(item => item.id !== id);
    saveAchievements();
    closeModal();
    renderAchievements();
}

// ==============================
// Atualizar Contadores
// ==============================

function updateCounters() {
    const total = achievements.length;
    const completed = achievements.filter(a => a.completed).length;
    const pending = total - completed;

    if (countAll) {
        countAll.textContent = total;
    }
    if (countCompleted) {
        countCompleted.textContent = completed;
    }
    if (countPending) {
        countPending.textContent = pending;
    }
}

// ==============================
// Ordenação
// ==============================

function sortAchievements() {
    achievements.sort((a, b) => {
        // Pendentes primeiro
        if (a.completed !== b.completed) {
            return a.completed - b.completed;
        }

        // Depois por nome
        return a.title.localeCompare(
            b.title,
            "pt-BR",
            { sensitivity: "base" }
        );
    });
}

// ==============================
// Renderização Principal
// ==============================

function facetDifficultyKey(item) {
    return normalizeDifficulty(item?.difficulty) || "none";
}

function facetReqLevelKey(item) {
    return resolveReqLevel(item) || "none";
}

function facetDlcKey(item) {
    return resolveAchievementDlc(item) || "Jogo base";
}

function countActiveFacets() {
    return (
        facetFilters.difficulties.size +
        facetFilters.reqLevels.size +
        facetFilters.dlcs.size
    );
}

function applyFacetFilters(list) {
    let next = list;
    if (facetFilters.difficulties.size) {
        next = next.filter((item) => facetFilters.difficulties.has(facetDifficultyKey(item)));
    }
    if (facetFilters.reqLevels.size) {
        next = next.filter((item) => facetFilters.reqLevels.has(facetReqLevelKey(item)));
    }
    if (facetFilters.dlcs.size) {
        next = next.filter((item) => facetFilters.dlcs.has(facetDlcKey(item)));
    }
    return next;
}

function closeGroupByMenu() {
    if (!groupByMenu || !groupByTrigger) return;
    groupByMenu.classList.add("hidden");
    groupByTrigger.setAttribute("aria-expanded", "false");
    groupByWrap?.classList.remove("isOpen");
}

function closeFiltersPanel() {
    if (!filtersPanel || !filtersTrigger) return;
    filtersPanel.classList.add("hidden");
    filtersTrigger.setAttribute("aria-expanded", "false");
    filtersWrap?.classList.remove("isOpen");
}

function updateGroupByUI() {
    if (groupByValue) {
        groupByValue.textContent = GROUP_BY_LABELS[currentView] || "Lista";
    }
    groupByMenu?.querySelectorAll("[data-view]").forEach((btn) => {
        const on = btn.dataset.view === currentView;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
    });
}

function updateFiltersChrome() {
    const n = countActiveFacets();
    if (filtersCount) {
        filtersCount.textContent = String(n);
        filtersCount.classList.toggle("hidden", n === 0);
        filtersCount.setAttribute("aria-hidden", n === 0 ? "true" : "false");
    }
    if (filtersTrigger) {
        filtersTrigger.classList.toggle("hasFilters", n > 0);
        filtersTrigger.setAttribute(
            "aria-label",
            n > 0 ? `Filtros, ${n} ativos` : "Filtros"
        );
    }
    if (filtersClearBtn) filtersClearBtn.disabled = n === 0;
}

function toggleFacetValue(set, value) {
    if (set.has(value)) set.delete(value);
    else set.add(value);
}

function syncFacetChipStates() {
    const pairs = [
        [filterDifficultyChips, facetFilters.difficulties],
        [filterReqLevelChips, facetFilters.reqLevels],
        [filterDlcChips, facetFilters.dlcs],
    ];
    for (const [container, set] of pairs) {
        if (!container) continue;
        container.querySelectorAll(".filterChip").forEach((btn) => {
            const on = set.has(btn.dataset.facetValue);
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
    }
}

function renderFacetChips(container, options, activeSet, onToggle) {
    if (!container) return;
    container.innerHTML = "";
    if (!options.length) {
        const empty = document.createElement("span");
        empty.className = "filtersEmpty";
        empty.textContent = "Nada nesta lista";
        container.appendChild(empty);
        return;
    }
    options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "filterChip" + (activeSet.has(opt.value) ? " is-active" : "");
        btn.dataset.facetValue = opt.value;
        btn.textContent = opt.label;
        btn.setAttribute("aria-pressed", activeSet.has(opt.value) ? "true" : "false");
        btn.addEventListener("click", (event) => {
            event.stopPropagation();
            onToggle(opt.value);
            syncFacetChipStates();
            updateFiltersChrome();
            renderAchievements();
        });
        container.appendChild(btn);
    });
}

function collectFacetOptions() {
    const diffOpts = [
        { value: "easy", label: "Fácil" },
        { value: "medium", label: "Médio" },
        { value: "hard", label: "Difícil" },
        { value: "none", label: "Sem dificuldade" },
    ].filter((opt) => achievements.some((a) => facetDifficultyKey(a) === opt.value));

    const levelVals = new Set();
    achievements.forEach((a) => levelVals.add(facetReqLevelKey(a)));
    const levelOpts = [...levelVals]
        .sort((a, b) => {
            if (a === "none") return 1;
            if (b === "none") return -1;
            return reqLevelSectionSort(
                a === "none" ? "Sem nível" : formatReqLevelLabel(a),
                b === "none" ? "Sem nível" : formatReqLevelLabel(b)
            );
        })
        .map((v) => ({
            value: v,
            label: v === "none" ? "Sem nível" : formatReqLevelLabel(v),
        }));

    const dlcVals = new Set();
    achievements.forEach((a) => dlcVals.add(facetDlcKey(a)));
    const dlcOpts = [...dlcVals]
        .sort((a, b) => {
            if (a === "Jogo base") return -1;
            if (b === "Jogo base") return 1;
            return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
        })
        .map((v) => ({ value: v, label: v }));

    return { diffOpts, levelOpts, dlcOpts };
}

function pruneFacetSelections(opts = collectFacetOptions()) {
    for (const v of [...facetFilters.difficulties]) {
        if (!opts.diffOpts.some((o) => o.value === v)) facetFilters.difficulties.delete(v);
    }
    for (const v of [...facetFilters.reqLevels]) {
        if (!opts.levelOpts.some((o) => o.value === v)) facetFilters.reqLevels.delete(v);
    }
    for (const v of [...facetFilters.dlcs]) {
        if (!opts.dlcOpts.some((o) => o.value === v)) facetFilters.dlcs.delete(v);
    }
}

function rebuildFilterChips() {
    const opts = collectFacetOptions();
    pruneFacetSelections(opts);
    renderFacetChips(filterDifficultyChips, opts.diffOpts, facetFilters.difficulties, (v) =>
        toggleFacetValue(facetFilters.difficulties, v)
    );
    renderFacetChips(filterReqLevelChips, opts.levelOpts, facetFilters.reqLevels, (v) =>
        toggleFacetValue(facetFilters.reqLevels, v)
    );
    renderFacetChips(filterDlcChips, opts.dlcOpts, facetFilters.dlcs, (v) =>
        toggleFacetValue(facetFilters.dlcs, v)
    );
    updateFiltersChrome();
}

function clearFacetFilters() {
    facetFilters.difficulties.clear();
    facetFilters.reqLevels.clear();
    facetFilters.dlcs.clear();
    syncFacetChipStates();
    updateFiltersChrome();
    renderAchievements();
}

function setupListControls() {
    updateGroupByUI();

    groupByTrigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = groupByMenu && !groupByMenu.classList.contains("hidden");
        closeFiltersPanel();
        if (open) {
            closeGroupByMenu();
            return;
        }
        groupByMenu?.classList.remove("hidden");
        groupByTrigger.setAttribute("aria-expanded", "true");
        groupByWrap?.classList.add("isOpen");
    });

    groupByMenu?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-view]");
        if (!btn || !groupByMenu.contains(btn)) return;
        currentView = btn.dataset.view || "flat";
        updateGroupByUI();
        closeGroupByMenu();
        renderAchievements();
    });

    filtersTrigger?.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = filtersPanel && !filtersPanel.classList.contains("hidden");
        closeGroupByMenu();
        if (open) {
            closeFiltersPanel();
            return;
        }
        rebuildFilterChips();
        filtersPanel?.classList.remove("hidden");
        filtersTrigger.setAttribute("aria-expanded", "true");
        filtersWrap?.classList.add("isOpen");
    });

    filtersClearBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        clearFacetFilters();
    });

    filtersPanel?.addEventListener("click", (e) => e.stopPropagation());
    groupByMenu?.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", () => {
        closeGroupByMenu();
        closeFiltersPanel();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeGroupByMenu();
            closeFiltersPanel();
        }
    });
}

function renderAchievements() {
    closeTipsPopover();
    sortAchievements();
    pruneFacetSelections();
    updateFiltersChrome();
    // Não remonta chips com o painel aberto — evita o modal “pular”

    achievementList.innerHTML = "";
    updateCounters();

    let filtered = [...achievements];

    // Pesquisa
    const text = search ? search.value.trim().toLowerCase() : "";

    if (text) {
        filtered = filtered.filter(item => {
            return (
                item.title.toLowerCase().includes(text) ||
                item.description.toLowerCase().includes(text) ||
                (item.tips || "").toLowerCase().includes(text) ||
                (item.group || "").toLowerCase().includes(text) ||
                resolveAchievementDlc(item).toLowerCase().includes(text) ||
                matchesReqLevelSearch(item, text)
            );
        });
    }

    // Sidebar: todas / concluídas / pendentes
    switch (currentFilter) {
        case "completed":
            filtered = filtered.filter(item => item.completed);
            break;
        case "pending":
            filtered = filtered.filter(item => !item.completed);
            break;
    }

    // Facets combináveis (dificuldade × nível × DLC)
    filtered = applyFacetFilters(filtered);

    if (filtered.length === 0) {
        const hasAny = achievements.length > 0;
        achievementList.innerHTML = `
            <div class="empty${hasAny ? " isFilterEmpty" : ""}">
                <div class="empty-icon" aria-hidden="true">${hasAny ? ICON.funnel : ICON.award}</div>
                <h2>${hasAny ? "Nada neste filtro" : "Nenhuma conquista ainda"}</h2>
                <p id="emptyMessage">${hasAny
                    ? "Limpe a busca ou escolha outro filtro na sidebar."
                    : "Importe as conquistas públicas da Steam ou cadastre manualmente."}</p>
                <div id="emptyFeedback" class="emptyFeedback hidden" role="status"></div>
                <div class="emptyActions">
                    ${hasAny
                        ? `<button type="button" class="btn btn-secondary" id="emptyClearFilters">
                            <i class="ph-bold ph-x btnIcon" aria-hidden="true"></i>
                            <span>Limpar filtros</span>
                        </button>`
                        : `
                        <button type="button" class="btn btn-primary" id="emptyImportSteam">
                            <i class="ph-bold ph-cloud-arrow-down btnIcon" aria-hidden="true"></i>
                            <span>Importar da Steam</span>
                        </button>
                        <button type="button" class="btn btn-secondary" id="emptyNewAchievement">
                            <i class="ph-bold ph-plus btnIcon" aria-hidden="true"></i>
                            <span>Nova Conquista</span>
                        </button>`}
                </div>
            </div>
        `;
        const clearFiltersBtn = document.getElementById("emptyClearFilters");
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener("click", () => {
                if (search) search.value = "";
                currentFilter = "all";
                document.querySelectorAll("[data-filter]").forEach((btn) => {
                    btn.classList.toggle("active", btn.dataset.filter === "all");
                });
                facetFilters.difficulties.clear();
                facetFilters.reqLevels.clear();
                facetFilters.dlcs.clear();
                renderAchievements();
            });
        }
        const emptyBtn = document.getElementById("emptyNewAchievement");
        if (emptyBtn && newAchievement) {
            emptyBtn.addEventListener("click", () => newAchievement.click());
        }
        const importBtn = document.getElementById("emptyImportSteam");
        const feedback = document.getElementById("emptyFeedback");
        if (importBtn) {
            importBtn.addEventListener("click", async () => {
                importBtn.disabled = true;
                importBtn.classList.add("isLoading");
                const label = importBtn.querySelector("span");
                const icon = importBtn.querySelector(".btnIcon");
                const prevLabel = label ? label.textContent : "Importar da Steam";
                const prevIcon = icon ? icon.className : "";
                if (label) label.textContent = "Importando…";
                if (icon) icon.className = "ph-bold ph-spinner-gap btnIcon";
                if (feedback) {
                    feedback.classList.add("hidden");
                    feedback.classList.remove("isError", "isInfo");
                    feedback.textContent = "";
                }

                const result = await importSteamAchievements(activeGameAppId, { force: true });

                if (result?.ok) return;

                importBtn.disabled = false;
                importBtn.classList.remove("isLoading");
                if (label) label.textContent = prevLabel;
                if (icon) icon.className = prevIcon || "ph-bold ph-cloud-arrow-down btnIcon";

                let message = "Não foi possível importar as conquistas.";
                if (result?.reason === "network") {
                    message = "Servidor local offline. Abra pelo Iniciar Guia.bat.";
                } else if (result?.error || result?.reason === "empty") {
                    message = result.error
                        || "Este jogo não tem conquistas públicas na Steam.";
                }

                if (feedback) {
                    feedback.textContent = message;
                    feedback.classList.remove("hidden");
                    feedback.classList.add("isError");
                }
            });
        }
        return;
    }

    if (currentView === "grouped") {
        renderGroupedAchievements(filtered);
    } else if (currentView === "dlc") {
        renderDlcAchievements(filtered);
    } else if (currentView === "level") {
        renderLevelAchievements(filtered);
    } else if (currentView === "reqLevel") {
        renderReqLevelAchievements(filtered);
    } else {
        filtered.forEach(item => createAchievementCard(item, achievementList));
    }

}

// ==============================
// Renderização Agrupada
// ==============================

function renderSectionedAchievements(filtered, keyFn, options = {}) {
    const sections = new Map();

    filtered.forEach((item) => {
        const key = keyFn(item);
        if (!sections.has(key)) sections.set(key, []);
        sections.get(key).push(item);
    });

    const sortedNames = [...sections.keys()].sort((a, b) => {
        if (typeof options.sortBy === "function") {
            return options.sortBy(a, b);
        }
        if (Array.isArray(options.order) && options.order.length) {
            const ia = options.order.indexOf(a);
            const ib = options.order.indexOf(b);
            const ra = ia === -1 ? 999 : ia;
            const rb = ib === -1 ? 999 : ib;
            if (ra !== rb) return ra - rb;
        }
        if (options.baseFirst) {
            if (a === "Jogo base") return -1;
            if (b === "Jogo base") return 1;
        }
        return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
    });

    sortedNames.forEach((sectionName) => {
        const items = sections.get(sectionName);
        const collapseKey = sectionCollapseKey(sectionName);
        const isCollapsed = Boolean(collapsedSections[collapseKey]);

        const header = document.createElement("button");
        header.type = "button";
        const levelClass =
            sectionName === "Perdíveis"
                ? " is-missable"
                : sectionName === "Fácil"
                  ? " is-easy"
                  : sectionName === "Médio"
                    ? " is-medium"
                    : sectionName === "Difícil"
                      ? " is-hard"
                      : "";
        header.className =
            "groupHeader" +
            (options.dlc ? " dlcHeader" : "") +
            (options.level ? " levelHeader" : "") +
            (options.reqLevel ? " reqLevelHeader" : "") +
            levelClass +
            (isCollapsed ? " is-collapsed" : "");
        header.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
        const levelIcon = options.level
            ? sectionName === "Perdíveis"
                ? missableIcon()
                : sectionName === "Fácil"
                  ? difficultyIcon("easy")
                  : sectionName === "Médio"
                    ? difficultyIcon("medium")
                    : sectionName === "Difícil"
                      ? difficultyIcon("hard")
                      : ""
            : "";
        const reqLevelIcon = options.reqLevel
            ? `<i class="ph-duotone ph-stairs" aria-hidden="true"></i>`
            : "";
        header.innerHTML = `
            <h3>${options.dlc && sectionName !== "Jogo base" ? `<i class="ph-duotone ph-puzzle-piece" aria-hidden="true"></i>` : ""}${levelIcon}${reqLevelIcon}${escapeHtml(sectionName)}</h3>
            <span class="groupCount">${items.filter((i) => i.completed).length}/${items.length}</span>
            <i class="ph-bold ph-caret-down groupCollapseIcon" aria-hidden="true"></i>
        `;
        achievementList.appendChild(header);

        const section = document.createElement("div");
        section.className = "groupSection" + (isCollapsed ? " is-collapsed" : "");
        const sectionInner = document.createElement("div");
        sectionInner.className = "groupSectionInner";
        section.appendChild(sectionInner);
        achievementList.appendChild(section);

        header.addEventListener("click", (event) => {
            event.preventDefault();
            header.focus({ preventScroll: true });
            const next = !header.classList.contains("is-collapsed");
            header.classList.toggle("is-collapsed", next);
            section.classList.toggle("is-collapsed", next);
            header.setAttribute("aria-expanded", next ? "false" : "true");
            if (next) collapsedSections[collapseKey] = true;
            else delete collapsedSections[collapseKey];
            saveCollapsedSections();
        });

        items.forEach((item) => createAchievementCard(item, sectionInner));
    });
}

function renderGroupedAchievements(filtered) {
    renderSectionedAchievements(filtered, (item) => item.group || "Sem Grupo");
}

function renderDlcAchievements(filtered) {
    renderSectionedAchievements(filtered, (item) => resolveAchievementDlc(item), {
        dlc: true,
        baseFirst: true,
    });
}

function renderLevelAchievements(filtered) {
    renderSectionedAchievements(filtered, (item) => levelSectionKey(item), {
        level: true,
        order: ["Perdíveis", "Fácil", "Médio", "Difícil", "Sem dificuldade"],
    });
}

function renderReqLevelAchievements(filtered) {
    renderSectionedAchievements(filtered, (item) => reqLevelSectionKey(item), {
        reqLevel: true,
        sortBy: reqLevelSectionSort,
    });
}

// ==============================
// Fechar Modal com ESC / Clique fora
// ==============================

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        if (!modal.classList.contains("hidden")) {
            closeModal();
        }
    }
});

modal.addEventListener("click", (event) => {
    if (event.target === modal) {
        closeModal();
    }
});

// ==============================
// Ícone Padrão
// ==============================

function getAchievementIcon(icon) {
    if (icon && icon.trim() !== "") {
        return icon;
    }
    return "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2264%22%20height%3D%2264%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%232c435b%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%223%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Ccircle%20cx%3D%228.5%22%20cy%3D%228.5%22%20r%3D%221.5%22%2F%3E%3Cpolyline%20points%3D%2221%2015%2016%2010%205%2021%22%2F%3E%3C%2Fsvg%3E";
}

// ==============================
// Guia do jogo (export / import)
// Conquistas e progresso = Steam. O pacote só leva organização e extras.
// ==============================

const GUIDE_PACK_TYPE = "guia-conquistas-pack";
const GUIDE_PACK_VERSION = 2;
const GUIDE_PACK_NOTE =
    "Identifique por apiName. Preencha group, tips, guideUrl, videoUrl, difficulty (easy|medium|hard), missable, reqLevel, dlc. No import, só entram conquistas com guia preenchido.";
const PROFILE_PACK_TYPE = "guia-conquistas-profile";
const PROFILE_PACK_VERSION = 1;

function normalizeMatchTitle(value) {
    return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function pickGuideField(raw, ...keys) {
    if (!raw || typeof raw !== "object") return "";
    for (const key of keys) {
        if (!(key in raw) || raw[key] == null) continue;
        const value = typeof raw[key] === "string" ? raw[key].trim() : raw[key];
        if (value === "" || value === false) continue;
        if (value === true) return true;
        return value;
    }
    return "";
}

/**
 * Aceita schema canônico e aliases comuns da IA
 * (grupo, comoDesbloquear, linkGuia, nivel, …).
 */
function normalizeGuideOverlayFromPack(raw) {
    if (!raw || typeof raw !== "object") return null;

    const apiNameRaw = pickGuideField(raw, "apiName", "api_name");
    const apiName =
        apiNameRaw !== "" && apiNameRaw !== true ? String(apiNameRaw) : undefined;
    const title = String(pickGuideField(raw, "title", "nome", "displayName") || "");
    if (!apiName && !title) return null;

    const group = String(
        pickGuideField(raw, "group", "grupo", "category", "categoria") || ""
    );
    const dlc = String(pickGuideField(raw, "dlc", "DLC", "expansion") || "");
    const tips = String(
        pickGuideField(
            raw,
            "tips",
            "comoDesbloquear",
            "como_desbloquear",
            "dicas",
            "howTo",
            "howto",
            "unlock"
        ) || ""
    );
    const guideUrl = String(
        pickGuideField(raw, "guideUrl", "linkGuia", "guia", "guide", "urlGuia") || ""
    );
    const videoUrl = String(
        pickGuideField(raw, "videoUrl", "linkVideo", "video", "urlVideo") || ""
    );
    const description = String(
        pickGuideField(raw, "description", "descricao", "descrição") || ""
    );
    const difficulty = normalizeDifficulty(
        pickGuideField(raw, "difficulty", "nivel", "nível", "dificuldade", "diff")
    );
    const reqLevel = normalizeReqLevel(
        pickGuideField(raw, "reqLevel", "nivelRecomendado", "nívelRecomendado", "level")
    );
    const missableRaw = pickGuideField(
        raw,
        "missable",
        "perdivel",
        "perdível",
        "missableAchievement"
    );
    const missable =
        missableRaw === true ||
        ["true", "1", "sim", "yes"].includes(String(missableRaw).toLowerCase());

    return {
        apiName,
        title,
        iconHash: String(pickGuideField(raw, "iconHash", "icon_hash") || ""),
        group,
        dlc,
        description,
        tips,
        videoUrl,
        guideUrl,
        difficulty,
        missable,
        reqLevel,
    };
}

/** Campos de guia que a IA / autor preenche (não conta description da Steam). */
function hasGuideContent(item) {
    if (!item) return false;
    if (item.group && item.group !== "Sem Grupo") return true;
    if (item.dlc && item.dlc !== "Jogo base" && item.dlc !== "Sem Grupo") return true;
    if (String(item.videoUrl || "").trim()) return true;
    if (String(item.guideUrl || "").trim()) return true;
    if (String(item.tips || "").trim()) return true;
    if (normalizeDifficulty(item.difficulty)) return true;
    if (item.missable) return true;
    if (normalizeReqLevel(item.reqLevel) || resolveReqLevel(item)) return true;
    return false;
}

function buildGuideOverlay(item) {
    if (!item) return null;
    const apiName = item.apiName != null && String(item.apiName).trim() !== ""
        ? String(item.apiName)
        : undefined;
    if (!apiName && !item.title) return null;

    const reqLevel = resolveReqLevel(item) || "";
    const difficulty = normalizeDifficulty(item.difficulty);
    // Schema fixo (campos vazios inclusos) — serve de template para IA preencher.
    return {
        apiName,
        title: item.title ? String(item.title) : "",
        iconHash: extractIconHashFromUrl(item.icon) || "",
        group: item.group && item.group !== "Sem Grupo" ? String(item.group) : "",
        dlc:
            item.dlc && item.dlc !== "Jogo base" && item.dlc !== "Sem Grupo"
                ? String(item.dlc)
                : "",
        description: String(item.description || "").trim(),
        tips: String(item.tips || "").trim(),
        videoUrl: String(item.videoUrl || "").trim(),
        guideUrl: String(item.guideUrl || "").trim(),
        difficulty: difficulty || "",
        missable: Boolean(item.missable),
        reqLevel: reqLevel || "",
    };
}

function sortGuideOverlays(list) {
    return list.slice().sort((a, b) => {
        const aa = String(a.apiName || "");
        const bb = String(b.apiName || "");
        if (aa && bb && aa !== bb) return aa.localeCompare(bb, "en", { numeric: true });
        if (aa && !bb) return -1;
        if (!aa && bb) return 1;
        return normalizeMatchTitle(a.title).localeCompare(normalizeMatchTitle(b.title), "pt");
    });
}

function applyGuideOverlay(target, overlay, { force = false } = {}) {
    if (!target || !overlay) return false;
    let changed = false;

    const nextGroup = overlay.group ? String(overlay.group) : "";
    if (nextGroup && nextGroup !== "Sem Grupo") {
        if (target.group !== nextGroup) {
            target.group = nextGroup;
            changed = true;
        }
    } else if (force && "group" in overlay && (target.group || "Sem Grupo") !== "Sem Grupo") {
        target.group = "Sem Grupo";
        changed = true;
    }

    const nextDlc = overlay.dlc ? String(overlay.dlc) : "";
    if (nextDlc && nextDlc !== "Jogo base" && nextDlc !== "Sem Grupo") {
        if (target.dlc !== nextDlc) {
            target.dlc = nextDlc;
            changed = true;
        }
    } else if (force && "dlc" in overlay && (target.dlc || "Jogo base") !== "Jogo base") {
        target.dlc = "Jogo base";
        changed = true;
    }

    // Description da Steam não é apagada por pacote de guia (só sobrescreve se vier texto).
    if ("description" in overlay) {
        const nextDesc = overlay.description ? String(overlay.description) : "";
        if (nextDesc && (target.description || "") !== nextDesc) {
            target.description = nextDesc;
            changed = true;
        }
    }

    const nextVideo = overlay.videoUrl ? String(overlay.videoUrl) : "";
    if ((nextVideo || (force && "videoUrl" in overlay)) && (target.videoUrl || "") !== nextVideo) {
        target.videoUrl = nextVideo;
        changed = true;
    }

    if ("guideUrl" in overlay) {
        const nextGuide = overlay.guideUrl ? String(overlay.guideUrl) : "";
        if ((nextGuide || force) && (target.guideUrl || "") !== nextGuide) {
            target.guideUrl = nextGuide;
            changed = true;
        }
    }

    if ("tips" in overlay) {
        const nextTips = overlay.tips ? String(overlay.tips) : "";
        if ((nextTips || force) && (target.tips || "") !== nextTips) {
            target.tips = nextTips;
            changed = true;
        }
    }

    if ("difficulty" in overlay || overlay.difficulty) {
        const difficulty = normalizeDifficulty(overlay.difficulty);
        if (
            (force || difficulty) &&
            normalizeDifficulty(target.difficulty) !== difficulty
        ) {
            target.difficulty = difficulty;
            changed = true;
        }
    }

    if ("missable" in overlay) {
        const nextMiss = Boolean(overlay.missable);
        // No merge suave, só aplica true (false no JSON é default e não apaga marcação local)
        if ((nextMiss || force) && Boolean(target.missable) !== nextMiss) {
            target.missable = nextMiss;
            changed = true;
        }
    }

    {
        const nextLevel =
            normalizeReqLevel(overlay.reqLevel) ||
            (("tips" in overlay || overlay.tips) ? parseReqLevelFromTips(overlay.tips) : "");
        if (
            nextLevel &&
            (force || !normalizeReqLevel(target.reqLevel)) &&
            normalizeReqLevel(target.reqLevel) !== nextLevel
        ) {
            target.reqLevel = nextLevel;
            changed = true;
        } else if (
            force &&
            "reqLevel" in overlay &&
            !nextLevel &&
            normalizeReqLevel(target.reqLevel)
        ) {
            target.reqLevel = "";
            changed = true;
        }
    }
    return changed;
}

function findGuideMatch(list, probe) {
    if (!Array.isArray(list) || !probe) return null;
    const title = normalizeMatchTitle(probe.title);

    // Steam reutiliza o mesmo apiName em tiers (Fierce/Berserk/Doom) — preferir título
    if (probe.apiName) {
        const candidates = list.filter((item) => item.apiName && item.apiName === probe.apiName);
        if (candidates.length === 1) return candidates[0];
        if (candidates.length > 1 && title) {
            const byTitle = candidates.find(
                (item) => normalizeMatchTitle(item.title) === title
            );
            if (byTitle) return byTitle;
        }
    }

    if (title) {
        const byTitle = list.find((item) => normalizeMatchTitle(item.title) === title);
        if (byTitle) return byTitle;
    }

    const probeHash = probe.iconHash || extractIconHashFromUrl(probe.icon);
    if (probeHash) {
        const byHash = list.find(
            (item) => extractIconHashFromUrl(item.icon) === probeHash || item.iconHash === probeHash
        );
        if (byHash) return byHash;
    }
    return null;
}

function replaceGameLinksFromPack(game, packLinks) {
    if (!game || !Array.isArray(packLinks)) return 0;
    const next = [];
    for (const link of packLinks) {
        const url = String(link?.url || "").trim();
        if (!url || !/^https?:\/\//i.test(url)) continue;
        next.push({
            id: newLinkId(),
            label: String(link.label || "Link").trim() || "Link",
            url,
        });
    }
    game.links = next;
    return next.length;
}

function mergeGameLinksFromPack(game, packLinks) {
    if (!game || !Array.isArray(packLinks) || packLinks.length === 0) return 0;
    const current = getGameLinks(game);
    const existingUrls = new Set(current.map((l) => String(l.url || "").trim().toLowerCase()));
    let added = 0;
    for (const link of packLinks) {
        const url = String(link?.url || "").trim();
        if (!url || !/^https?:\/\//i.test(url)) continue;
        const key = url.toLowerCase();
        if (existingUrls.has(key)) continue;
        current.push({
            id: newLinkId(),
            label: String(link.label || "Link").trim() || "Link",
            url,
        });
        existingUrls.add(key);
        added += 1;
    }
    if (added > 0) {
        game.links = current;
        delete game.mapUrl;
    }
    return added;
}

function safePackFilename(gameName, suffix) {
    const safeName = String(gameName || "jogo")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "");
    return `${safeName || "jogo"}-${suffix}.json`;
}

function downloadJsonPack(filename, pack, game) {
    const payload = JSON.stringify(pack, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename,
            appId: game?.appId,
            name: game?.name,
            pack,
        }),
    }).catch(() => {});
}

function exportGameGuide() {
    const game = getActiveGame();
    if (!game?.appId) {
        alert("Nenhum jogo ativo para exportar.");
        return;
    }

    const overlays = sortGuideOverlays(
        achievements.map(buildGuideOverlay).filter(Boolean)
    );
    const links = getGameLinks(game);
    if (overlays.length === 0 && links.length === 0) {
        alert("Nenhuma conquista ou link para exportar neste jogo.");
        return;
    }

    const pack = {
        type: GUIDE_PACK_TYPE,
        version: GUIDE_PACK_VERSION,
        exportedAt: new Date().toISOString(),
        note: GUIDE_PACK_NOTE,
        game: {
            appId: String(game.appId),
            name: game.name || "Jogo",
            links: links.map((l) => ({
                label: l.label,
                url: l.url,
            })),
        },
        achievements: overlays,
    };

    downloadJsonPack(safePackFilename(game.name, "guia"), pack, game);
}

function readAchievementsForApp(appId) {
    const id = String(appId || "");
    if (!id) return [];
    if (id === String(activeGameAppId)) return achievements.slice();
    try {
        const raw = localStorage.getItem(achievementsKey(id));
        if (!raw) return [];
        const list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
    } catch (_) {
        return [];
    }
}

function clearAllAchievementStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("achievements_") || key === LEGACY_ACHIEVEMENTS_KEY)) {
            keys.push(key);
        }
    }
    keys.forEach((key) => localStorage.removeItem(key));
}

function buildUserProfilePack() {
    saveAchievements();
    saveGames();

    const achievementsByAppId = {};
    for (const game of games) {
        const appId = String(game.appId || "");
        if (!appId) continue;
        achievementsByAppId[appId] = readAchievementsForApp(appId);
    }

    let collapsed = {};
    try {
        collapsed = JSON.parse(localStorage.getItem(COLLAPSED_SECTIONS_KEY) || "{}") || {};
    } catch (_) {
        collapsed = {};
    }

    return {
        type: PROFILE_PACK_TYPE,
        version: PROFILE_PACK_VERSION,
        exportedAt: new Date().toISOString(),
        note: "Backup completo do perfil: jogos, guias e progresso.",
        activeGameAppId: String(activeGameAppId || ""),
        games: games.map((g) => ({ ...g })),
        achievementsByAppId,
        prefs: {
            collapsedSections: collapsed,
        },
    };
}

function exportUserProfile() {
    if (!games.length) {
        alert("Nenhum jogo no perfil para exportar.");
        return;
    }
    const pack = buildUserProfilePack();
    downloadJsonPack(`guia-conquistas-perfil-${pack.games.length}jogos.json`, pack, {
        appId: "profile",
        name: "Perfil",
    });
}

function importUserProfile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || data.type !== PROFILE_PACK_TYPE || !Array.isArray(data.games)) {
                throw new Error("Formato inválido");
            }
            if (!data.games.length) {
                alert("Backup de perfil sem jogos.");
                return;
            }

            const ok = confirm(
                `Restaurar backup completo do perfil?\n` +
                    `Isso substitui TODOS os jogos, guias e progresso locais.\n` +
                    `Jogos no arquivo: ${data.games.length}`
            );
            if (!ok) return;

            saveAchievements();
            clearAllAchievementStorage();

            games = data.games
                .map((g) => ({
                    ...g,
                    appId: String(g.appId || "").trim(),
                }))
                .filter((g) => /^\d+$/.test(g.appId));

            if (!games.length) {
                throw new Error("Nenhum appId válido no backup.");
            }

            const byApp = data.achievementsByAppId || {};
            for (const game of games) {
                const list = Array.isArray(byApp[game.appId]) ? byApp[game.appId] : [];
                localStorage.setItem(achievementsKey(game.appId), JSON.stringify(list));
            }

            const preferred = String(data.activeGameAppId || "");
            activeGameAppId = games.some((g) => g.appId === preferred)
                ? preferred
                : games[0].appId;

            if (data.prefs?.collapsedSections && typeof data.prefs.collapsedSections === "object") {
                localStorage.setItem(
                    COLLAPSED_SECTIONS_KEY,
                    JSON.stringify(data.prefs.collapsedSections)
                );
            }

            saveGames();
            lastSteamAchievements = null;
            loadAchievements();
            validateAchievements();
            saveAchievements();

            alert(
                `Perfil restaurado.\n` +
                    `Jogos: ${games.length}\n` +
                    `A página será recarregada.`
            );
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert(
                "Não foi possível importar o perfil. Use um arquivo exportado por Backup do perfil → Exportar."
            );
        } finally {
            if (importProfileFile) importProfileFile.value = "";
        }
    };
    reader.readAsText(file);
}

async function ensureGameFromPack(packGame) {
    const appId = String(packGame?.appId || "").trim();
    if (!/^\d+$/.test(appId)) {
        throw new Error("Pacote sem appId Steam válido.");
    }

    let game = games.find((g) => g.appId === appId);
    if (!game) {
        game = {
            appId,
            name: packGame.name || `App ${appId}`,
            image: "",
            archived: false,
            links: [],
        };
        games.push(game);
        saveGames();
        resolveClientIcon(game).then(() => {
            saveGames();
            renderActiveGame();
            renderGameLibrary();
        });
    } else if (packGame.name && (!game.name || game.name === `App ${appId}`)) {
        game.name = packGame.name;
    }

    if (appId !== activeGameAppId) {
        saveAchievements();
        activeGameAppId = appId;
        lastSteamAchievements = null;
        saveGames();
        loadAchievements();
        validateAchievements();
        renderActiveGame();
        renderGameLibrary();
    }

    return game;
}

async function importGameGuide(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!data || data.type !== GUIDE_PACK_TYPE || !data.game) {
                throw new Error("Formato inválido");
            }

            const game = await ensureGameFromPack(data.game);
            const linksAdded = mergeGameLinksFromPack(
                game,
                Array.isArray(data.game.links) ? data.game.links : []
            );
            saveGames();

            // Sempre busca a lista na Steam; progresso/guia local são preservados no merge.
            const steam = await importSteamAchievements(game.appId, {
                force: true,
                quiet: true,
            });
            if (!steam.ok && achievements.length === 0) {
                alert(
                    steam.error ||
                        "Não foi possível buscar as conquistas na Steam. Abra com o servidor local e tente de novo."
                );
                renderActiveGame();
                return;
            }

            const overlays = (Array.isArray(data.achievements) ? data.achievements : [])
                .map(normalizeGuideOverlayFromPack)
                .filter(Boolean);
            let withMods = 0;
            let matched = 0;
            let updated = 0;
            let unmatched = 0;
            for (const overlay of overlays) {
                // Só aplica entradas com guia preenchido — stubs/template e conquistas
                // novas da Steam (fora do pacote) ficam intactas.
                if (!hasGuideContent(overlay)) continue;
                withMods += 1;
                const target = findGuideMatch(achievements, overlay);
                if (!target) {
                    unmatched += 1;
                    continue;
                }
                matched += 1;
                if (applyGuideOverlay(target, overlay)) updated += 1;
            }

            validateAchievements();
            saveAchievements();
            renderActiveGame();
            renderAchievements();
            syncWithSteam({ silentToasts: true });

            alert(
                `Guia aplicado em ${game.name}.\n` +
                    `Com guia no arquivo: ${withMods}/${overlays.length}\n` +
                    `Atualizadas: ${updated}` +
                    (unmatched ? `\nSem correspondência (apiName): ${unmatched}` : "") +
                    (linksAdded ? `\nLinks novos: ${linksAdded}` : "") +
                    `\nProgresso da Steam preservado.`
            );
        } catch (err) {
            console.error(err);
            alert(
                "Não foi possível importar o guia. Use um arquivo exportado por Exportar neste jogo."
            );
        } finally {
            if (importGuideFile) importGuideFile.value = "";
        }
    };

    reader.readAsText(file);
}

// ==============================
// Verificação de Estrutura
// ==============================

function validateAchievements() {
    achievements.forEach(item => {
        if (item.completed === undefined) {
            item.completed = false;
        }
        if (item.completedManual === undefined) {
            item.completedManual = false;
        }
        if (!item.completed) {
            item.completedManual = false;
        }
        if (!item.description) {
            item.description = "";
        }
        if (!item.videoUrl) {
            item.videoUrl = "";
        }
        if (!item.guideUrl) {
            item.guideUrl = "";
        }
        if (!item.tips) {
            item.tips = "";
        }
        if (!item.icon) {
            item.icon = "";
        }
        if (!item.group) {
            item.group = "Sem Grupo";
        }
        if (!item.dlc) {
            item.dlc = extractDlcName(item.description) || "Jogo base";
        } else if (item.dlc === "Jogo base" || item.dlc === "Sem Grupo") {
            const fromDesc = extractDlcName(item.description);
            if (fromDesc) item.dlc = fromDesc;
        }
        item.difficulty = normalizeDifficulty(item.difficulty);
        item.missable = Boolean(item.missable);
        const reqLevel = resolveReqLevel(item);
        item.reqLevel = reqLevel;
    });
    // "Shifting Sands" e "Soulmask: Shifting Sands" viram um único grupo
    canonicalizeDlcNames(achievements);
}