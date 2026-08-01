#!/usr/bin/env node
/* =================================================
   scripts/inject.mjs — pure helpers for HTML injection
   (kept dependency-free and side-effect-free for tests)
================================================= */

/**
 * Inject a <base href> into an HTML string for subpath hosting.
 * No-op if a <base> tag already exists.
 * @param {string} html
 * @param {string} subpath  e.g. "/portfolio/"
 * @returns {string}
 */
export function injectBaseHref(html, subpath) {
    if (!subpath) return html;
    if (html.includes("<base")) return html;
    const clean = subpath.replace(/^\/|\/$/g, "");
    const base = `/${clean}/`;
    return html.replace("<head>", `<head>\n    <base href="${base}">`);
}

/**
 * Normalize a subpath so it always starts and ends with "/".
 * @param {string} subpath
 * @returns {string}
 */
export function normalizeSubpath(subpath) {
    if (!subpath) return "";
    let s = subpath.trim();
    if (!s.startsWith("/")) s = "/" + s;
    if (!s.endsWith("/")) s += "/";
    return s;
}