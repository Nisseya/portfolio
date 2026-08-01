#!/usr/bin/env node
/* =================================================
   test/config.test.mjs — tests for scripts/config.mjs
   Uses PORTFOLIO_CONFIG to isolate state in a temp file.
   Run: node --test
================================================= */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir;
let configPath;

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "portfolio-test-"));
    configPath = join(tmpDir, "deploy.config.json");
    process.env.PORTFOLIO_CONFIG = configPath;
});

afterEach(() => {
    delete process.env.PORTFOLIO_CONFIG;
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

// Import AFTER setting env so CONFIG_PATH resolves to the temp file.
// Re-import each time to pick up the fresh env.
async function fresh() {
    return await import(`../scripts/config.mjs?t=${Date.now()}`);
}

test("loadConfig returns defaults when no file exists", async () => {
    const { loadConfig } = await fresh();
    const cfg = loadConfig();
    assert.deepEqual(cfg.providers, {});
    assert.equal(cfg.lastTheme, "midnight");
    assert.equal(cfg.lastProvider, null);
});

test("saveConfig then loadConfig round-trips", async () => {
    const { loadConfig, saveConfig } = await fresh();
    const cfg = loadConfig();
    cfg.lastTheme = "matrix";
    cfg.providers.cloudflare = { apiToken: "abc" };
    saveConfig(cfg);

    const reloaded = loadConfig();
    assert.equal(reloaded.lastTheme, "matrix");
    assert.equal(reloaded.providers.cloudflare.apiToken, "abc");
});

test("loadConfig tolerates corrupt JSON", async () => {
    writeFileSync(configPath, "{ not valid json");
    const { loadConfig } = await fresh();
    const cfg = loadConfig();
    assert.deepEqual(cfg.providers, {});
    assert.equal(cfg.lastTheme, "midnight");
});

test("findProvider resolves known providers", async () => {
    const { findProvider, PROVIDERS } = await fresh();
    assert.equal(findProvider("cloudflare").id, "cloudflare");
    assert.equal(findProvider("surge").id, "surge");
    assert.equal(findProvider("copy").id, "copy");
    assert.equal(findProvider("nope"), undefined);
    assert.equal(PROVIDERS.length, 3);
});

test("runConfigCommand set persists a provider value", async () => {
    const { runConfigCommand, loadConfig } = await fresh();
    await runConfigCommand(["set", "cloudflare", "apiToken", "tok-123"]);
    const cfg = loadConfig();
    assert.equal(cfg.providers.cloudflare.apiToken, "tok-123");
});

test("runConfigCommand set normalizes subpath", async () => {
    const { runConfigCommand, loadConfig } = await fresh();
    await runConfigCommand(["set", "cloudflare", "subpath", "portfolio"]);
    const cfg = loadConfig();
    assert.equal(cfg.providers.cloudflare.subpath, "/portfolio/");
});

test("runConfigCommand set rejects unknown provider", async () => {
    const { runConfigCommand } = await fresh();
    const origExit = process.exit;
    let exitCode = null;
    process.exit = code => { exitCode = code; throw new Error("exit"); };
    try {
        await assert.rejects(() => runConfigCommand(["set", "bogus", "x", "y"]));
    } finally {
        process.exit = origExit;
    }
    assert.equal(exitCode, 1);
});

test("runConfigCommand unset removes a key", async () => {
    const { runConfigCommand, loadConfig } = await fresh();
    await runConfigCommand(["set", "surge", "token", "t"]);
    await runConfigCommand(["unset", "surge", "token"]);
    const cfg = loadConfig();
    assert.equal(cfg.providers.surge.token, undefined);
});

test("runConfigCommand remove deletes a provider", async () => {
    const { runConfigCommand, loadConfig } = await fresh();
    await runConfigCommand(["set", "copy", "out", "/tmp/x"]);
    await runConfigCommand(["default", "copy"]);
    await runConfigCommand(["remove", "copy"]);
    const cfg = loadConfig();
    assert.equal(cfg.providers.copy, undefined);
    assert.equal(cfg.lastProvider, null);
});

test("runConfigCommand default sets lastProvider", async () => {
    const { runConfigCommand, loadConfig } = await fresh();
    await runConfigCommand(["default", "cloudflare"]);
    const cfg = loadConfig();
    assert.equal(cfg.lastProvider, "cloudflare");
});

test("runConfigCommand theme sets lastTheme", async () => {
    const { runConfigCommand, loadConfig } = await fresh();
    await runConfigCommand(["theme", "matrix"]);
    const cfg = loadConfig();
    assert.equal(cfg.lastTheme, "matrix");
});

test("runConfigCommand favorite / unfavorite round-trip", async () => {
    const { runConfigCommand, loadConfig } = await fresh();
    await runConfigCommand(["favorite", "prod", "cloudflare"]);
    let cfg = loadConfig();
    assert.equal(cfg.favorites.prod, "cloudflare");

    await runConfigCommand(["unfavorite", "prod"]);
    cfg = loadConfig();
    assert.equal(cfg.favorites.prod, undefined);
});

test("runConfigCommand list does not crash with empty config", async () => {
    const { runConfigCommand } = await fresh();
    await runConfigCommand(["list"]);
    assert.ok(true);
});