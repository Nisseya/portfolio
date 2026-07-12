#!/usr/bin/env node
/* =================================================
   scripts/dev.mjs — development server
   - serves static files from the project root
   - serves /dev.json with theme + content manifest
   - watches content/ and themes/ for changes
   - live reload via WebSocket
   - CLI flags: --port, --theme

   Usage:
     node scripts/dev.mjs
     node scripts/dev.mjs --theme matrix --port 8080
================================================= */

import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/* ---------- CLI args ---------- */

const args = process.argv.slice(2);
function getFlag(name, fallback) {
    const i = args.indexOf(`--${name}`);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const PORT = parseInt(getFlag("port", "3000"), 10);
const THEME_NAME = getFlag("theme", "midnight");

/* ---------- content discovery ---------- */

async function discoverContent() {
    const contentDir = path.join(ROOT, "content");
    const files = await fs.readdir(contentDir);
    const mdFiles = files.filter(f => f.endsWith(".md"));

    const sections = [];
    for (const file of mdFiles) {
        const fullPath = path.join(contentDir, file);
        const text = await fs.readFile(fullPath, "utf-8");

        // parse frontmatter
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
        sections.push({
            id,
            label,
            order,
            file: `content/${file}`
        });
    }

    sections.sort((a, b) => a.order - b.order);
    return sections;
}

/* ---------- owner info ---------- */

async function loadOwner() {
    const ownerPath = path.join(ROOT, "content", "owner.json");
    try {
        const text = await fs.readFile(ownerPath, "utf-8");
        return JSON.parse(text);
    } catch {
        return {
            name: "Yassine Hadi",
            role: "AI Engineer • Rust • ML • Data Engineering",
            links: [
                { label: "github",   url: "https://github.com/" },
                { label: "linkedin", url: "https://www.linkedin.com/" },
                { label: "email",    url: "mailto:you@example.com" }
            ]
        };
    }
}

/* ---------- theme loading (layout + palette resolution) ---------- */

async function loadJSON(dir, name) {
    const filePath = path.join(ROOT, "themes", dir, `${name}.json`);
    const text = await fs.readFile(filePath, "utf-8");
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
    const themePath = path.join(ROOT, "themes", `${name}.json`);
    const text = await fs.readFile(themePath, "utf-8");
    const theme = JSON.parse(text);
    return resolveTheme(theme);
}

/* ---------- manifest builder ---------- */

async function buildManifest(themeName) {
    const [sections, owner, theme] = await Promise.all([
        discoverContent(),
        loadOwner(),
        loadTheme(themeName)
    ]);
    return { owner, sections, theme };
}

/* ---------- MIME types ---------- */

const MIME = {
    ".html": "text/html",
    ".css":  "text/css",
    ".js":   "text/javascript",
    ".mjs":  "text/javascript",
    ".json": "application/json",
    ".md":   "text/markdown",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
};

/* ---------- live reload ---------- */

const clients = new Set();

function notifyReload() {
    for (const res of clients) {
        res.write(`data: reload\n\n`);
    }
    clients.clear();
}

/* ---------- server ---------- */

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // live reload endpoint
    if (url.pathname === "/live-reload") {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
    }

    // dev manifest
    if (url.pathname === "/dev.json") {
        try {
            const manifest = await buildManifest(THEME_NAME);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(manifest));
        } catch (e) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    // serve static files
    let filePath = path.join(ROOT, url.pathname);
    if (url.pathname === "/") filePath = path.join(ROOT, "index.html");

    try {
        const stat = await fs.stat(filePath);
        if (stat.isDirectory()) {
            filePath = path.join(filePath, "index.html");
        }

        const ext = path.extname(filePath);
        const mime = MIME[ext] || "application/octet-stream";

        // inject live reload into HTML
        if (ext === ".html") {
            let html = await fs.readFile(filePath, "utf-8");
            if (!html.includes("live-reload")) {
                html = html.replace("</body>", `<script>new EventSource("/live-reload").addEventListener("message",()=>location.reload());</script>\n</body>`);
            }
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(html);
            return;
        }

        const data = await fs.readFile(filePath);
        res.writeHead(200, { "Content-Type": mime });
        res.end(data);
    } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("404 Not Found");
    }
});

/* ---------- file watcher ---------- */

async function watchFiles() {
    const watchDirs = ["content", "themes", "src", "styles"];
    for (const dir of watchDirs) {
        const fullPath = path.join(ROOT, dir);
        try {
            fsSync.watch(fullPath, { recursive: true }, (event, file) => {
                console.log(`  ↻ ${event}: ${dir}/${file}`);
                notifyReload();
            });
        } catch (e) {
            console.warn(`  ! could not watch ${dir}/: ${e.message}`);
        }
    }
}

/* ---------- start ---------- */

server.listen(PORT, () => {
    console.log(`\n  🚀 dev server running`);
    console.log(`  → http://localhost:${PORT}`);
    console.log(`  → theme: ${THEME_NAME}`);
    console.log(`  → live reload enabled\n`);
    watchFiles();
});
