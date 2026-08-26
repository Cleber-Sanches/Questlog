# Guia Conquistas — Design System (MASTER)

> Fonte: skill `ui-ux-pro-max` + tokens do app.
> Purple do template genérico **rejeitado** — marca do produto prevalece.

## Brand

| Token | Valor | Uso |
|-------|--------|-----|
| `--color-bg` | `#0a0a0a` | OLED surface |
| `--color-panel` | `#18181b` | Groups / provider cards |
| `--color-brand` | `#5c7e10` | Primary CTA |
| `--color-brand-bright` | `#8fb82e` | Active / success accent |
| `--color-text-heading` | `#fafafa` | Títulos |
| `--color-text-muted` | `#71717a` | Hints (mín. uso em contraste) |

## Tipografia

- Sans: Inter (já no app)
- Mono: JetBrains Mono (CLI paths, codes)

## Espaçamento (4-pt)

4 / 8 / 12 / 16 / 24 / 32 — mapear a `--sp-*`

## Motion

150–200ms `ease` em hover/border. Sem parallax. Respeitar `prefers-reduced-motion`.

## Stack

React + Vite + Tauri · CSS modules/global tokens (sem Tailwind neste repo).

## Checklist global

1. Hover em todos clicáveis  
2. Focus-visible  
3. Labels em forms  
4. Feedback loading/success/error em ações  
5. Sem purple/rose AI clichê  
