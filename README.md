# Portfolio Terminal

A terminal-style portfolio with a 2D platformer game, markdown-driven content, and swappable themes.

![layout](https://img.shields.io/badge/layout-sidebar%20%2B%20preview%20%2B%20terminal-blue)

## Quick Start

```bash
git clone <repo>
cd portfolio

# 1. copy example content into content/
cp -r content-example/* content/

# 2. install deps
npm install

# 3. start the dev server
npm run dev
# → http://localhost:3000
```

## Usage

### Development

```bash
npm run dev                              # default theme (midnight)
npm run dev -- --theme matrix            # matrix theme
npm run dev -- --theme matrix --port 8080
```

The dev server provides:
- Live reload on file changes
- Auto-discovery of `content/*.md` files
- Theme switching via `--theme`

### Build

```bash
npm run build                            # default theme → dist/index.html
npm run build -- --theme matrix          # matrix theme
npm run build -- --out public            # custom output dir
```

Output is a single self-contained `dist/index.html` — no server needed. Deploy it anywhere (GitHub Pages, Netlify, S3, or just open it in a browser).

## Project Structure

```
portfolio/
├── content/              # your content (gitignored — copy from content-example/)
│   ├── owner.json        # name, role, social links
│   ├── home.md           # landing page
│   ├── projects.md
│   └── ...
├── content-example/      # example content (tracked in git)
├── themes/               # JSON theme files
│   ├── midnight.json     # default dark theme
│   ├── matrix.json       # green-on-black
│   └── paper.json        # light theme
├── src/                  # app modules (ES modules)
│   ├── main.js           # entry point
│   ├── markdown.js       # frontmatter + markdown renderer
│   ├── terminal.js       # terminal UX (history, tab completion)
│   ├── navigation.js     # preview transitions
│   ├── theme.js          # apply theme to DOM
│   ├── particles.js      # tsParticles background
│   └── game.js           # 2D platformer
├── styles/
│   └── base.css          # theme-agnostic layout (CSS variables)
├── scripts/
│   ├── dev.mjs           # dev server + live reload
│   └── build.mjs         # static bundle builder (esbuild)
├── docs/
│   └── themes.md         # how to build a theme
├── theme.schema.json     # formal theme schema (for editor validation)
├── index.html            # entry HTML
└── package.json
```

## Adding Content

Content files live in `content/` and are auto-discovered — no manifest to edit.

### Owner info

Edit `content/owner.json`:

```json
{
  "name": "Your Name",
  "role": "Your Role • Skills",
  "links": [
    { "label": "github",   "url": "https://github.com/you" },
    { "label": "linkedin", "url": "https://linkedin.com/in/you" },
    { "label": "email",    "url": "mailto:you@example.com" }
  ]
}
```

### Sections

Create a `.md` file in `content/` with YAML frontmatter:

```markdown
---
label: my-section/
order: 6
---
# My Section

Content here. Supports **bold**, *italic*, `code`, [links](https://example.com),
lists, blockquotes, and horizontal rules.
```

- `label` — shown in the sidebar and terminal `ls` output
- `order` — sort position (lower = first)

The file name becomes the section ID (e.g. `blog.md` → `open blog`).

### Markdown support

| Syntax | Result |
|--------|--------|
| `# h1` / `## h2` / `### h3` | headings |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `` `code` `` | `inline code` |
| `[text](url)` | links |
| `- item` | bullet list |
| `> quote` | blockquote |
| `---` | horizontal rule |

## Adding a Theme

See [`docs/themes.md`](docs/themes.md) for the full guide. Quick version:

1. Copy a theme: `cp themes/midnight.json themes/my-theme.json`
2. Edit colors/fonts/particles
3. Run: `npm run dev -- --theme my-theme`

## Terminal Commands

| Command | Description |
|---------|-------------|
| `help` | list commands |
| `ls` | list sections (clickable) |
| `open <name>` / `cd <name>` | open a section |
| `back` | go home |
| `whoami` | short bio |
| `neofetch` | system info |
| `cowsay <text>` | a cow says something |
| `echo <text>` | print text |
| `date` | current date/time |
| `sudo <cmd>` | try it |
| `history` | command history |
| `theme` | show current theme |
| `clear` | clear terminal |
| `play` | start the game |
| `left` / `right` / `jump` / `stop` | game controls |

**Tab** completes, **↑/↓** cycles history, **Enter** runs.

## Deployment

```bash
npm run build -- --theme midnight
# deploy dist/index.html anywhere
```

The built file is fully self-contained (CSS, JS, theme, and content inlined). No server or runtime dependencies required.

## Documentation

- [Theme building guide](docs/themes.md)
- [Theme schema](theme.schema.json)

## Requirements

- Node.js 18+
- npm (for installing esbuild, the only dev dependency)
