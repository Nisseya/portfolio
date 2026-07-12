/* =================================================
   particles.js — tsParticles background
   Takes a config object (from theme.js getParticleConfig).
================================================= */

let instance = null;

export function initParticles(config) {
    if (!config) {
        const el = document.getElementById("tsparticles");
        if (el) el.style.display = "none";
        return;
    }

    if (typeof tsParticles === "undefined") {
        console.warn("tsParticles not loaded — background disabled");
        return;
    }

    const el = document.getElementById("tsparticles");
    if (el) el.style.display = "";

    tsParticles.load("tsparticles", config);
}

export function destroyParticles() {
    if (instance) {
        instance.destroy();
        instance = null;
    }
}
