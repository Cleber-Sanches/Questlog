//! Router de intenção: detecta o pedido e define ferramenta + escopo de contexto.
//! Evita mandar o guia inteiro ao modelo quando só uma ação é necessária.

use crate::db::repos::Achievement;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tool {
    Ask,
    Tips,
    Missable,
    Difficulty,
    Groups,
    Levels,
    Videos,
    FullEnrich,
}

#[derive(Debug, Clone)]
pub struct IntentPlan {
    pub tools: Vec<Tool>,
    pub primary: Tool,
    /// Cobrir o guia inteiro (só com sinal explícito).
    pub full_guide: bool,
    /// Refazer grupos existentes (não só os sem grupo).
    pub redo_groups: bool,
    /// Só vídeos: resolve no app sem chamar o modelo.
    pub skip_model: bool,
    pub catalog_cap: usize,
    pub chunk_size: usize,
    pub agentic: bool,
    pub effort: &'static str,
    pub label: &'static str,
    pub detail: String,
}

impl IntentPlan {
    pub fn includes(&self, tool: Tool) -> bool {
        self.tools.contains(&tool)
    }

    pub fn wants_videos(&self) -> bool {
        self.includes(Tool::Videos)
    }

    pub fn wants_levels(&self) -> bool {
        self.includes(Tool::Levels)
    }

    pub fn allowed_patch_fields(&self) -> &'static [&'static str] {
        match self.primary {
            Tool::Ask => &["tips", "guideUrl", "videoUrl", "group", "difficulty", "missable", "reqLevel"],
            Tool::Tips => &["tips", "guideUrl"],
            Tool::Missable => &["missable"],
            Tool::Difficulty => &["difficulty", "missable"],
            Tool::Groups => &["group"],
            Tool::Levels => &["reqLevel"],
            Tool::Videos => &["videoUrl"],
            Tool::FullEnrich => &[
                "tips", "guideUrl", "videoUrl", "group", "difficulty", "missable", "reqLevel", "dlc",
            ],
        }
    }

    pub fn focus_instructions(&self) -> &'static str {
        match self.primary {
            Tool::Ask => {
                "Foque em responder a dúvida. Só emita patches se o usuário pedir alteração."
            }
            Tool::Tips => {
                "Ferramenta: DICAS. Preencha tips (e guideUrl se achar) só nas conquistas do catálogo sem dica. Não altere vídeo, grupo, nível ou dificuldade."
            }
            Tool::Missable => {
                "Ferramenta: PERDÍVEIS. Defina missable true/false. \
                 reply: UMA frase curta no final (quantas perdíveis e o porquê geral). Sem listar lote a lote."
            }
            Tool::Difficulty => {
                "Ferramenta: DIFICULDADE. Classifique só com título/descrição do catálogo (easy|medium|hard). \
                 NÃO pesquise na web. Seja consistente. Opcional: missable. Não altere tips, vídeo, grupo ou nível."
            }
            Tool::Groups => {
                "Ferramenta: GRUPOS. Atribua group temático e claro (ex.: História, Combate, Coleta, Exploração, Multijogador). \
                 PROIBIDO usar nomes genéricos: Outras, Outros, Diversos, Geral, Misc, Variados, Sem categoria. \
                 Se forem poucas, ainda assim use um tema real do jogo. Não altere tips, vídeo, dificuldade ou nível."
            }
            Tool::Levels => {
                "Ferramenta: NÍVEIS. Preencha reqLevel SÓ se título/descrição citarem nível explícito \
                 (ex.: \"nível 20\", \"level 15-30\"). reqLevel deve ser string (\"20\"). \
                 PROIBIDO inventar por progressão típica ou nível máximo do jogo. \
                 Se não houver dado no texto, patches vazio e diga isso em uma frase."
            }
            Tool::Videos => {
                "Ferramenta: VÍDEOS. Liste apiNames que precisam de vídeo; omita videoUrl (o app busca no YouTube)."
            }
            Tool::FullEnrich => {
                "Ferramenta: ENRIQUECER GUIA. Preencha o que faltar em cada conquista do lote."
            }
        }
    }
}

fn q(msg: &str) -> String {
    msg.trim().to_ascii_lowercase()
}

fn has_any(q: &str, needles: &[&str]) -> bool {
    needles.iter().any(|n| q.contains(n))
}

/// Continuação de cobertura (“completa o que falta”) — NÃO é enrich do guia inteiro.
fn is_gap_continue(q: &str) -> bool {
    has_any(
        q,
        &[
            "o que falta",
            "que faltam",
            "que falta",
            "só nos vazios",
            "so nos vazios",
            "nos vazios",
            "outra passada",
            "o restante",
            "o resto que falta",
        ],
    ) || (q.contains("completa") && (q.contains("falta") || q.contains("vazio")))
        || (q.contains("completar") && (q.contains("falta") || q.contains("vazio")))
}

fn wants_explicit_all(q: &str) -> bool {
    // "Completa o que falta" NÃO deve virar FullEnrich (vira dicas e bagunça o fluxo de vídeos).
    if is_gap_continue(q) {
        return false;
    }
    has_any(
        q,
        &[
            "todas",
            "todos",
            "tudo",
            "completo",
            "completa",
            "completas",
            "cobrir",
            "guia inteiro",
            "guia completo",
            "enriquec",
            "lote",
        ],
    )
}

/// Infere a ferramenta a partir do histórico recente (última Cobertura / pedido).
pub fn infer_gap_tool_from_context(context: &str) -> Option<Tool> {
    let c = q(context);
    // Ordem: o mais específico / recente no texto ganha (varre por prioridade de menção).
    // Preferir o último sinal forte no contexto.
    let checks: &[(Tool, &[&str])] = &[
        (
            Tool::Videos,
            &[
                "sem vídeo",
                "sem video",
                "com vídeo",
                "com video",
                "vídeos que faltam",
                "videos que faltam",
                "vídeos do youtube",
                "videos do youtube",
                "ferramenta: vídeos",
                "ferramenta: videos",
            ],
        ),
        (
            Tool::Levels,
            &[
                "sem nível",
                "sem nivel",
                "com nível",
                "com nivel",
                "níveis que faltam",
                "niveis que faltam",
                "ferramenta: níveis",
                "ferramenta: niveis",
            ],
        ),
        (
            Tool::Tips,
            &[
                "sem dica",
                "com dicas",
                "dicas que faltam",
                "ferramenta: dicas",
            ],
        ),
        (
            Tool::Groups,
            &["sem grupo", "com grupo", "ferramenta: grupos", "agrupar"],
        ),
        (
            Tool::Difficulty,
            &["com dificuldade", "sem dificuldade", "ferramenta: dificuldade"],
        ),
        (
            Tool::Missable,
            &["perdív", "missable", "ferramenta: perdíveis", "ferramenta: perdiveis"],
        ),
    ];

    // Pega a ocorrência mais ao final do contexto (última Cobertura / turno).
    let mut best: Option<(usize, Tool)> = None;
    for (tool, needles) in checks {
        for n in *needles {
            if let Some(idx) = c.rfind(n) {
                if best.map(|(i, _)| idx >= i).unwrap_or(true) {
                    best = Some((idx, *tool));
                }
            }
        }
    }
    best.map(|(_, t)| t)
}

fn detect_videos(q: &str) -> bool {
    has_any(
        q,
        &[
            "youtube",
            "vídeo",
            "video",
            "videos",
            "vídeos",
            "clip",
            "assist",
        ],
    )
}

fn detect_levels(q: &str) -> bool {
    has_any(
        q,
        &[
            "nível",
            "nivel",
            "níveis",
            "niveis",
            "level",
            "levels",
            "reqlevel",
            "req level",
        ],
    )
}

fn detect_groups(q: &str) -> bool {
    has_any(
        q,
        &[
            "agrupar",
            "agrupa",
            "grupo",
            "grupos",
            "categoriz",
            "categoria",
            "organizar por",
            "reorganizar",
            "refazer grupo",
            "refazer os grupo",
            "refazer grupo",
        ],
    ) || (q.contains("refazer") && q.contains("grupo"))
        || (q.contains("organizar") && (q.contains("grupo") || q.contains("conquista")))
}

fn detect_missable(q: &str) -> bool {
    has_any(q, &["perdív", "perdiv", "missable", "missáveis", "missaveis"])
}

fn detect_difficulty(q: &str) -> bool {
    has_any(
        q,
        &[
            "dificuld",
            "classific",
            "easy",
            "medium",
            "hard",
            "fácil",
            "facil",
            "difícil",
            "dificil",
        ],
    )
}

fn detect_tips(q: &str) -> bool {
    has_any(
        q,
        &[
            "dica",
            "dicas",
            "tips",
            "guia de",
            "como fazer",
            "como desbloquear",
            "walkthrough",
        ],
    )
}

fn has_mentions(msg: &str) -> bool {
    msg.contains("@[")
}

/// Detecta a intenção principal e monta o plano de ferramentas/contexto.
pub fn detect_intent(user_msg: &str) -> IntentPlan {
    detect_intent_with_context(user_msg, "")
}

/// Igual a `detect_intent`, mas usa histórico recente para “completa o que falta”.
pub fn detect_intent_with_context(user_msg: &str, recent_context: &str) -> IntentPlan {
    let ql = q(user_msg);
    let mentions = has_mentions(user_msg);
    let gap_continue = is_gap_continue(&ql);
    let explicit_all = wants_explicit_all(&ql) && !(mentions && !has_any(&ql, &["todas", "todos", "tudo", "resto"]));

    let videos = detect_videos(&ql);
    let levels = detect_levels(&ql);
    let groups = detect_groups(&ql);
    let missable = detect_missable(&ql);
    let difficulty = detect_difficulty(&ql);
    let tips = detect_tips(&ql);
    let redo_groups = groups
        && has_any(
            &ql,
            &["refazer", "reorganiz", "do zero", "novamente", "de novo", "reset"],
        );

    let mut tools: Vec<Tool> = Vec::new();
    if videos {
        tools.push(Tool::Videos);
    }
    if levels {
        tools.push(Tool::Levels);
    }
    if groups {
        tools.push(Tool::Groups);
    }
    if missable {
        tools.push(Tool::Missable);
    }
    if difficulty {
        tools.push(Tool::Difficulty);
    }
    if tips {
        tools.push(Tool::Tips);
    }

    // “Completa o que falta” sem campo: herda a ferramenta da última Cobertura / pedido.
    if gap_continue && tools.is_empty() {
        if let Some(t) = infer_gap_tool_from_context(recent_context)
            .or_else(|| infer_gap_tool_from_context(user_msg))
        {
            tools.push(t);
        }
        // Sem contexto: fica vazio; chat.rs pode sugerir pelo estado do guia.
    }

    // Enrich explícito sobrescreve (nunca em gap-continue)
    if explicit_all
        && !videos
        && !levels
        && !groups
        && tools.is_empty()
    {
        tools.push(Tool::FullEnrich);
    } else if explicit_all && tools.is_empty() {
        tools.push(Tool::FullEnrich);
    }

    if tools.is_empty() {
        tools.push(Tool::Ask);
    }

    // Primary: prioridade de ação estruturada
    let primary = if tools.contains(&Tool::FullEnrich) {
        Tool::FullEnrich
    } else if tools.contains(&Tool::Videos) && tools.len() == 1 {
        Tool::Videos
    } else if tools.contains(&Tool::Groups) {
        Tool::Groups
    } else if tools.contains(&Tool::Levels) {
        Tool::Levels
    } else if tools.contains(&Tool::Missable) {
        Tool::Missable
    } else if tools.contains(&Tool::Difficulty) {
        Tool::Difficulty
    } else if tools.contains(&Tool::Tips) {
        Tool::Tips
    } else if tools.contains(&Tool::Videos) {
        Tool::Videos
    } else {
        Tool::Ask
    };

    let skip_model = primary == Tool::Videos && tools.len() == 1;

    let (catalog_cap, chunk_size, agentic, effort, full_guide, label) = match primary {
        // Ask: pouco contexto, sem agentic (rápido)
        Tool::Ask => (12usize, 12, false, "low", false, "Resposta"),
        // Dicas: cobre todas sem dica (em lotes); web se precisar
        Tool::Tips => (10_000, 12, true, "medium", true, "Dicas"),
        // Perdíveis: todas as pendentes, em lotes
        // Perdíveis: classifica localmente (mundo aberto etc.) — sem web; cobre todas em lotes
        Tool::Missable => (10_000, 20, false, "low", true, "Perdíveis"),
        // Dificuldade: todas sem classificação
        Tool::Difficulty => (10_000, 20, false, "low", true, "Dificuldade"),
        // Grupos: todas sem grupo (ou todas se refazer) — não corta em 24
        Tool::Groups => (
            10_000,
            20,
            false,
            "low",
            true,
            if redo_groups {
                "Refazer grupos"
            } else {
                "Agrupar"
            },
        ),
        // Níveis: todas sem nível
        Tool::Levels => (10_000, 16, true, "medium", true, "Níveis"),
        // Vídeos: todas sem vídeo (resolve no YouTube)
        Tool::Videos => (10_000, 20, false, "low", true, "Vídeos YouTube"),
        Tool::FullEnrich => (10_000, 12, true, "medium", true, "Enriquecer guia"),
    };

    let scope_hint = match primary {
        Tool::Ask => "subset relevante",
        Tool::Tips => "só sem dica",
        Tool::Missable => "para classificar perdível",
        Tool::Difficulty => "sem dificuldade / a revisar",
        Tool::Groups if redo_groups => "todas (refazer)",
        Tool::Groups => "só sem grupo",
        Tool::Levels => "só sem nível",
        Tool::Videos => "só sem vídeo",
        Tool::FullEnrich => "guia completo",
    };

    let tools_names: Vec<&str> = tools
        .iter()
        .map(|t| match t {
            Tool::Ask => "Resposta",
            Tool::Tips => "Dicas",
            Tool::Missable => "Perdíveis",
            Tool::Difficulty => "Dificuldade",
            Tool::Groups => "Grupos",
            Tool::Levels => "Níveis",
            Tool::Videos => "Vídeos",
            Tool::FullEnrich => "Enrich",
        })
        .collect();

    IntentPlan {
        tools,
        primary,
        full_guide,
        redo_groups,
        skip_model,
        catalog_cap,
        chunk_size,
        agentic,
        effort,
        label,
        detail: format!("{} · {}", tools_names.join(" + "), scope_hint),
    }
}

fn needs_tips(a: &Achievement) -> bool {
    a.tips.as_deref().unwrap_or("").trim().is_empty()
}

fn needs_video(a: &Achievement) -> bool {
    let u = a.video_url.as_deref().unwrap_or("").trim();
    u.is_empty()
        || u.contains("youtube.com/results")
        || u.contains("search_query")
        || !(u.contains("youtube.com/watch") || u.contains("youtu.be/"))
}

fn needs_level(a: &Achievement) -> bool {
    a.req_level.as_deref().unwrap_or("").trim().is_empty()
}

/// Quando “completa o que falta” vem sem contexto: prioriza o maior buraco do guia.
pub fn suggest_gap_tool(achievements: &[Achievement]) -> Option<Tool> {
    let videos = achievements.iter().filter(|a| needs_video(a)).count();
    let tips = achievements.iter().filter(|a| needs_tips(a)).count();
    let levels = achievements.iter().filter(|a| needs_level(a)).count();
    let groups = achievements
        .iter()
        .filter(|a| is_placeholder_group(a.group.as_deref().unwrap_or("")))
        .count();

    let mut ranked = [
        (videos, Tool::Videos),
        (tips, Tool::Tips),
        (levels, Tool::Levels),
        (groups, Tool::Groups),
    ];
    ranked.sort_by(|a, b| b.0.cmp(&a.0));
    ranked.into_iter().find(|(n, _)| *n > 0).map(|(_, t)| t)
}

fn needs_difficulty(a: &Achievement) -> bool {
    a.difficulty.as_deref().unwrap_or("").trim().is_empty()
}

pub(crate) fn is_placeholder_group(g: &str) -> bool {
    crate::steam::keys::is_placeholder_group(g)
        || {
            let low = g.trim().to_ascii_lowercase();
            low == "sem grupo"
                || low == "semgrupo"
                || low == "ungrouped"
                || low == "none"
                || low == "n/a"
                || low == "-"
        }
}

fn needs_group(a: &Achievement) -> bool {
    is_placeholder_group(a.group.as_deref().unwrap_or(""))
}

fn mention_matches(a: &Achievement, msg: &str) -> bool {
    let re = match regex::Regex::new(r"@\[([^\]]+)\](?:\(([^)]+)\))?") {
        Ok(r) => r,
        Err(_) => return false,
    };
    for cap in re.captures_iter(msg) {
        let title = cap.get(1).map(|m| m.as_str().trim()).unwrap_or("");
        let api = cap.get(2).map(|m| m.as_str().trim()).filter(|s| !s.is_empty());
        if let Some(api) = api {
            if a.api_name.as_deref() == Some(api) {
                return true;
            }
        }
        if !title.is_empty() && a.title.eq_ignore_ascii_case(title) {
            return true;
        }
    }
    false
}

fn difficulty_rank(a: &Achievement) -> u8 {
    match a.difficulty.as_deref().unwrap_or("") {
        "hard" => 0,
        "medium" => 1,
        "easy" => 2,
        _ => 3,
    }
}

/// Seleciona só as conquistas necessárias para a ferramenta detectada.
pub fn select_targets<'a>(
    achievements: &'a [Achievement],
    user_msg: &str,
    plan: &IntentPlan,
) -> Vec<&'a Achievement> {
    let ql = q(user_msg);
    let mentioned_only = has_mentions(user_msg)
        && !has_any(&ql, &["todas", "todos", "tudo", "resto", "outras"]);

    let mut pool: Vec<&Achievement> = if mentioned_only {
        achievements
            .iter()
            .filter(|a| mention_matches(a, user_msg))
            .collect()
    } else {
        achievements.iter().collect()
    };

    if pool.is_empty() {
        pool = achievements.iter().collect();
    }

    let mut filtered: Vec<&Achievement> = match plan.primary {
        Tool::Ask => {
            // Top por relevância textual simples + gaps
            let mut scored: Vec<(i32, &Achievement)> = pool
                .into_iter()
                .map(|a| {
                    let mut s = 0i32;
                    let title = a.title.to_ascii_lowercase();
                    for word in ql.split_whitespace().filter(|w| w.len() > 3) {
                        if title.contains(word) {
                            s += 30;
                        }
                    }
                    if mention_matches(a, user_msg) {
                        s += 200;
                    }
                    if needs_tips(a) {
                        s += 5;
                    }
                    (s, a)
                })
                .collect();
            scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.title.cmp(&b.1.title)));
            scored.into_iter().map(|(_, a)| a).collect()
        }
        Tool::Tips => pool.into_iter().filter(|a| needs_tips(a)).collect(),
        Tool::Missable => {
            // Prioriza sem revisão clara (sem dificuldade) e as hard
            let mut v: Vec<&Achievement> = pool;
            v.sort_by_key(|a| {
                (
                    if needs_difficulty(a) { 0u8 } else { 1 },
                    difficulty_rank(a),
                    a.title.clone(),
                )
            });
            v
        }
        Tool::Difficulty => pool
            .into_iter()
            .filter(|a| needs_difficulty(a))
            .collect(),
        Tool::Groups => {
            if plan.redo_groups {
                let mut v: Vec<&Achievement> = pool;
                v.sort_by_key(|a| (difficulty_rank(a), a.title.clone()));
                v
            } else {
                pool.into_iter().filter(|a| needs_group(a)).collect()
            }
        }
        Tool::Levels => pool.into_iter().filter(|a| needs_level(a)).collect(),
        Tool::Videos => {
            let mut v: Vec<&Achievement> = pool.into_iter().filter(|a| needs_video(a)).collect();
            v.sort_by_key(|a| {
                (
                    if mention_matches(a, user_msg) { 0u8 } else { 1 },
                    difficulty_rank(a),
                    if a.missable { 0u8 } else { 1 },
                    a.title.clone(),
                )
            });
            v
        }
        Tool::FullEnrich => {
            let mut v: Vec<&Achievement> = pool;
            v.sort_by_key(|a| {
                (
                    if mention_matches(a, user_msg) { 0u8 } else { 1 },
                    difficulty_rank(a),
                    a.title.clone(),
                )
            });
            v
        }
    };

    // Se o filtro zerar: Ask usa sample geral; tools de gap = nada a fazer (não joga o guia inteiro)
    if filtered.is_empty() {
        return if plan.primary == Tool::Ask {
            let mut v: Vec<&Achievement> = achievements.iter().collect();
            v.truncate(plan.catalog_cap.max(1));
            v
        } else {
            Vec::new()
        };
    }

    let cap = if plan.full_guide {
        filtered.len()
    } else {
        plan.catalog_cap.min(filtered.len()).max(1)
    };
    filtered.truncate(cap.min(filtered.len()));
    filtered
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_videos_only() {
        let p = detect_intent("Sugere vídeos do YouTube para as mais difíceis");
        assert_eq!(p.primary, Tool::Videos);
        assert!(p.skip_model);
        // Vídeos sem link: cobre o que faltar (pode ser em lotes)
        assert!(p.full_guide);
    }

    #[test]
    fn detects_groups_covers_all_without_group() {
        let p = detect_intent("Agrupa as conquistas que ainda não têm grupo");
        assert_eq!(p.primary, Tool::Groups);
        assert!(!p.redo_groups);
        // Precisa cobrir TODAS sem grupo — não parar em 24
        assert!(p.full_guide);
        assert!(p.catalog_cap >= 100);
    }

    #[test]
    fn needs_group_treats_placeholder() {
        assert!(is_placeholder_group("Sem Grupo"));
        assert!(is_placeholder_group("sem grupo"));
        assert!(is_placeholder_group(""));
        assert!(is_placeholder_group("  "));
        assert!(!is_placeholder_group("História"));
        assert!(!is_placeholder_group("Coleta e Exploração"));
    }

    #[test]
    fn detects_redo_groups() {
        let p = detect_intent("Refaz os grupos do zero");
        assert_eq!(p.primary, Tool::Groups);
        assert!(p.redo_groups);
    }

    #[test]
    fn ask_does_not_full_pass() {
        let p = detect_intent("O que precisa para a conquista X?");
        assert_eq!(p.primary, Tool::Ask);
        assert!(!p.full_guide);
        assert!(p.catalog_cap <= 20);
    }

    #[test]
    fn completa_o_que_falta_does_not_full_enrich() {
        let p = detect_intent("Completa o que falta");
        assert_ne!(p.primary, Tool::FullEnrich);
    }

    #[test]
    fn completa_o_que_falta_inherits_videos_from_context() {
        let ctx = "### Cobertura\n\n- **Com vídeo:** 45 de 57\n\nAinda faltam **12** sem vídeo.";
        let p = detect_intent_with_context("Completa o que falta", ctx);
        assert_eq!(p.primary, Tool::Videos);
        assert!(p.skip_model);
    }

    #[test]
    fn completa_videos_que_faltam() {
        let p = detect_intent("Completa os vídeos que faltam");
        assert_eq!(p.primary, Tool::Videos);
    }

    #[test]
    fn completa_dicas_que_faltam() {
        let p = detect_intent("Completa as dicas que faltam");
        assert_eq!(p.primary, Tool::Tips);
    }
}
