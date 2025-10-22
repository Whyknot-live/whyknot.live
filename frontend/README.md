# WhyKnot Live Frontend

Base Astro project.

## Scripts
- dev: local dev server
- build: production build to `dist/`
- preview: preview built output
- check: type & config checks

## Getting Started
Install dependencies then start dev server:

```bash
npm install
npm run dev
```

Create pages in `src/pages`. Add layouts in `src/layouts` (create dir). Content Collections: see Astro docs.

## Integrations (future)
- React/Vue/Svelte islands as needed
- Image optimization
- View transitions

## Deployment
Static output currently configured. Adjust `astro.config.mjs` for adapter if using SSR or edge.

## Centralized CSS Architecture

All styles are centralized and loaded globally via the HTML head in `src/components/Head.astro`:

- `src/styles/tokens.css` — theme tokens, colors, typography, spacing, and base utilities.
- `src/styles/components/index.css` — single entry that imports all component/page CSS:
	- `layout.css`, `navigation.css`, `footer.css`, `forms.css`, `blog.css`, `pages.css`, `design-system.css`

Guidelines:
- Do not use inline `style="..."` in components/pages. Prefer utility classes or add rules to the appropriate CSS file under `src/styles/components/`.
- For page-specific but reusable patterns (legal pages, 404, etc.), use `pages.css`.
- For demo-only utilities used on the design system page, use `design-system.css` (kept minimal and generic).

Common utilities (examples):
- Visibility/loading: `.is-hidden`, `.is-loading`
- Inline icon alignment: `.icon-inline`
- Layout helpers (design system demos): `.w-60`, `.h-60`, `.w-120`, `.h-40`, `.w-180`, `.w-200`, `.w-250`, `.h-20`, `.mb-1`, `.gap-1`
- Color helpers for swatches (design system): `.bg-primary`, `.bg-secondary`, `.bg-tertiary`, `.bg-accent-300`, `.bg-blue-400`, `.bg-surface`, `.bg-surface-container[-low|-high]`, `.bg-surface-alt`, `.bg-success`, `.bg-warning`, `.bg-danger`, `.bg-info`, with text counterparts like `.text-on-primary`, `.text-on-secondary`, `.text-on-tertiary`, `.text-on-surface`, `.text-white`

How to add new styles:
1. Create or update a CSS file under `src/styles/components/` (e.g., `buttons.css` or extend `forms.css`).
2. Import it in `src/styles/components/index.css` to make it globally available.
3. Use classes in components/pages. Avoid inline styles and file-scoped `<style>` blocks.


## Styles (Centralized CSS)

- All styles are centralized in `src/styles/global.css`.
- `global.css` imports design tokens (`tokens.css`) and all component/page styles via `components/index.css`.
- The HTML head loads only this single stylesheet through `src/components/Head.astro`.

Adding/Editing styles:
- For new component/page styles, add a CSS file under `src/styles/components/` and import it in `src/styles/components/index.css` in the appropriate order.
- Avoid adding `<style>` tags inside `.astro` files or additional `<link rel="stylesheet">` entries. Keep everything flowing through `global.css`.

Notes:
- All prior inline styles across major pages/components have been extracted to the centralized CSS.
- If you find any stragglers, move them to the appropriate CSS file and replace with a class.
