# Settings · Guia Conquistas

> Override do `ui-ux-pro-max` alinhado ao app real.
> **Não usar** purple neon / rose CTA do Master genérico.

## Produto

- Desktop (Tauri) · dark OLED (#0a0a0a)
- Marca: olive `#5c7e10` / bright `#8fb82e`
- Contexto: utilitário de conquistas Steam + assistente CLI local

## Estilo

- **Dark Mode OLED** (skill styles.csv) + identidade do app
- Motion baixíssimo (150ms hover)
- Sem glass glow exagerado, sem cyberpunk pure neon
- Proximidade TypeUI: outer padding > gap interno nos provider cards

## Página Settings

### Layout
- Shell idêntico ao guia (`app-shell` + sidebar-nav + page-header)
- Conteúdo max ~36rem
- Seções por proximidade, não cards genéricos soltos

### Provedores de IA
- Lista de cards com **logo SVG**, marca e blurb
- Seleção = expandir config (CLI, modelo, conta) **dentro** do card
- Cor de marca por provedor (Claude Warm, OpenCode Blue) + brand do app no check
- Rascunhos de CLI/model por provedor ao alternar
- Labels reais em todos inputs; feedback após Detectar/Login/Salvar (toast)

### Checklist (ui-ux-pro-max)
- [x] Sem emoji como ícone (Phosphor + SVG logo)
- [x] `cursor: pointer` em controles
- [x] Hover 150ms
- [x] Focus-visible ring brand
- [x] prefers-reduced-motion
- [x] Labels associados aos campos
- [ ] Contraste texto ≥ 4.5:1 em muted (usar #a1a1aa mínimo em body de card)

## Anti-padrões

- Purple AI gradients
- Floating dashboard vazio
- Segmented “texto puro” sem identidade de provider
- Placeholder-only like labels
