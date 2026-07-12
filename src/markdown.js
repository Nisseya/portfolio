/* =================================================
   markdown.js — minimal markdown → HTML renderer
   + YAML frontmatter parser
   Supports: frontmatter, # h1-h3, --- hr, > quote,
   - bullets, `code`, **bold**, *italic*, [link](url).
================================================= */

/* ---------- frontmatter ---------- */

export function parseFrontmatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: text };

    const raw = match[1];
    const body = match[2];
    const data = {};

    for (const line of raw.split("\n")) {
        const m = line.match(/^(\w+):\s*(.*)$/);
        if (m) {
            let val = m[2].trim();
            // strip quotes
            if ((val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            data[m[1]] = val;
        }
    }

    return { data, body };
}

/* ---------- inline ---------- */

const inlineRules = [
    [/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>'],
    [/`([^`]+)`/g, '<code>$1</code>'],
    [/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'],
    [/\*([^*]+)\*/g, '<em>$1</em>']
];

function renderInline(text) {
    let out = text;
    for (const [re, repl] of inlineRules) out = out.replace(re, repl);
    return out;
}

/* ---------- block ---------- */

export function renderMarkdown(md) {
    const lines = md.split("\n");
    const html = [];
    let inList = false;
    let para = [];

    const flushPara = () => {
        if (para.length) {
            html.push(`<p>${renderInline(para.join(" "))}</p>`);
            para = [];
        }
    };
    const closeList = () => {
        if (inList) { html.push("</ul>"); inList = false; }
    };

    for (const raw of lines) {
        const line = raw.trimEnd();

        if (line.trim() === "") { flushPara(); closeList(); continue; }

        if (/^---+$/.test(line.trim())) {
            flushPara(); closeList();
            html.push("<hr>");
            continue;
        }

        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) {
            flushPara(); closeList();
            html.push(`<h${h[1].length}>${renderInline(h[2])}</h${h[1].length}>`);
            continue;
        }

        if (line.startsWith("> ")) {
            flushPara(); closeList();
            html.push(`<blockquote>${renderInline(line.slice(2))}</blockquote>`);
            continue;
        }

        if (line.startsWith("- ")) {
            flushPara();
            if (!inList) { html.push("<ul>"); inList = true; }
            html.push(`<li>${renderInline(line.slice(2))}</li>`);
            continue;
        }

        para.push(line);
    }

    flushPara();
    closeList();
    return html.join("\n");
}

/* ---------- alternative render: links mode ---------- */

/**
 * Extracts headings + links from markdown into a button stack.
 * Used by themes with content.render = "links" (linktree style).
 * Each ## heading becomes a titled entry; links within become buttons.
 * If no headings, falls back to extracting all links.
 */
export function renderLinks(md) {
    const lines = md.split("\n");
    const sections = [];
    let current = null;
    const orphanLinks = [];

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    for (const raw of lines) {
        const line = raw.trim();

        // h1 — title
        const h1 = line.match(/^#\s+(.*)$/);
        if (h1) {
            current = { title: h1[1], links: [], desc: null };
            sections.push(current);
            continue;
        }

        // h2 — entry title
        const h2 = line.match(/^##\s+(.*)$/);
        if (h2) {
            current = { title: h2[1], links: [], desc: null };
            sections.push(current);
            continue;
        }

        // paragraph (description)
        if (line && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith(">") && !line.startsWith("---")) {
            // collect links from this line
            let m;
            linkRegex.lastIndex = 0;
            const lineLinks = [];
            while ((m = linkRegex.exec(line)) !== null) {
                lineLinks.push({ label: m[1], url: m[2] });
            }
            if (lineLinks.length) {
                if (current) current.links.push(...lineLinks);
                else orphanLinks.push(...lineLinks);
            } else if (current && !current.desc) {
                current.desc = line.replace(/[*`]/g, "");
            }
        }
    }

    // if no sections, just collect all links
    if (sections.length === 0 && orphanLinks.length === 0) {
        let m;
        linkRegex.lastIndex = 0;
        const fullText = md;
        while ((m = linkRegex.exec(fullText)) !== null) {
            orphanLinks.push({ label: m[1], url: m[2] });
        }
    }

    // build HTML
    const parts = [];

    if (sections.length) {
        for (const s of sections) {
            if (s.links.length === 0) continue;
            parts.push(`<div class="link-group">`);
            if (s.title) parts.push(`<div class="link-group-title">${s.title}</div>`);
            if (s.desc)  parts.push(`<div class="link-group-desc">${s.desc}</div>`);
            for (const l of s.links) {
                parts.push(`<a class="link-btn" href="${l.url}" target="_blank" rel="noopener">${l.label} <span class="arrow">→</span></a>`);
            }
            parts.push(`</div>`);
        }
    }

    for (const l of orphanLinks) {
        parts.push(`<a class="link-btn" href="${l.url}" target="_blank" rel="noopener">${l.label} <span class="arrow">→</span></a>`);
    }

    return parts.join("\n");
}

/* ---------- file loading with cache ---------- */

const cache = new Map();

export async function loadMarkdownFile(path, renderMode = "markdown") {
    const cacheKey = `${path}:${renderMode}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    const text = await res.text();
    const { data, body } = parseFrontmatter(text);
    const html = renderMode === "links" ? renderLinks(body) : renderMarkdown(body);
    const result = { frontmatter: data, html };
    cache.set(cacheKey, result);
    return result;
}
