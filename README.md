# Portfolio Terminal

A terminal-style portfolio with markdown-driven content, a 2D platformer game, and swappable themes built from reusable layouts and palettes.

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
npm run dev                                    # default theme (midnight)
npm run dev -- --theme linktree                # linktree layout
npm run dev -- --theme matrix                  # matrix palette
npm run dev -- --theme linktree-matrix --port 8080
```

The dev server provides:
- Live reload on file changes
- Auto-discovery of `content/*.md` files
- Theme switching via `--theme`

### Build

```bash
npm run build                                  # default theme → dist/index.html
npm run build -- --theme linktree              # linktree layout
npm run build -- --out public                  # custom output dir
```

Output is a single self-contained `dist/index.html` — no server needed. Deploy it anywhere (GitHub Pages, Netlify, S3, or just open it in a browser).

## Themes

A **theme** is a combination of a **layout** (structure) and a **palette** (colors/fonts/effects). This separation lets you mix and match.

### Built-in themes

| Theme | Layout | Palette | Description |
|-------|--------|---------|-------------|
| `midnight` | terminal | midnight | Dark blue, full terminal |
| `matrix` | terminal | matrix | Green-on-black |
| `paper` | terminal | paper | Light theme |
| `sunset` | terminal | sunset | Warm orange |
| `linktree` | linktree | midnight | Centered card, section buttons |
| `linktree-matrix` | linktree | matrix | Linktree with matrix colors |
| `minimal` | minimal | midnight | Clean reading mode |

### Layouts

| Layout | Description |
|--------|-------------|
| `terminal` | Sidebar + preview + bottom terminal with command input |
| `linktree` | Centered card, section buttons on home, back button on sections |
| `minimal` | Just the preview panel with top tab nav |

### Palettes

| Palette | Vibe |
|---------|------|
| `midnight` | Dark blue (default) |
| `matrix` | Green-on-black |
| `paper` | Light |
| `sunset` | Warm orange |

### Creating a theme

```json
// themes/my-theme.json
{
  "name": "my-theme",
  "label": "My Theme",
  "layout": "terminal",
  "palette": "sunset"
}
```

That's it — the layout provides structure, the palette provides colors. See [`docs/themes.md`](docs/themes.md) for the full guide including overrides, custom layouts, and custom palettes.

## Project Structure

```
portfolio/
├── content/                  # your content (gitignored — copy from content-example/)
│   ├── owner.json            # name, role, social links
│   ├── home.md               # landing page
│   ├── projects.md
│   └── ...
├── content-example/          # example content (tracked in git)
├── themes/
│   ├── layouts/              # structural definitions
│   │   ├── terminal.json     # sidebar + preview + terminal
│   │   ├── linktree.json     # centered card, section buttons
│   │   └── minimal.json      # just preview, top tabs
│   ├── palettes/             # visual identity
│   │   ├── midnight.json     # dark blue
│   │   ├── matrix.json       # green-on-black
│   │   ├── paper.json        # light
│   │   └── sunset.json       # warm orange
│   ├── midnight.json         # theme = layout + palette
│   ├── linktree.json
│   └── ...
├── src/                      # app modules (ES modules)
│   ├── main.js               # entry point
│   ├── markdown.js           # frontmatter + markdown renderer + links mode
│   ├── terminal.js           # terminal UX (history, tab completion)
│   ├── navigation.js         # preview transitions
│   ├── theme.js              # resolve + apply theme to DOM
│   ├── particles.js          # tsParticles background
│   └── game.js               # 2D platformer
├── styles/
│   └── base.css              # theme-agnostic layout (CSS variables)
├── scripts/
│   ├── dev.mjs               # dev server + live reload
│   └── build.mjs             # static bundle builder (esbuild)
├── docs/
│   └── themes.md             # themes, layouts & palettes guide
├── theme.schema.json         # theme schema (layout + palette refs)
├── layout.schema.json        # layout schema
├── palette.schema.json       # palette schema
├── index.html                # entry HTML
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

- `label` — shown in the sidebar, terminal `ls` output, and linktree section buttons
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

## Terminal Commands

Available in the `terminal` layout (not in linktree/minimal):

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

The built file is fully self-contained (CSS, JS, theme, and content inlined). No server or runtime dependencies required.

```bash
npm run build -- --theme midnight
# deploy dist/index.html anywhere
```

### Automatic deploy via the CLI

The `portfolio` CLI can build and deploy in one command. On first use it runs an interactive setup; afterwards it reuses the saved config from `deploy.config.json` (gitignored).

```bash
npx portfolio deploy
```

Options:

```bash
npx portfolio deploy --theme matrix        # pick a theme
npx portfolio deploy --provider surge      # force a provider
npx portfolio deploy --setup               # re-run interactive setup
npx portfolio deploy --no-build            # skip the build step
```

Manage credentials & defaults interactively:

```bash
npx portfolio config                       # interactive menu
npx portfolio config list                  # show current config
```

### Providers

| Provider | Description | Required config |
|----------|-------------|-----------------|
| `cloudflare` | Cloudflare Pages via API | `apiToken`, `accountId`, `projectName` |
| `surge` | Surge.sh via `npx surge` | `domain`, `token` |
| `copy` | Copy to a local directory | `out` |

Before deploying, the CLI validates that all required fields are present and stops with a helpful message if any are missing.

### Cloudflare Pages + custom domain

To serve the site on your own domain (optionally under a subpath), set these fields in `deploy.config.json`:

```json
{
  "providers": {
    "cloudflare": {
      "apiToken": "your-token",
      "accountId": "your-account-id",
      "projectName": "resume-yassine",
      "domain": "mondomaine.com",
      "subpath": "/portfolio/"
    }
  },
  "lastProvider": "cloudflare",
  "lastTheme": "midnight"
}
```

On each deploy the CLI will:
1. Ensure the Pages project exists
2. Attach the custom domain to the project
3. Create the DNS `CNAME` record pointing `domain` → `<project>.pages.dev` (proxied)
4. Upload the built `index.html`

#### Root vs subpath

- **No `subpath` set** → the site is served at the domain root: `https://mondomaine.com/`
- **`subpath` set** (e.g. `/portfolio/`) → the CLI also deploys a **routing Worker** named `<project>-router` that serves the Pages site under that subpath: `https://mondomaine.com/portfolio/`

#### Required Cloudflare permissions

Create an API token at **My Profile → API Tokens → Create Token** with these permissions:

| Permission | Scope | Needed for |
|------------|-------|------------|
| `Cloudflare Pages → Edit` | Account | Create project, upload files, attach domain |
| `Account Settings → Read` | Account | Access the account |
| `Zone → DNS → Edit` | Zone | Create the CNAME record automatically |
| `Workers Scripts → Edit` | Account | Deploy the routing Worker (only when using a subpath) |
| `Workers Routes → Edit` | Account | Attach the Worker to the domain (only when using a subpath) |

> The domain must already be added to your Cloudflare account (as a zone) for the DNS record to be created automatically.

## Documentation

- [Themes, Layouts & Palettes guide](docs/themes.md)
- [Theme schema](theme.schema.json)
- [Layout schema](layout.schema.json)
- [Palette schema](palette.schema.json)

## Requirements

- Node.js 18+
- npm (for installing esbuild, the only dev dependency)
