/* =================================================
   navigation.js — preview panel transitions
================================================= */

export class Navigation {
    constructor(previewEl, breadcrumbEl, sections) {
        this.preview = previewEl;
        this.breadcrumb = breadcrumbEl;
        this.sections = sections;
        this.current = null;
        this.onNavigate = null;
    }

    async navigate(id) {
        const section = this.sections[id];
        if (!section) return false;

        this.current = id;
        this.breadcrumb.textContent = `yassine@portfolio:${section.label}`;

        this.preview.classList.add("switching");
        await new Promise(r => setTimeout(r, 200));

        let inner;
        try {
            inner = await section.loadHTML();
        } catch (e) {
            inner = `<p class="error">Failed to load: ${e.message}</p>`;
        }

        this.preview.innerHTML = inner;
        this.preview.scrollTop = 0;
        this.preview.classList.remove("switching");

        if (this.onNavigate) this.onNavigate(id);
        return true;
    }
}
