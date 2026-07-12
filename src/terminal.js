/* =================================================
   terminal.js — terminal panel UX
   - command input with history (↑/↓)
   - tab completion (commands + section names)
   - clickable ls menu
   - output rendering
================================================= */

export class Terminal {
    constructor({ outputEl, inputEl, sections, commands, onNavigate }) {
        this.output = outputEl;
        this.input = inputEl;
        this.sections = sections;
        this.commands = commands;
        this.onNavigate = onNavigate;

        this.history = [];
        this.historyIndex = -1;
        this._gameActive = false;

        this._bind();
    }

    print(html, cls = "line") {
        const div = document.createElement("div");
        div.className = cls;
        div.innerHTML = html;
        this.output.appendChild(div);
        this.output.scrollTop = this.output.scrollHeight;
    }

    clear() { this.output.innerHTML = ""; }

    renderMenu() {
        const ids = Object.keys(this.sections)
            .filter(id => id !== "help" && id !== "home")
            .sort((a, b) => this.sections[a].order - this.sections[b].order);

        const items = ids.map((id, i) => {
            const s = this.sections[id];
            return `<button class="menu-item" data-target="${id}">
                <span>${String(i + 1).padStart(2, "0")}.</span>
                ${s.label}
            </button>`;
        }).join("");

        this.print(items, "line menu");

        this.output.querySelectorAll(".menu-item").forEach(btn => {
            btn.addEventListener("click", () => {
                this.print(`<span class="prompt">$</span> open ${btn.dataset.target}`, "line cmd");
                this.onNavigate(btn.dataset.target);
            });
        });
    }

    run(raw) {
        const line = raw.trim();
        if (!line) return;

        this.history.push(line);
        this.historyIndex = this.history.length;

        this.print(`<span class="prompt">$</span> ${line}`, "line cmd");

        const [name, ...args] = line.split(/\s+/);
        const lower = name.toLowerCase();

        if (this.commands[lower]) {
            const result = this.commands[lower](args);
            if (result) this.print(result.join("<br>"), "line ok");
            return;
        }

        if (lower === "open" || lower === "cd") {
            const target = args[0]?.toLowerCase();
            if (!target) { this.print("usage: open &lt;section&gt;", "line err"); return; }
            this.onNavigate(target);
            return;
        }

        this.print(`command not found: ${name}  (type 'help')`, "line err");
    }

    complete(value) {
        const v = value.trim();
        if (!v) return value;

        const parts = v.split(/\s+/);

        if (parts.length === 1) {
            const all = Object.keys(this.commands).concat(["open", "cd"]);
            const matches = all.filter(c => c.startsWith(parts[0].toLowerCase()));
            if (matches.length === 1) return matches[0] + " ";
            if (matches.length > 1) this.print(matches.join("   "), "line muted");
            return value;
        }

        if (parts.length === 2 && ["open", "cd"].includes(parts[0].toLowerCase())) {
            const matches = Object.keys(this.sections)
                .filter(s => s.startsWith(parts[1].toLowerCase()));
            if (matches.length === 1) return `${parts[0]} ${matches[0]}`;
            if (matches.length > 1) this.print(matches.join("   "), "line muted");
            return value;
        }

        return value;
    }

    _bind() {
        this.input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                this.run(this.input.value);
                this.input.value = "";
                e.preventDefault();
            } else if (e.key === "Tab") {
                e.preventDefault();
                this.input.value = this.complete(this.input.value);
            } else if (e.key === "ArrowUp") {
                if (this._gameActive) return;
                e.preventDefault();
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.input.value = this.history[this.historyIndex];
                }
            } else if (e.key === "ArrowDown") {
                if (this._gameActive) return;
                e.preventDefault();
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.input.value = this.history[this.historyIndex];
                } else {
                    this.historyIndex = this.history.length;
                    this.input.value = "";
                }
            }
        });
    }

    setGameActive(active) { this._gameActive = active; }
    focus() { this.input.focus(); }
}
