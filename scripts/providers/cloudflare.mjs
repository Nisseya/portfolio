#!/usr/bin/env node
/* =================================================
   scripts/providers/cloudflare.mjs
   Deploy to Cloudflare Pages via API (zero deps)
   Uses native fetch + FormData (Node 18+)
================================================= */

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

async function confirm(prompt, fallback = false) {
    const hint = fallback ? "[Y/n]" : "[y/N]";
    return new Promise(resolve => {
        const rl = createInterface({ input: stdin, output: stdout });
        rl.question(`  ${prompt} ${hint} `, answer => {
            rl.close();
            const a = answer.trim().toLowerCase();
            if (!a) return resolve(fallback);
            resolve(a === "y" || a === "yes");
        });
    });
}

/**
 * @param {object} opts
 * @param {string} opts.apiToken
 * @param {string} opts.accountId
 * @param {string} opts.projectName
 * @param {string} opts.buildDir     - path to dist/
 * @param {string} [opts.subpath]    - e.g. "/portfolio/"
 * @param {string} [opts.domain]     - custom domain, e.g. "mondomaine.com"
 * @returns {Promise<{url: string}>}
 */
export async function deploy(opts) {
    const { apiToken, accountId, projectName, buildDir, subpath, domain } = opts;

    if (!apiToken) throw new Error("Cloudflare API token is required");
    if (!accountId) throw new Error("Cloudflare Account ID is required");
    if (!projectName) throw new Error("Cloudflare project name is required");

    // A subpath of "/" (root) means "no subpath" — serve at the domain root.
    const clean = subpath ? subpath.replace(/^\/|\/$/g, "") : "";
    const realSubpath = clean ? `/${clean}/` : "";

    const headers = {
        "Authorization": `Bearer ${apiToken}`,
    };

    // ── 1. Ensure project exists ──
    process.stdout.write("  → checking Cloudflare project...\n");

    const projRes = await fetch(
        `${CLOUDFLARE_API}/accounts/${accountId}/pages/projects/${projectName}`,
        { headers }
    );

    if (projRes.status === 404) {
        process.stdout.write("\n  ⚠  Project does not exist. Creating it...\n");
        const createRes = await fetch(
            `${CLOUDFLARE_API}/accounts/${accountId}/pages/projects`,
            {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: projectName,
                    production_branch: "main",
                }),
            }
        );
        const createData = await createRes.json();
        if (!createData.success) {
            const msg = createData.errors?.[0]?.message || "unknown error";
            throw new Error(
                `Failed to create project.\n  ${msg}\n\n` +
                `  💡 Create it manually at:\n` +
                `     https://dash.cloudflare.com/?to=/:account/pages/new`
            );
        }
        process.stdout.write("  ✅ project created\n");
    } else if (!projRes.ok) {
        const data = await projRes.json();
        throw new Error(
            `Failed to check project: ${data.errors?.[0]?.message || projRes.status}`
        );
    }

    // ── 1b. Attach custom domain if provided ──
    if (domain) {
        process.stdout.write(`  → ensuring custom domain ${domain}...\n`);
        const domRes = await fetch(
            `${CLOUDFLARE_API}/accounts/${accountId}/pages/projects/${projectName}/domains`,
            { headers }
        );
        const domData = await domRes.json();
        const existing = (domData.result || []).some(d => d.name === domain);
        if (!existing) {
            const addRes = await fetch(
                `${CLOUDFLARE_API}/accounts/${accountId}/pages/projects/${projectName}/domains`,
                {
                    method: "POST",
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({ name: domain }),
                }
            );
            const addData = await addRes.json();
            if (!addData.success) {
                const msg = addData.errors?.[0]?.message || "unknown error";
                process.stdout.write(`  ⚠  Could not attach domain: ${msg}\n`);
            } else {
                process.stdout.write(`  ✅ domain ${domain} attached\n`);
            }
        } else {
            process.stdout.write(`  ✅ domain ${domain} already attached\n`);
        }

        // ── 1c. Ensure DNS CNAME record points to the Pages project ──
        await ensureDnsRecord({ apiToken, accountId, domain, projectName, headers });
    }

    // ── 1d. If a real subpath is requested, deploy a routing Worker ──
    if (realSubpath && domain) {
        await deployRoutingWorker({ apiToken, accountId, domain, projectName, subpath: realSubpath, headers });
    }

    // ── 2. Read built file ──
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");

    let html = readFileSync(join(buildDir, "index.html"), "utf-8");

    // inject <base> for subpath support
    if (realSubpath) {
        const base = realSubpath;
        if (!html.includes("<base")) {
            html = html.replace(
                "<head>",
                `<head>\n    <base href="${base}">`
            );
        }
    }

    // ── 3. Upload via direct API ──
    process.stdout.write("  → uploading to Cloudflare Pages...\n");

    const form = new FormData();
    form.set("manifest", JSON.stringify({ "index.html": "index.html" }));
    form.set(
        "index.html",
        new Blob([html], { type: "text/html" })
    );

    const deployRes = await fetch(
        `${CLOUDFLARE_API}/accounts/${accountId}/pages/projects/${projectName}/deployments`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${apiToken}` },
            body: form,
        }
    );

    const deployData = await deployRes.json();
    if (!deployData.success) {
        const msg = deployData.errors?.[0]?.message || "unknown error";
        throw new Error(`Cloudflare deploy failed: ${msg}`);
    }

    // ── 4. Build final URL (domain + subpath if provided) ──
    const baseUrl = domain
        ? `https://${domain}`
        : (deployData.result?.url || `https://${projectName}.pages.dev`);
    const url = realSubpath ? `${baseUrl}${realSubpath}` : baseUrl;
    return { url };
}

/**
 * Ensure a CNAME record exists pointing the domain at the Pages project.
 * Requires the domain's zone to be in the same Cloudflare account.
 */
async function ensureDnsRecord({ apiToken, accountId, domain, projectName, headers }) {
    const target = `${projectName}.pages.dev`;

    // Find the zone for this domain
    const zoneRes = await fetch(
        `${CLOUDFLARE_API}/zones?name=${encodeURIComponent(domain)}`,
        { headers }
    );
    const zoneData = await zoneRes.json();
    const zone = (zoneData.result || [])[0];

    if (!zone) {
        process.stdout.write(
            `  ⚠  Zone for ${domain} not found in this account. ` +
            `Add the domain to Cloudflare first, or create the CNAME manually.\n`
        );
        return;
    }

    const zoneId = zone.id;

    // Check for an existing CNAME record
    const listRes = await fetch(
        `${CLOUDFLARE_API}/zones/${zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(domain)}`,
        { headers }
    );
    const listData = await listRes.json();
    const existing = (listData.result || []).find(r => r.content === target);

    if (existing) {
        process.stdout.write(`  ✅ CNAME ${domain} → ${target} already set\n`);
        return;
    }

    // Create the CNAME record (proxied so SSL/CDN is active)
    const createRes = await fetch(
        `${CLOUDFLARE_API}/zones/${zoneId}/dns_records`,
        {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "CNAME",
                name: domain,
                content: target,
                proxied: true,
                comment: "Managed by portfolio deploy",
            }),
        }
    );
    const createData = await createRes.json();

    if (!createData.success) {
        const msg = createData.errors?.[0]?.message || "unknown error";

        // A DNS record managed by a Worker already exists on this host.
        // Offer to remove it (interactively) so the CNAME can be created.
        if (/managed by Workers/i.test(msg)) {
            process.stdout.write(`  ⚠  A Worker-managed DNS record already exists on ${domain}.\n`);
            const ok = await confirm(
                `  Remove it so the CNAME can point to ${target}?`,
                false
            );
            if (ok) {
                const removed = await removeWorkerManagedRecord({ apiToken, accountId, domain, projectName, zoneId, headers });
                if (removed) {
                    // Retry creating the CNAME once
                    const retry = await fetch(
                        `${CLOUDFLARE_API}/zones/${zoneId}/dns_records`,
                        {
                            method: "POST",
                            headers: { ...headers, "Content-Type": "application/json" },
                            body: JSON.stringify({
                                type: "CNAME",
                                name: domain,
                                content: target,
                                proxied: true,
                                comment: "Managed by portfolio deploy",
                            }),
                        }
                    );
                    const retryData = await retry.json();
                    if (retryData.success) {
                        process.stdout.write(`  ✅ CNAME ${domain} → ${target} created\n`);
                        return;
                    }
                    process.stdout.write(
                        `  ⚠  Could not create CNAME after cleanup: ${retryData.errors?.[0]?.message || "unknown error"}\n`
                    );
                    process.stdout.write(
                        `     Create it manually: DNS → Add record → CNAME ${domain} → ${target}\n`
                    );
                    return;
                }
            }
            process.stdout.write(
                `     Create it manually: DNS → Add record → CNAME ${domain} → ${target}\n`
            );
            return;
        }

        process.stdout.write(`  ⚠  Could not create CNAME record: ${msg}\n`);
        process.stdout.write(
            `     Create it manually: DNS → Add record → CNAME ${domain} → ${target}\n`
        );
        return;
    }

    process.stdout.write(`  ✅ CNAME ${domain} → ${target} created\n`);
}

/**
 * Remove a DNS record managed by a Worker on the given host.
 * This can be either a DNS record flagged as managed by Workers,
 * or a custom domain attached to a Worker script (which creates
 * a Worker-managed record). Returns true if something was removed.
 */
async function removeWorkerManagedRecord({ apiToken, accountId, domain, projectName, zoneId, headers }) {
    let removedAny = false;

    // 1) Try DNS records flagged as managed by Workers
    const listRes = await fetch(
        `${CLOUDFLARE_API}/zones/${zoneId}/dns_records?name=${encodeURIComponent(domain)}`,
        { headers }
    );
    const listData = await listRes.json();
    const records = (listData.result || []).filter(r => r.meta?.managed_by === "workers");

    for (const rec of records) {
        const delRes = await fetch(
            `${CLOUDFLARE_API}/zones/${zoneId}/dns_records/${rec.id}`,
            { method: "DELETE", headers }
        );
        const delData = await delRes.json();
        if (delData.success) {
            process.stdout.write(`  ✅ Removed Worker-managed record ${rec.name} (${rec.type})\n`);
            removedAny = true;
        } else {
            process.stdout.write(
                `  ⚠  Could not remove record ${rec.name}: ${delData.errors?.[0]?.message || "unknown error"}\n`
            );
        }
    }

    // 2) Detach the custom domain from the routing Worker script
    //    (a Worker custom domain also creates a Worker-managed DNS record)
    const workerName = `${projectName}-router`;
    const domRes = await fetch(
        `${CLOUDFLARE_API}/accounts/${accountId}/workers/scripts/${workerName}/domains`,
        { headers }
    );
    const domData = await domRes.json();
    const attached = (domData.result || []).filter(d => d.hostname === domain);

    for (const d of attached) {
        const delRes = await fetch(
            `${CLOUDFLARE_API}/accounts/${accountId}/workers/scripts/${workerName}/domains/${d.id}`,
            { method: "DELETE", headers }
        );
        const delData = await delRes.json();
        if (delData.success) {
            process.stdout.write(`  ✅ Detached ${domain} from Worker ${workerName}\n`);
            removedAny = true;
        } else {
            process.stdout.write(
                `  ⚠  Could not detach ${domain} from Worker: ${delData.errors?.[0]?.message || "unknown error"}\n`
            );
        }
    }

    // 3) Detach the domain from ANY Worker custom domain in the account
    const allDomRes = await fetch(
        `${CLOUDFLARE_API}/accounts/${accountId}/workers/domains`,
        { headers }
    );
    const allDomData = await allDomRes.json();
    const allAttached = (allDomData.result || []).filter(d => d.hostname === domain);
    for (const d of allAttached) {
        const delRes = await fetch(
            `${CLOUDFLARE_API}/accounts/${accountId}/workers/domains/${d.id}`,
            { method: "DELETE", headers }
        );
        const delData = await delRes.json();
        if (delData.success) {
            process.stdout.write(`  ✅ Detached ${domain} from Worker (custom domain)\n`);
            removedAny = true;
        } else {
            process.stdout.write(
                `  ⚠  Could not detach custom domain: ${delData.errors?.[0]?.message || "unknown error"}\n`
            );
        }
    }

    // 4) Remove Worker routes (URL patterns) matching the domain
    const routeRes = await fetch(
        `${CLOUDFLARE_API}/accounts/${accountId}/workers/routes`,
        { headers }
    );
    const routeData = await routeRes.json();
    const matchingRoutes = (routeData.result || []).filter(r =>
        r.pattern && (r.pattern === domain || r.pattern.startsWith(domain + "/") || r.pattern.startsWith("*." + domain))
    );
    for (const r of matchingRoutes) {
        const delRes = await fetch(
            `${CLOUDFLARE_API}/accounts/${accountId}/workers/routes/${r.id}`,
            { method: "DELETE", headers }
        );
        const delData = await delRes.json();
        if (delData.success) {
            process.stdout.write(`  ✅ Removed Worker route ${r.pattern}\n`);
            removedAny = true;
        } else {
            process.stdout.write(
                `  ⚠  Could not remove Worker route ${r.pattern}: ${delData.errors?.[0]?.message || "unknown error"}\n`
            );
        }
    }

    if (!removedAny) {
        process.stdout.write(`  ℹ  No Worker-managed record found to remove.\n`);
    }
    return removedAny;
}

/**
 * Deploy a routing Worker that serves the Pages site under a subpath.
 * Cloudflare Pages serves at the domain root, so a Worker rewrites
 * requests under <subpath> to the Pages project.
 */
async function deployRoutingWorker({ apiToken, accountId, domain, projectName, subpath, headers }) {
    const clean = subpath.replace(/^\/|\/$/g, "");
    const workerName = `${projectName}-router`;
    const pagesUrl = `https://${projectName}.pages.dev`;

    process.stdout.write(`  → deploying routing Worker for subpath /${clean}/...\n`);

    // The Worker strips the subpath prefix and proxies to the Pages project.
    const workerCode = `
const SUBPATH = "/${clean}";
const UPSTREAM = "${pagesUrl}";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Route the subpath (and everything under it) to the Pages site.
    if (url.pathname === SUBPATH || url.pathname.startsWith(SUBPATH + "/")) {
      const target = new URL(UPSTREAM);
      target.pathname = url.pathname.slice(SUBPATH.length) || "/";
      target.search = url.search;
      return fetch(new Request(target, request));
    }

    // Everything else: 404.
    return new Response("Not found", { status: 404 });
  }
};
`;

    // Ensure the Worker script exists (create or update)
    const scriptRes = await fetch(
        `${CLOUDFLARE_API}/accounts/${accountId}/workers/scripts/${workerName}`,
        { headers }
    );

    const body = new FormData();
    body.set(
        "metadata",
        new Blob(
            [JSON.stringify({ main_module: "index.js", compatibility_date: "2024-01-01" })],
            { type: "application/json" }
        )
    );
    body.set("index.js", new Blob([workerCode], { type: "application/javascript" }));

    const method = scriptRes.status === 404 ? "PUT" : "POST";
    const upRes = await fetch(
        `${CLOUDFLARE_API}/accounts/${accountId}/workers/scripts/${workerName}`,
        {
            method,
            headers: { Authorization: `Bearer ${apiToken}` },
            body,
        }
    );
    const upData = await upRes.json();
    if (!upData.success) {
        const msg = upData.errors?.[0]?.message || "unknown error";
        process.stdout.write(`  ⚠  Could not deploy routing Worker: ${msg}\n`);
        return;
    }

    // Attach the Worker to the domain route
    const routeRes = await fetch(
        `${CLOUDFLARE_API}/accounts/${accountId}/workers/domains`,
        {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({
                hostname: domain,
                service: workerName,
                environment: "production",
            }),
        }
    );
    const routeData = await routeRes.json();
    if (!routeData.success) {
        const msg = routeData.errors?.[0]?.message || "unknown error";
        process.stdout.write(`  ⚠  Could not attach Worker route: ${msg}\n`);
        process.stdout.write(`     Route: ${domain}/${clean}*\n`);
        return;
    }

    process.stdout.write(`  ✅ routing Worker ${workerName} deployed on ${domain}/${clean}/\n`);
}