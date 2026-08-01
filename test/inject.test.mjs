#!/usr/bin/env node
/* =================================================
   test/inject.test.mjs — tests for scripts/inject.mjs
   Run: node --test
================================================= */

import { test } from "node:test";
import assert from "node:assert/strict";

import { injectBaseHref, normalizeSubpath } from "../scripts/inject.mjs";

test("normalizeSubpath adds leading and trailing slash", () => {
    assert.equal(normalizeSubpath("portfolio"), "/portfolio/");
    assert.equal(normalizeSubpath("/portfolio"), "/portfolio/");
    assert.equal(normalizeSubpath("portfolio/"), "/portfolio/");
    assert.equal(normalizeSubpath("/portfolio/"), "/portfolio/");
});

test("normalizeSubpath trims whitespace", () => {
    assert.equal(normalizeSubpath("  portfolio  "), "/portfolio/");
});

test("normalizeSubpath returns empty for falsy input", () => {
    assert.equal(normalizeSubpath(""), "");
    assert.equal(normalizeSubpath(null), "");
    assert.equal(normalizeSubpath(undefined), "");
});

test("injectBaseHref inserts base after <head>", () => {
    const html = "<!DOCTYPE html>\n<html>\n<head>\n    <meta charset=\"utf-8\">\n</head>\n<body></body>\n</html>";
    const out = injectBaseHref(html, "/portfolio/");
    assert.ok(out.includes('<base href="/portfolio/">'));
    assert.ok(out.indexOf('<base') < out.indexOf('<meta'));
});

test("injectBaseHref is idempotent (no double base)", () => {
    const html = "<head>\n    <base href=\"/portfolio/\">\n</head>";
    const once = injectBaseHref(html, "/portfolio/");
    const twice = injectBaseHref(once, "/portfolio/");
    assert.equal(once, twice);
    assert.equal((once.match(/<base/g) || []).length, 1);
});

test("injectBaseHref returns html unchanged when no subpath", () => {
    const html = "<head></head>";
    assert.equal(injectBaseHref(html, ""), html);
    assert.equal(injectBaseHref(html, null), html);
});

test("injectBaseHref normalizes subpath before injecting", () => {
    const html = "<head></head>";
    const out = injectBaseHref(html, "portfolio");
    assert.ok(out.includes('<base href="/portfolio/">'));
});