// Gera config/soulmask-guia-platina.json — guia platina (base + Shifting Sands).
// Fontes: Steam API, mapa DaOpa (base + DLC), TSA, guia Steam all achievements.
const fs = require("fs");
const path = require("path");
const { fetchSteamAchievements } = require("./steam-achievements.js");

const OUT = path.join(__dirname, "..", "config", "soulmask-guia-platina.json");

const MAP_BASE = "https://gamingwithdaopa.ellatha.com/soulmask/map/";
const MAP_DLC = "https://gamingwithdaopa.ellatha.com/soulmask/shifting-sands-map/";
const GUIDE_ALL =
    "https://steamcommunity.com/sharedfiles/filedetails/?id=3261512701";
const GUIDE_MAP =
    "https://steamcommunity.com/sharedfiles/filedetails/?id=3258157896";

/** Normaliza nível para o pack: "20" ou "15–50". */
function toReqLevel(level) {
    if (level == null || level === "") return undefined;
    if (Array.isArray(level) && level.length >= 2) return `${level[0]}–${level[1]}`;
    if (typeof level === "number" && Number.isFinite(level)) return String(Math.round(level));
    const s = String(level).trim();
    const range = s.match(/^(\d+)\s*[–\-]\s*(\d+)$/);
    if (range) return `${range[1]}–${range[2]}`;
    const n = s.match(/^(\d+)/);
    return n ? n[1] : undefined;
}

/** Prefixo de nível do boss/região (Soulmask Database / Playtopia). */
function lvPrefix(level) {
    const req = toReqLevel(level);
    return req ? `Nv. ${req} — ` : "";
}

/** Monta tip + nível + link do mapa certo com termo de busca (UI do DaOpa). */
function withMap(search, tip, dlc = false, level = null) {
    const map = dlc ? MAP_DLC : MAP_BASE;
    const label = dlc ? "mapa Shifting Sands" : "mapa base";
    const q = String(search || "").trim();
    const how = q
        ? ` No ${label} (botão Guia), abra a lupa e busque: "${q}".`
        : ` Use o ${label} (botão Guia) e a lupa no canto superior esquerdo.`;
    const reqLevel = toReqLevel(level);
    return {
        tips: `${lvPrefix(level)}${tip.trim()}${how}`,
        guideUrl: map,
        ...(reqLevel ? { reqLevel } : {}),
    };
}

/** Tip sem mapa, com nível recomendado. */
function withLevel(level, tip) {
    const reqLevel = toReqLevel(level);
    return {
        tips: `${lvPrefix(level)}${String(tip).trim()}`,
        ...(reqLevel ? { reqLevel } : {}),
    };
}

/**
 * @returns {{ difficulty: "easy"|"medium"|"hard", missable?: boolean }}
 */
function classifyLevel(api, group, title, desc) {
    const text = `${api} ${group} ${title} ${desc}`;
    let difficulty = "medium";

    if (/^0[1-5] ·|^07 ·/.test(group)) difficulty = "easy";
    if (/^06 ·|^08 ·|^09 ·|^10 ·|^13 ·/.test(group)) difficulty = "medium";
    if (/^11 ·|^12 ·|^14 ·|^15 ·|^16 ·|^17 ·|^18 ·|^19 ·|^20 ·|^21 ·|^22 ·/.test(group)) {
        difficulty = "hard";
    }

    if (/MianJuLevel_(10|20|30)/i.test(api)) difficulty = "easy";
    if (/MianJuLevel_(40|50)/i.test(api)) difficulty = "medium";
    if (/MianJuLevel_60|zhaoMu_100|Collect_All|YiJiDiGongFinal|ShouLie0[56]|ShiBan_/i.test(api)) {
        difficulty = "hard";
    }
    if (/ZhiZao_WenMing0[123]|JianZhu0[12]|PengRen0[12]|ManRen_(JingYing|KongZhi|MingLing|zhaoMu_3|SiWang)/i.test(api)) {
        difficulty = "easy";
    }
    if (/Fierce|Feroz|Furios/i.test(text) && !/Doom|Berserk|Furor|Destrui/i.test(text)) {
        difficulty = "medium";
    }
    if (/Berserk|Furor/i.test(text)) difficulty = "hard";
    if (/Doom|Destrui|Nv\.?\s*60|Mít/i.test(text)) difficulty = "hard";
    if (/TanSUoDian_00[67]|Vulc|Nevad|Alpine|Frost|Snow/i.test(text)) difficulty = "hard";
    if (/AJ_/i.test(api) && /Doom|Berserk/i.test(text)) difficulty = "hard";

    // TSA: Soulmask não tem missable oficial — não marcar
    return { difficulty };
}

/**
 * Curadoria completa por apiName (e por title quando a Steam reutiliza o mesmo api).
 * @type {Record<string, { group: string, tips: string, guideUrl?: string, difficulty?: string, matchTitle?: string }>}
 */
const BY_API = {
    // —— 01 Progressão (meta = Força de Consciência) ——
    BP_ChengJiu_MianJuLevel_10: {
        group: "01 · Progressão",
        ...withLevel(10, "Meta: Força de Consciência 10. XP de craft, exploração e combate — sai naturalmente no começo."),
    },
    BP_ChengJiu_MianJuLevel_20: {
        group: "01 · Progressão",
        ...withLevel(20, "Meta: Consciência 20. Continue recrutando, craftando e abrindo o mapa da Floresta Tropical."),
    },
    BP_ChengJiu_MianJuLevel_30: {
        group: "01 · Progressão",
        ...withLevel(30, "Meta: Consciência 30. Foque em bronze, base estável e primeiros chefes leves."),
    },
    BP_ChengJiu_MianJuLevel_40: {
        group: "01 · Progressão",
        ...withLevel(40, "Meta: Consciência 40. Biomas médios (pântano/colinas/planalto) com gear de ferro."),
    },
    BP_ChengJiu_MianJuLevel_50: {
        group: "01 · Progressão",
        ...withLevel(50, "Meta: Consciência 50. Aço, ruínas e world bosses aceleram o farm de XP."),
    },
    BP_ChengJiu_MianJuLevel_60: {
        group: "01 · Progressão",
        ...withLevel(60, "Meta: Consciência 60 — último patamar. Priorize endgame (neve/vulcão) e ruínas."),
    },

    // —— 02 Tribo ——
    BP_ChengJiu_ManRen_JingYing: {
        group: "02 · Tribo",
        ...withLevel(1, "No menu da tribo, atribua qualquer trabalho a um membro (colher, craft, caça, etc.)."),
    },
    BP_ChengJiu_ManRen_zhenShe_2: {
        group: "02 · Tribo",
        ...withLevel(5, "Com a máscara, dissuada 2 selvagens quase mortos (não mate) — intimidar/recrutar."),
    },
    BP_ChengJiu_ManRen_KongZhi: {
        group: "02 · Tribo",
        ...withLevel(5, "Use o controle/possessão da máscara em qualquer membro da tribo."),
    },
    BP_ChengJiu_ManRen_zhaoMu_3: {
        group: "02 · Tribo",
        ...withLevel(10, "Recrute 3 membros no total (cativeiro + conversão). Fácil nos primeiros acampamentos."),
    },
    BP_ChengJiu_ManRen_MingLing: {
        group: "02 · Tribo",
        ...withLevel(5, "Selecione um membro e emita qualquer ordem de combate/movimento."),
    },
    BP_ChengJiu_ManRen_SiWang_3: {
        group: "02 · Tribo",
        ...withLevel(10, "Deixe 3 membros morrerem (combate ou de propósito). Não trava platina."),
    },
    BP_ChengJiu_ManRen_zhaoMu_100: {
        group: "02 · Tribo",
        ...withMap(
            "Barbarian Camp",
            "Recrute 100 membros ao longo do save (não precisa manter 100 vivos). Farma camps alinhados ao seu gear.",
            false,
            [15, 50]
        ),
    },

    // —— 03 Civilização ——
    BP_ChengJiu_ZhiZao_WenMing01: {
        group: "03 · Civilização",
        ...withLevel(1, "Construa a Fogueira (Bonfire) — marco inicial do assentamento."),
    },
    BP_ChengJiu_ZhiZao_WenMing02: {
        group: "03 · Civilização",
        ...withLevel(15, "Craft: Lingote de Bronze. Desbloqueia tools/armas melhores."),
    },
    BP_ChengJiu_ZhiZao_WenMing03: {
        group: "03 · Civilização",
        ...withLevel(30, "Craft: Lingote de Ferro."),
    },
    BP_ChengJiu_ZhiZao_WenMing04: {
        group: "03 · Civilização",
        ...withLevel(45, "Craft: Lingote de Aço. Mid/endgame — ruínas e tech tree."),
    },
    BP_ChengJiu_ZhiZao_JianZhu01: {
        group: "03 · Civilização",
        ...withLevel(5, "Construa uma Fundação de Madeira."),
    },
    BP_ChengJiu_ZhiZao_JianZhu02: {
        group: "03 · Civilização",
        ...withLevel(20, "Construa uma Fundação de Pedra."),
    },
    BP_ChengJiu_ZhiZao_JianZhu03: {
        group: "03 · Civilização",
        ...withLevel(40, "Construa uma Fundação de Pedra Negra (Blackstone)."),
    },
    BP_ChengJiu_ZhiZao_JianZhu04: {
        group: "03 · Civilização",
        ...withLevel(15, "Construa um Logging Yard / Pátio de Extração de Madeira."),
    },

    // —— 04 Culinária ——
    BP_ChengJiu_ZhiZao_PengRen01: {
        group: "04 · Culinária",
        ...withLevel(1, "Cozinhe Batata Cozida (Cooked Potato)."),
    },
    BP_ChengJiu_ZhiZao_PengRen02: {
        group: "04 · Culinária",
        ...withLevel(15, "Cozinhe Bife Premium / Premium Steak."),
    },
    BP_ChengJiu_ZhiZao_PengRen03: {
        group: "04 · Culinária",
        ...withLevel(20, "Produza Tequila (estação de bebida/fermentação)."),
    },
    BP_ChengJiu_ZhiZao_PengRen04: {
        group: "04 · Culinária",
        ...withLevel(25, "Faça Anéis de Abóbora Frita (Fried Pumpkin Ring)."),
    },
    BP_ChengJiu_ZhiZao_PengRen05: {
        group: "04 · Culinária",
        ...withLevel(35, "Faça Cacau Gelado (Iced Cocoa)."),
    },

    // —— 05 Máscaras ——
    BP_ChengJiu_ZhiZao_MianJia01: {
        group: "05 · Máscaras",
        ...withLevel(20, "Desbloqueie a máscara Tocha da Eternidade (Torch of Eternity) na árvore de máscaras/alma."),
    },
    BP_ChengJiu_ZhiZao_MianJia02: {
        group: "05 · Máscaras",
        ...withLevel(55, "Desbloqueie Caminhante das Sombras (Shadow Walker) — drop da pérola do Vulcão Escaldante."),
    },
    BP_ChengJiu_ZhiZao_MianJia03: {
        group: "05 · Máscaras",
        ...withLevel(30, "Desbloqueie Marca da Selva (Wilderness Mark)."),
    },
    BP_ChengJiu_ZhiZao_MianJia04: {
        group: "05 · Máscaras",
        ...withLevel(45, "Desbloqueie Guarda de Sangue Feroz (Ironblood Guard)."),
    },
    BP_ChengJiu_ZhiZao_MianJia05: {
        group: "05 · Máscaras",
        ...withLevel(25, "Desbloqueie Instruções Táticas (Tactical Guidance)."),
    },

    // —— 06 Presas (nível = da presa) ——
    BP_ChengJiu_Kill_ShouLie01: {
        group: "06 · Presas especiais",
        ...withMap("Beast Lair", "Mate 1 Presa Verde (marcadores de caça especiais). Arco ajuda.", false, 10),
    },
    BP_ChengJiu_Kill_ShouLie02: {
        group: "06 · Presas especiais",
        ...withMap("Beast Lair", "Mate 1 Presa Azul (Rara).", false, 20),
    },
    BP_ChengJiu_Kill_ShouLie03: {
        group: "06 · Presas especiais",
        ...withMap("Beast Lair", "Mate 1 Presa Roxa (Peerless/Única).", false, 30),
    },
    BP_ChengJiu_Kill_ShouLie04: {
        group: "06 · Presas especiais",
        ...withMap("Beast Lair", "Mate 1 Presa Laranja (Lendária).", false, 40),
    },
    BP_ChengJiu_Kill_ShouLie05: {
        group: "06 · Presas especiais",
        ...withMap("Beast Lair", "Mate 1 Presa Vermelha (Mítica). Prepare gear mid/end.", false, 50),
    },
    BP_ChengJiu_Kill_ShouLie06: {
        group: "06 · Presas especiais",
        ...withMap("Beast Lair", "Mate 1 Presa Vermelha (Mítica). Endgame — consumíveis e tribo.", false, 60),
    },

    // —— 07 Fauna ——
    BP_ChengJiu_Kill_Zhu_10: {
        group: "07 · Fauna (x10)",
        ...withLevel(5, "Mate 10 perus/turkeys. Farm fácil perto da base inicial."),
    },
    BP_ChengJiu_Kill_Lang_10: {
        group: "07 · Fauna (x10)",
        ...withLevel(10, "Mate 10 onças/jaguares na selva."),
    },
    BP_ChengJiu_Kill_DaXiang_10: {
        group: "07 · Fauna (x10)",
        ...withLevel(25, "Mate 10 elefantes gigantes. Prefira distância e suporte da tribo."),
    },
    BP_ChengJiu_Kill_HuangShi_10: {
        group: "07 · Fauna (x10)",
        ...withLevel(30, "Mate 10 leões na estepe/pradaria."),
    },

    // —— 08–12 Temple Guardians: Fierce 20 / Berserk 40 / Doom 60 (Fogfrog Fierce = 30) ——
    BP_ChengJiu_Kill_JianChiHu01: {
        group: "08 · Chefes · Dente-de-sabre",
        ...withMap("Saber", "Fera Dente-de-sabre Feroz (Fierce). Esquive garras; gear bronze+.", false, 20),
    },
    BP_ChengJiu_Kill_JianChiHu02: {
        group: "08 · Chefes · Dente-de-sabre",
        ...withMap("Saber", "Versão Berserk. Arma pesada de bronze/ferro e boa defesa.", false, 40),
    },
    BP_ChengJiu_Kill_JianChiHu03: {
        group: "08 · Chefes · Dente-de-sabre",
        ...withMap("Saber", "Versão Doom. Poções + tribo de suporte.", false, 60),
    },
    BP_ChengJiu_Kill_MGW01: {
        group: "09 · Chefes · Sapo da Névoa",
        ...withMap("Fog", "Sapo da Névoa / Poison Fogfrog. Antídoto obrigatório.", false, 30),
    },
    BP_ChengJiu_Kill_MGW02: {
        group: "09 · Chefes · Sapo da Névoa",
        ...withMap("Fog", "Fogfrog Berserk. Resist veneno + dano furador.", false, 40),
    },
    BP_ChengJiu_Kill_MGW03: {
        group: "09 · Chefes · Sapo da Névoa",
        ...withMap("Fog", "Fogfrog of Doom. Prep total de veneno e ranged.", false, 60),
    },
    BP_ChengJiu_Kill_JuYuan01: {
        group: "10 · Chefes · Primata",
        ...withMap("Ape", "Primata/Vajra Ape Fierce. Escudo duro — ele pula e é rápido.", false, 20),
    },
    BP_ChengJiu_Kill_JuYuan02: {
        group: "10 · Chefes · Primata",
        ...withMap("Ape", "Ape Berserk. Gerencie Vigor/stamina.", false, 40),
    },
    BP_ChengJiu_Kill_JuYuan03: {
        group: "10 · Chefes · Primata",
        ...withMap("Ape", "Ape of Doom. Luta longa — comida e pots de stamina.", false, 60),
    },
    BP_ChengJiu_Kill_JiNiao01: {
        group: "11 · Chefes · Grifo",
        ...withMap("Griffin", "Grifo Tempestuoso Fierce. Arco é muito efetivo; armas pesadas falham.", false, 20),
    },
    BP_ChengJiu_Kill_JiNiao02: {
        group: "11 · Chefes · Grifo",
        ...withMap("Griffin", "Griffin Berserk. Force a pousar / ranged pesado.", false, 40),
    },
    BP_ChengJiu_Kill_JiNiao03: {
        group: "11 · Chefes · Grifo",
        ...withMap("Griffin", "Griffin of Doom. Endgame aéreo — flechas e mobilidade.", false, 60),
    },
    BP_ChengJiu_Kill_MMX01: {
        group: "12 · Chefes · Mamute",
        ...withMap("Mammoth", "Mamute Titã Fierce (gelo). Leve calor/fogo; combate em frio.", false, 20),
    },
    BP_ChengJiu_Kill_MMX02: {
        group: "12 · Chefes · Mamute",
        ...withMap("Mammoth", "Mamute Berserk. Não tire a proteção de frio no meio da luta.", false, 40),
    },
    BP_ChengJiu_Kill_MMX03: {
        group: "12 · Chefes · Mamute",
        ...withMap("Mammoth", "Mamute of Doom. Um dos mais duros do base — gear top + tribo.", false, 60),
    },

    // —— 13 Saqueadores ——
    BP_ChengJiu_Kill_DiMianYiJi01: {
        group: "13 · Saqueadores",
        ...withMap(
            "Western Rainforest",
            "Derrote qualquer um dos 3 Plunderer Leaders nas ruínas de chão da Floresta Tropical Oeste.",
            false,
            25
        ),
    },
    BP_ChengJiu_Kill_DiMianYiJi02: {
        group: "13 · Saqueadores",
        ...withMap(
            "Volcanic Forest",
            "Plunderer Leader nas ruínas da Floresta Vulcânica. Resist calor.",
            false,
            50
        ),
    },
    BP_ChengJiu_Kill_DiMianYiJi03: {
        group: "13 · Saqueadores",
        ...withMap(
            "Alpine Land",
            "Qualquer um dos 2 Plunderer Leaders nas ruínas do Alpine Land (neve). Resist frio.",
            false,
            60
        ),
    },

    // —— 14 Sacerdotes (nível do líder tribal — Soulmask Database) ——
    BP_ChengJiu_Kill_ZhaiZi01: {
        group: "14 · Sacerdotes tribais",
        ...withMap(
            "Eastern Rainforest",
            "Sumo Sacerdote — Floresta Tropical Leste (Quebrador de Rochas). Limpe o Barbarian Camp da região.",
            false,
            20
        ),
    },
    BP_ChengJiu_Kill_ZhaiZi02: {
        group: "14 · Sacerdotes tribais",
        ...withMap(
            "Western Rainforest",
            "Sumo Sacerdote — Floresta Tropical Oeste (Retrorrefletor). Acampamento tribal da região.",
            false,
            20
        ),
    },
    BP_ChengJiu_Kill_ZhaiZi03: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Mangrove", "Sumo Sacerdote — Mangue (Observador).", false, 25),
    },
    BP_ChengJiu_Kill_ZhaiZi04: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Pit Hill", "Sumo Sacerdote — Colina do Poço / Pit Hill (Bebedor de Sangue).", false, 30),
    },
    BP_ChengJiu_Kill_ZhaiZi05: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Lakeside Forest", "Sumo Sacerdote — Floresta à Beira do Lago (Astrólogo).", false, 50),
    },
    BP_ChengJiu_Kill_ZhaiZi06: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Table Mountain", "Sumo Sacerdote — Chapada / Table Mountain (Coração de Cobra).", false, 40),
    },
    BP_ChengJiu_Kill_ZhaiZi07: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Great Prairie", "Sumo Sacerdote — Pradaria (Osso Duro).", false, 45),
    },
    BP_ChengJiu_Kill_ZhaiZi08: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Giant Wood Forest", "Sumo Sacerdote — Floresta de Madeira Gigante (Sangrador).", false, 45),
    },
    BP_ChengJiu_Kill_ZhaiZi09: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Southern Wasteland", "Sumo Sacerdote — Deserto do Sul (Veneno). Leve antídoto.", false, 50),
    },
    BP_ChengJiu_Kill_ZhaiZi10: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Barren Meadow", "Sumo Sacerdote — Prado Árido (Matador).", false, 50),
    },
    BP_ChengJiu_Kill_ZhaiZi11: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Dark Forest", "Sumo Sacerdote — Floresta Negra (Guardião da Floresta).", false, 50),
    },
    BP_ChengJiu_Kill_ZhaiZi12: {
        group: "14 · Sacerdotes tribais",
        ...withMap("Frostleaf Grove", "Sumo Sacerdote — Bosque Frostleaf (Açougueiro). Resist frio.", false, 50),
    },
    BP_ChengJiu_Kill_ZhaiZi13: {
        group: "14 · Sacerdotes tribais",
        ...withMap(
            "Alpine Land",
            "Sumo Sacerdote — Terra Alpina (Veneno Frio). Resist frio + antídoto.",
            false,
            50
        ),
    },

    // —— 15 Ruínas (nível do guardião mecânico) ——
    BP_ChengJiu_Kill_YiJiDiGong01: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("Rift Valley", "Guardião da ruína — Vale da Fenda / Rift Valley. Limpe a dungeon.", false, 30),
    },
    BP_ChengJiu_Kill_YiJiDiGong02: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("Jungle Cave", "Guardião — Caverna da Selva / Jungle Cave.", false, 40),
    },
    BP_ChengJiu_Kill_YiJiDiGong03: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("Giant Crater", "Guardião — Cratera Gigante / Giant Crater.", false, 50),
    },
    BP_ChengJiu_Kill_YiJiDiGong04: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("Scorching Volcano", "Guardião — Vulcão Escaldante. Resist calor obrigatório.", false, 55),
    },
    BP_ChengJiu_Kill_YiJiDiGong05: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("Frost Canyon", "Guardião — Cânion Congelado / Frost Canyon. Resist frio.", false, 65),
    },
    BP_ChengJiu_Kill_YiJiDiGong06: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("River Valley", "Guardião — Vale do Rio / River Valley.", false, 25),
    },
    BP_ChengJiu_Kill_YiJiDiGong07: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("Wetland", "Guardião — Pântano / Wetland.", false, 35),
    },
    BP_ChengJiu_Kill_YiJiDiGong08: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("Northern Wasteland", "Guardião — Deserto do Norte / Northern Wasteland.", false, 45),
    },
    BP_ChengJiu_Kill_YiJiDiGong09: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap("Dark Forest", "Guardião — Floresta Negra / Dark Forest.", false, 60),
    },
    BP_ChengJiu_Kill_YiJiDiGongFinal: {
        group: "15 · Ruínas (Pérolas)",
        ...withMap(
            "Frost Canyon",
            "Núcleo Central — guardião oculto extra no Frost Canyon (além da pérola local). Endgame do base.",
            false,
            70
        ),
    },

    // —— 16 Tábuas ——
    BP_ChengJiu_ShiBan_001: {
        group: "16 · Tábuas",
        ...withMap(
            "Tablet",
            "Decifre TODAS as Tábuas Antigas. No mapa, ligue a legenda e vá marcando. Tracker: L → Trip.",
            false,
            [15, 50]
        ),
    },
    BP_ChengJiu_ShiBan_002: {
        group: "16 · Tábuas",
        ...withMap(
            "Tablet",
            "Decifre TODAS as Tábuas Sagradas/Divinas. Mid/endgame — passe por cada bioma.",
            false,
            [35, 65]
        ),
    },

    // —— 17 Exploração ——
    BP_ChengJiu_TanSUoDian_002: {
        group: "17 · Exploração",
        ...withMap(
            "Rainforest",
            "100% dos pontos de exploração da Floresta Tropical. Limpe fog of war e markers.",
            false,
            15
        ),
    },
    BP_ChengJiu_TanSUoDian_003: {
        group: "17 · Exploração",
        ...withMap("Hill", "100% exploração — Colinas / Pit Hill e entorno.", false, 25),
    },
    BP_ChengJiu_TanSUoDian_004: {
        group: "17 · Exploração",
        ...withMap("Wetland", "100% exploração — Pântano / Wetland.", false, 30),
    },
    BP_ChengJiu_TanSUoDian_005: {
        group: "17 · Exploração",
        ...withMap("Plateau", "100% exploração — Planalto / Plateau Woodland.", false, 35),
    },
    BP_ChengJiu_TanSUoDian_006: {
        group: "17 · Exploração",
        ...withMap("Volcano", "100% exploração — Vulcão. Resist calor.", false, 45),
    },
    BP_ChengJiu_TanSUoDian_007: {
        group: "17 · Exploração",
        ...withMap("Alpine", "100% exploração — Montanha Nevada / Alpine. Resist frio.", false, 50),
    },

    // —— 18 Platina base ——
    BP_ChengJiu_Collect_All: {
        group: "18 · Platina (Base)",
        ...withLevel(60, "Alma Imortal: complete TODOS os outros Trip Milestones do jogo base (90). Deixe por último. In-game: tecla L → Trip."),
        guideUrl: GUIDE_ALL,
    },
};

/** DLC Shifting Sands — chave = title normalizado */
const BY_DLC_TITLE = {
    "fierce sobek crocodile": {
        group: "19 · DLC · Chefes (Sobek)",
        ...withMap("Sobek", "Sobek Fierce (1/3). Gear de deserto; farma lair/arena do DLC.", true, 20),
    },
    "berserk sobek crocodile": {
        group: "19 · DLC · Chefes (Sobek)",
        ...withMap("Sobek", "Sobek Berserk (2/3). Mais agressivo — pots e tribo.", true, 40),
    },
    "sobek crocodile of doom": {
        group: "19 · DLC · Chefes (Sobek)",
        ...withMap("Sobek", "Sobek of Doom (3/3). Tier final — gear top do DLC.", true, 60),
    },
    "fierce anubis hound": {
        group: "19 · DLC · Chefes (Anubis)",
        ...withMap("Anubis", "Anubis Hound Fierce (1/3). Combate corpo/rápido.", true, 20),
    },
    "berserk anubis hound": {
        group: "19 · DLC · Chefes (Anubis)",
        ...withMap("Anubis", "Anubis Hound Berserk (2/3).", true, 40),
    },
    "anubis hound of doom": {
        group: "19 · DLC · Chefes (Anubis)",
        ...withMap("Anubis", "Anubis Hound of Doom (3/3).", true, 60),
    },
    "fierce onyx scarab": {
        group: "19 · DLC · Chefes (Scarab)",
        ...withMap("Scarab", "Onyx Scarab Fierce (1/3).", true, 20),
    },
    "berserk onyx scarab": {
        group: "19 · DLC · Chefes (Scarab)",
        ...withMap("Scarab", "Onyx Scarab Berserk (2/3).", true, 40),
    },
    "onyx scarab of doom": {
        group: "19 · DLC · Chefes (Scarab)",
        ...withMap("Scarab", "Onyx Scarab of Doom (3/3).", true, 60),
    },
    toughbone: {
        group: "20 · DLC · Líderes tribais",
        ...withMap("River Delta", "Líder tribal — River Delta (Toughbone).", true, 30),
    },
    ironfoot: {
        group: "20 · DLC · Líderes tribais",
        ...withMap("Moon Bay", "Líder tribal — Moon Bay (Ironfoot).", true, 30),
    },
    sharpskull: {
        group: "20 · DLC · Líderes tribais",
        ...withMap("Rock Lake", "Líder tribal — Rock Lake (Sharpskull).", true, 30),
    },
    moltenpalm: {
        group: "20 · DLC · Líderes tribais",
        ...withMap("Darkriver", "Líder tribal — Darkriver Valley (Moltenpalm).", true, 30),
    },
    stoneclaw: {
        group: "20 · DLC · Líderes tribais",
        ...withMap("Three River", "Líder tribal — Three River Junction (Stoneclaw).", true, 30),
    },
    bloodfang: {
        group: "20 · DLC · Líderes tribais",
        ...withMap("Rockhenge", "Líder tribal — Rockhenge Desert (Bloodfang).", true, 30),
    },
    spikebone: {
        group: "20 · DLC · Líderes tribais",
        ...withMap("Sandcry", "Líder tribal — Sandcry Gorge (Spikebone).", true, 30),
    },
    scareye: {
        group: "20 · DLC · Líderes tribais",
        ...withMap("Star Plain", "Líder tribal — Star Plain (Scareye).", true, 30),
    },
    transmuter: {
        group: "21 · DLC · Guardiões",
        ...withMap("Coastal Dunes", "Guardião de ruína de superfície — Coastal Dunes (Transmuter).", true, 40),
    },
    sandburier: {
        group: "21 · DLC · Guardiões",
        ...withMap("Sunken City", "Guardião — Sunken City (Sandburier).", true, 40),
    },
    "king of red sand": {
        group: "21 · DLC · Guardiões",
        ...withMap("Red Dunes", "Guardião — Red Dunes (King of Red Sand).", true, 50),
    },
    "king of wilderness": {
        group: "21 · DLC · Guardiões",
        ...withMap("Star Plain", "Guardião da pirâmide — Star Plain (King of Wilderness).", true, 50),
    },
    "king of fiery flames": {
        group: "21 · DLC · Guardiões",
        ...withMap(
            "Burning Highland",
            "Guardião da pirâmide — Burning Highland (King of Fiery Flames).",
            true,
            50
        ),
    },
    patroller: {
        group: "21 · DLC · Guardiões",
        ...withMap("Wind-eroded", "Guardião de dungeon — Wind-eroded Dunes (Patroller).", true, 40),
    },
    observer: {
        group: "21 · DLC · Guardiões",
        ...withMap("Scorching Desert", "Guardião de dungeon — Scorching Desert (Observer).", true, 40),
    },
    trailblazer: {
        group: "21 · DLC · Guardiões",
        ...withMap(
            "Blackstone Cliff",
            "Guardião — Blackstone Cliff Ancient Ruins (Trailblazer).",
            true,
            55
        ),
    },
    destroyer: {
        group: "21 · DLC · Guardiões",
        ...withMap("Sulfur Pool", "Guardião Holy Ruins — Sulfur Pool (Destroyer).", true, 55),
    },
    huntsman: {
        group: "21 · DLC · Guardiões",
        ...withMap("Eye of Sands", "Guardião Holy Ruins — Eye of Sands (Huntsman).", true, 55),
    },
    "divine punishment": {
        group: "21 · DLC · Guardiões",
        ...withMap(
            "Burning Highland",
            "Guardião Holy Ruins — Burning Highland (Divine Punishment).",
            true,
            60
        ),
    },
    "rise in the shifting sands": {
        group: "22 · Platina (DLC)",
        ...withLevel(60, "Complete TODOS os outros Trip Milestones do DLC Shifting Sands (28) e deixe este por último."),
        guideUrl: MAP_DLC,
    },
};

function normTitle(t) {
    return String(t || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function resolveMeta(a) {
    const api = a.apiName || "";
    const titleKey = normTitle(a.title);
    const isDlc = a.dlc && a.dlc !== "Jogo base";

    if (isDlc && BY_DLC_TITLE[titleKey]) {
        return BY_DLC_TITLE[titleKey];
    }
    if (BY_API[api]) return BY_API[api];

    if (isDlc) {
        if (/AJ_ZhaiZi/i.test(api)) {
            return {
                group: "20 · DLC · Líderes tribais",
                ...withMap(
                    "Barbarian",
                    "Derrote o líder tribal da região indicada na descrição.",
                    true,
                    30
                ),
            };
        }
        if (/AJ_YiJi/i.test(api)) {
            return {
                group: "21 · DLC · Guardiões",
                ...withMap(
                    "Ruins",
                    "Limpe a ruína/pirâmide/Holy Ruins e mate o guardião final.",
                    true,
                    40
                ),
            };
        }
        return {
            group: "19 · DLC · Shifting Sands",
            ...withMap("", "Conquista do DLC Shifting Sands — siga a descrição do marco.", true, 30),
        };
    }

    if (/ZhaiZi/i.test(api)) {
        return {
            group: "14 · Sacerdotes tribais",
            ...withMap("Barbarian Camp", "Derrote o Sumo Sacerdote do bioma da descrição.", false, 20),
        };
    }
    if (/YiJiDiGong/i.test(api)) {
        return {
            group: "15 · Ruínas (Pérolas)",
            ...withMap("Ruins", "Derrote o Guardião da ruína antiga indicada.", false, 30),
        };
    }

    return {
        group: "00 · Geral",
        ...withLevel(
            null,
            a.description
                ? `Siga a descrição: ${String(a.description).replace(/\(Requires DLC:[^)]+\)/i, "").trim()}`
                : "Complete o marco descrito na conquista."
        ),
    };
}

async function main() {
    const { achievements } = await fetchSteamAchievements(2646460);
    const overlays = [];
    const seenTitles = new Set();

    for (const a of achievements) {
        const titleKey = normTitle(a.title);
        // Steam às vezes lista o mesmo api 3x (Fierce/Berserk/Doom) — manter todos por título
        const dedupeKey = `${a.apiName || ""}::${titleKey}`;
        if (seenTitles.has(dedupeKey)) continue;
        seenTitles.add(dedupeKey);

        const meta = resolveMeta(a);
        const level = classifyLevel(
            a.apiName || "",
            meta.group,
            a.title,
            a.description || ""
        );

        const reqLevel =
            toReqLevel(meta.reqLevel) ||
            (() => {
                const m = String(meta.tips || "").match(/^Nv\.\s*(\d+(?:\s*[–\-]\s*\d+)?)/i);
                return m ? toReqLevel(m[1]) : undefined;
            })();

        overlays.push({
            apiName: a.apiName || undefined,
            title: a.title,
            group: meta.group,
            tips: meta.tips,
            guideUrl: meta.guideUrl || undefined,
            dlc: a.dlc && a.dlc !== "Jogo base" ? a.dlc : undefined,
            difficulty: level.difficulty,
            missable: false,
            ...(reqLevel ? { reqLevel } : {}),
        });
    }

    const pack = {
        type: "guia-conquistas-pack",
        version: 2,
        exportedAt: new Date().toISOString(),
        game: {
            appId: "2646460",
            name: "Soulmask",
            links: [
                { label: "Mapa base (DaOpa)", url: MAP_BASE },
                { label: "Mapa Shifting Sands", url: MAP_DLC },
                { label: "Guia: todas as conquistas", url: GUIDE_ALL },
                { label: "Guia: mapa interativo", url: GUIDE_MAP },
                {
                    label: "Conquistas Steam",
                    url: "https://steamcommunity.com/stats/2646460/achievements/?l=brazilian",
                },
                {
                    label: "TrueSteamAchievements",
                    url: "https://truesteamachievements.com/game/Soulmask/achievements",
                },
            ],
        },
        achievements: overlays,
        note: "Guia platina Soulmask v2 — grupos, dicas e mapa. Progresso vem da Steam.",
    };

    const json = JSON.stringify(pack, null, 2);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, json, "utf8");
    const exportCopy = path.join(
        process.env.USERPROFILE || "",
        "Downloads",
        "soulmask-guia.json"
    );
    try {
        fs.writeFileSync(exportCopy, json, "utf8");
        console.log(`Cópia: ${exportCopy}`);
    } catch (_) {
        /* pasta Downloads pode não existir */
    }
    console.log(`OK: ${overlays.length} conquistas → ${OUT}`);
    const withLv = overlays.filter((o) => /^Nv\./.test(o.tips || "")).length;
    console.log(`Com Nv. nas dicas: ${withLv}/${overlays.length}`);

    const counts = {};
    let withMapCount = 0;
    for (const o of overlays) {
        counts[o.group] = (counts[o.group] || 0) + 1;
        if (o.guideUrl) withMapCount += 1;
    }
    Object.keys(counts)
        .sort()
        .forEach((g) => console.log(String(counts[g]).padStart(3), g));
    console.log(`Com guideUrl/mapa: ${withMapCount}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
