/* =================================================
   game.js — a tiny 2D platformer
   Playable with arrow keys / WASD, or via terminal
   commands: play, left, right, jump, stop.
================================================= */

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.running = false;
        this.keys = {};
        this.terminalCmd = null;

        this.player = { x: 60, y: 0, w: 22, h: 28, vx: 0, vy: 0, onGround: false };

        this.gravity = 0.55;
        this.moveSpeed = 3.2;
        this.jumpForce = 10;
        this.friction = 0.82;

        this.platforms = [];
        this.coins = [];
        this.score = 0;

        this._buildLevel();
        this._bindKeys();
    }

    _buildLevel() {
        const W = this.canvas.width;
        const H = this.canvas.height;

        this.platforms = [
            { x: 0,   y: H - 30,  w: W,   h: 30 },
            { x: 120, y: H - 90,  w: 90,  h: 12 },
            { x: 260, y: H - 140, w: 90,  h: 12 },
            { x: 400, y: H - 100, w: 80,  h: 12 },
            { x: 520, y: H - 170, w: 70,  h: 12 },
            { x: 640, y: H - 110, w: 100, h: 12 },
            { x: 780, y: H - 60,  w: 60,  h: 12 },
        ];

        this.coins = [
            { x: 155, y: H - 115, taken: false },
            { x: 295, y: H - 165, taken: false },
            { x: 430, y: H - 125, taken: false },
            { x: 545, y: H - 195, taken: false },
            { x: 680, y: H - 135, taken: false },
            { x: 800, y: H - 85,  taken: false },
        ];

        this.player.x = 60;
        this.player.y = H - 30 - this.player.h;
        this.player.vx = 0;
        this.player.vy = 0;
        this.score = 0;
    }

    _bindKeys() {
        this._keyDown = e => {
            this.keys[e.key.toLowerCase()] = true;
            if (this.running && ["arrowup","arrowdown","arrowleft","arrowright"," "].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        };
        this._keyUp = e => { this.keys[e.key.toLowerCase()] = false; };
        window.addEventListener("keydown", this._keyDown);
        window.addEventListener("keyup", this._keyUp);
    }

    start() {
        if (this.running) return "already running";
        this._buildLevel();
        this.running = true;
        this._loop();
        return "game started — arrows/WASD or terminal: left, right, jump, stop";
    }

    stop() {
        this.running = false;
        return "game stopped";
    }

    left()  { this.terminalCmd = "left";  setTimeout(() => this.terminalCmd = null, 250); }
    right() { this.terminalCmd = "right"; setTimeout(() => this.terminalCmd = null, 250); }
    jump()  { this.terminalCmd = "jump";  setTimeout(() => this.terminalCmd = null, 150); }
    stopMove() { this.terminalCmd = "stop"; setTimeout(() => this.terminalCmd = null, 150); }

    _input() {
        const k = this.keys;
        const t = this.terminalCmd;

        let left  = k["arrowleft"]  || k["a"] || t === "left";
        let right = k["arrowright"] || k["d"] || t === "right";
        let jump  = k["arrowup"]    || k["w"] || k[" "] || t === "jump";

        if (t === "stop") { left = false; right = false; }

        if (left)  this.player.vx = -this.moveSpeed;
        if (right) this.player.vx =  this.moveSpeed;
        if (!left && !right) this.player.vx *= this.friction;

        if (jump && this.player.onGround) {
            this.player.vy = -this.jumpForce;
            this.player.onGround = false;
        }
    }

    _physics() {
        const p = this.player;
        p.vy += this.gravity;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = 0;
        if (p.x + p.w > this.canvas.width) p.x = this.canvas.width - p.w;

        p.onGround = false;
        for (const pl of this.platforms) {
            if (p.x + p.w > pl.x && p.x < pl.x + pl.w &&
                p.y + p.h > pl.y && p.y < pl.y + pl.h) {
                if (p.vy > 0 && p.y + p.h - p.vy <= pl.y + 2) {
                    p.y = pl.y - p.h; p.vy = 0; p.onGround = true;
                } else if (p.vy < 0 && p.y - p.vy >= pl.y + pl.h - 2) {
                    p.y = pl.y + pl.h; p.vy = 0;
                }
            }
        }

        for (const c of this.coins) {
            if (c.taken) continue;
            if (p.x < c.x + 12 && p.x + p.w > c.x &&
                p.y < c.y + 12 && p.y + p.h > c.y) {
                c.taken = true; this.score++;
            }
        }
    }

    _draw() {
        const ctx = this.ctx;
        const W = this.canvas.width;
        const H = this.canvas.height;
        const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#6cb6ff";
        const muted  = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#8b949e";
        const border = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#1d2530";
        const bg     = getComputedStyle(document.documentElement).getPropertyValue("--window-alt").trim() || "#0b0f14";

        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

        ctx.strokeStyle = accent + "10";
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        ctx.fillStyle = border;
        for (const pl of this.platforms) {
            ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
            ctx.fillStyle = accent;
            ctx.fillRect(pl.x, pl.y, pl.w, 2);
            ctx.fillStyle = border;
        }

        for (const c of this.coins) {
            if (c.taken) continue;
            ctx.fillStyle = "#febc2e";
            ctx.beginPath(); ctx.arc(c.x + 6, c.y + 6, 5, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = accent;
        ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);
        ctx.fillStyle = bg;
        ctx.fillRect(this.player.x + 14, this.player.y + 6, 4, 4);

        ctx.fillStyle = muted;
        ctx.font = "13px 'JetBrains Mono', monospace";
        ctx.fillText(`coins: ${this.score} / ${this.coins.length}`, 12, 20);

        if (this.score === this.coins.length) {
            ctx.fillStyle = accent;
            ctx.font = "bold 20px 'JetBrains Mono', monospace";
            ctx.fillText("YOU WIN — type 'play' to restart", W / 2 - 140, H / 2);
        }
    }

    _loop() {
        if (!this.running) return;
        this._input();
        this._physics();
        this._draw();
        requestAnimationFrame(() => this._loop());
    }

    destroy() {
        this.running = false;
        window.removeEventListener("keydown", this._keyDown);
        window.removeEventListener("keyup", this._keyUp);
    }
}
