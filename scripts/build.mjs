#!/usr/bin/env node
/* =================================================
   scripts/build.mjs — compile to a static bundle
   - bundles JS modules with esbuild
   - inlines CSS, theme, and content into one HTML file
   - CLI flags: --theme, --out

   Usage:
     node scripts/build.mjs
     node scripts/build.mjs --theme matrix --out dist
================================================= */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/* ---------- CLI args ---------- */

const args = process.argv.slice(2);
function getFlag(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const THEME_NAME = getFlag("theme", "midnight");
const OUT_DIR = path.join(ROOT, getFlag("out", "dist"));

/* ---------- helpers ---------- */

async function readFile(rel) {
    return fs.readFile(path.join(ROOT, rel), "utf-8");
}

/* ---------- theme loading (layout + palette resolution) ---------- */

async function loadJSON(dir, name) {
    const text = await readFile(`themes/${dir}/${name}.json`);
    return JSON.parse(text);
}

async function resolveTheme(theme) {
    const layout  = theme.layout  ? await loadJSON("layouts",  theme.layout)  : {};
    const palette = theme.palette ? await loadJSON("palettes", theme.palette) : {};
    return {
        name:  theme.name,
        label: theme.label,
        colors:    palette.colors    || {},
        fonts:     palette.fonts     || { mono: { family: "monospace" } },
        particles: palette.particles || { enabled: false },
        glow:      palette.glow      || { enabled: false },
        layout:     layout.layout     || { mode: "terminal" },
        features:   layout.features   || {},
        content:    layout.content    || { render: "markdown" },
        typography: layout.typography || {},
        css:        layout.css        || "",
        ...theme.overrides || {},
    };
}

async function loadTheme(name) {
    const text = await readFile(`themes/${name}.json`);
    const theme = JSON.parse(text);
    return resolveTheme(theme);
}

async function discoverContent() {
    const contentDir = path.join(ROOT, "content");
    const files = (await fs.readdir(contentDir)).filter(f => f.endsWith(".md"));

    const sections = [];
    for (const file of files) {
        const text = await fs.readFile(path.join(contentDir, file), "utf-8");
        const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
        let label = file.replace(/\.md$/, "");
        let order = 99;

        if (fmMatch) {
            const labelMatch = fmMatch[1].match(/^label:\s*(.*)$/m);
            const orderMatch = fmMatch[1].match(/^order:\s*(.*)$/m);
            if (labelMatch) label = labelMatch[1].trim().replace(/^["']|["']$/g, "");
            if (orderMatch) order = parseInt(orderMatch[1].trim(), 10);
        }

        const id = file.replace(/\.md$/, "");
        sections.push({ id, label, order, file: `content/${file}` });
    }

    sections.sort((a, b) => a.order - b.order);
    return sections;
}

/* ---------- main build ---------- */

async function build() {
    console.log(`\n  📦 building with theme: ${THEME_NAME}\n`);

    const [sections, owner] = await Promise.all([
        discoverContent(),
        readFile("content/owner.json").then(JSON.parse).catch(() => ({
            name: "Yassine Hadi",
            role: "AI Engineer • Rust • ML • Data Engineering",
            links: [
                { label: "github",   "url": "https://github.com/" },
                { label: "linkedin", "url": "https://www.linkedin.com/" },
                { label: "email",    "url": "mailto:you@example.com" }
            ]
        }))
    ]);
    const theme = await loadTheme(THEME_NAME);

    // bundle JS with esbuild
    console.log("  → bundling JS modules...");
    const jsBundle = await esbuild.build({
        entryPoints: [path.join(ROOT, "src/main.js")],
        bundle: true,
        format: "iife",
        target: "es2020",
        write: false,
        minify: true,
        define: {
            "window.__BUILD__": '"true"'
        }
    });
    const jsCode = jsBundle.outputFiles[0].text;

    // read base CSS
    const css = await readFile("styles/base.css");

    // inline theme as CSS variables
    const themeCSS = `
:root {
    --bg: ${theme.colors.bg};
    --window: ${theme.colors.window};
    --window-alt: ${theme.colors.windowAlt};
    --text: ${theme.colors.text};
    --muted: ${theme.colors.muted};
    --muted-alt: ${theme.colors.mutedAlt};
    --border: ${theme.colors.border};
    --border-soft: ${theme.colors.borderSoft};
    --accent: ${theme.colors.accent};
    --accent-soft: ${theme.colors.accentSoft};
    --hover: ${theme.colors.hover};
    --font-mono: ${theme.fonts.mono.family};
    --glow-layers: ${theme.glow?.enabled && theme.glow.layers?.length
        ? theme.glow.layers.map(l => `radial-gradient(circle at ${l.position}, ${l.color}, transparent ${l.size})`).join(", ")
        : "none"};
    --font-size: ${theme.typography?.baseSize || "15px"};
    --line-height: ${theme.typography?.lineHeight || "1.7"};
    --letter-spacing: ${theme.typography?.letterSpacing || "0"};
    --sidebar-width: ${theme.layout?.sidebarWidth || "220px"};
    --terminal-height: ${theme.layout?.terminalHeight || "200px"};
    --radius: ${theme.layout?.borderRadius || "18px"};
    --max-width: ${theme.layout?.maxWidth || "1600px"};
    --max-height: ${theme.layout?.maxHeight || "900px"};
}
`;

    // data attributes
    const features = theme.features || {};
    const featureAttrs = Object.entries(features).map(([k, v]) => `data-feature-${k}="${v ? "on" : "off"}"`).join(" ");
    const layoutAttr = `data-layout="${theme.layout?.mode || "terminal"}"`;
    const densityAttr = `data-density="${theme.layout?.density || "normal"}"`;

    // build manifest + inline content
    console.log("  → inlining content...");
    const manifest = { owner, sections, theme };
    const contentFiles = {};
    for (const section of sections) {
        contentFiles[section.file] = await readFile(section.file);
    }

    // assemble final HTML
    let finalHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${owner.name}</title>
`;

    if (theme.fonts.mono.url) {
        finalHTML += `    <link rel="stylesheet" href="${theme.fonts.mono.url}">\n`;
    }

    finalHTML += `    <style>\n${themeCSS}\n${css}\n${theme.css || ""}\n    </style>\n`;
    finalHTML += `</head>
<body ${layoutAttr} ${densityAttr} ${featureAttrs}>

<div id="tsparticles"></div>
<div class="noise"></div>

<main>
    <div class="terminal">
        <div class="window-bar">
            <div class="window-controls">
                <span class="dot red"></span>
                <span class="dot yellow"></span>
                <span class="dot green"></span>
            </div>
            <span class="title" id="breadcrumb">yassine@portfolio:~</span>
            <div class="owner-links" id="owner-links"></div>
        </div>
        <div class="body-split">
            <aside class="sidebar">
                <div class="sidebar-header">sections</div>
                <nav id="nav-strip" class="nav-strip"></nav>
                <div class="sidebar-header">quick commands</div>
                <div class="quick-cmds" id="quick-cmds"></div>
            </aside>
            <div class="preview-panel">
                <div id="preview" class="preview-content"></div>
            </div>
        </div>
        <div class="terminal-panel">
            <div id="terminal-output" class="terminal-output"></div>
            <div class="footer">
                <span class="prompt">$</span>
                <input id="cmd" type="text" autocomplete="off" spellcheck="false"
                       placeholder="type 'help' — Tab to complete, ↑/↓ for history" />
            </div>
        </div>
        <div class="status-bar">
            <span class="status-hint">
                <kbd>Tab</kbd> complete · <kbd>↑</kbd><kbd>↓</kbd> history · <kbd>Enter</kbd> run
            </span>
            <span class="status-section" id="status-section">home</span>
        </div>
    </div>
</main>

<script src="https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/tsparticles.bundle.min.js"></script>
<script>
    // baked manifest + content (no fetch needed)
    window.__MANIFEST__ = ${JSON.stringify(manifest)};
    window.__CONTENT__ = ${JSON.stringify(contentFiles)};
</script>
<script>
    // override fetch to serve inlined content
    const _origFetch = window.fetch;
    window.fetch = async function(url) {
        if (typeof url === "string") {
            if (url === "manifest.json" || url === "dev.json") {
                return new Response(JSON.stringify(window.__MANIFEST__), {
                    status: 200, headers: { "Content-Type": "application/json" }
                });
            }
            if (window.__CONTENT__ && window.__CONTENT__[url]) {
                return new Response(window.__CONTENT__[url], {
                    status: 200, headers: { "Content-Type": "text/markdown" }
                });
            }
        }
        return _origFetch.apply(this, arguments);
    };
</script>
<script>
${jsCode}
</script>

</body>
</html>`;

    await fs.mkdir(OUT_DIR, { recursive: true });
    await fs.writeFile(path.join(OUT_DIR, "index.html"), finalHTML);

    console.log(`\n  ✅ build complete`);
    console.log(`  → ${path.relative(ROOT, path.join(OUT_DIR, "index.html"))}`);
    console.log(`  → theme: ${theme.label}`);
    console.log(`  → ${(finalHTML.length / 1024).toFixed(1)} KB\n`);
}

build().catch(err => {
    console.error("\n  ❌ build failed:", err.message, "\n");
    process.exit(1);
});
