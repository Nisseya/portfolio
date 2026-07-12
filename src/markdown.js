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

/* ---------- file loading with cache ---------- */

const cache = new Map();

export async function loadMarkdownFile(path) {
    if (cache.has(path)) return cache.get(path);
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
    const text = await res.text();
    const { data, body } = parseFrontmatter(text);
    const html = renderMarkdown(body);
    const result = { frontmatter: data, html };
    cache.set(path, result);
    return result;
}
