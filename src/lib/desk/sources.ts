import type { SourceLink } from "./types";

function escapeHtml(value: string): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  return value.replace(/[&<>"]/g, (ch) => (ch === "&" ? amp : ch === "<" ? lt : ch === ">" ? gt : quot));
}

const NONE = "Sorry no info could be retrieved from web search.";

export function openSourcesPage(title: string, links: SourceLink[]) {
  const rows = links.map((link) => {
    const status = link.status === "empty" ? "empty" : "found";
    const detail = link.detail?.trim() || (status === "empty" ? NONE : "");
    const open =
      status === "found" && link.url
        ? `<a class="btn" href="${escapeHtml(link.url)}">Open</a>`
        : "";
    return `<article class="card">
      <div class="top"><span class="pill ${status}">${status === "found" ? "Found" : "No info"}</span><h2>${escapeHtml(link.label || "Check")}</h2></div>
      <p>${escapeHtml(detail || NONE)}</p>
      ${open}
    </article>`;
  });
  const empty = links.length === 0 || links.every((link) => link.status === "empty");
  const banner = empty ? `<p class="banner">${NONE}</p>` : `<p class="lead">These are the checks that ran for this window, and what each one returned.</p>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title || "Sources")}</title>
<style>
html,body{margin:0;background:#101820;color:#e8eef6}
body{max-width:720px;margin:0 auto;padding:1.5rem;font:16px/1.45 sans-serif}
h1{font-size:1.6rem;margin:0 0 .4rem}
.lead,.banner{color:#c5d4e0}
.banner{border:1px solid #e23b4a;border-radius:12px;padding:.8rem 1rem}
.card{margin:.8rem 0;padding:1rem;border:1px solid #2a3644;border-radius:14px;background:#18222c}
.top{display:flex;align-items:center;gap:.6rem}
h2{font-size:1rem;margin:0}
.pill{font-size:11px;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:.15rem .5rem}
.found{background:#143226;color:#8ee0b0}
.empty{background:#3a1d22;color:#f0a0a8}
p{margin:.6rem 0}
.btn{display:inline-block;text-decoration:none;color:#101820;background:#3ec6ff;border-radius:999px;padding:.35rem .8rem;font-size:14px}
</style></head><body>
<h1>${escapeHtml(title || "Sources")}</h1>
${banner}
${rows.join("") || `<p class="banner">${NONE}</p>`}
</body></html>`;
  const page = window.open("", "_blank");
  if (!page) return;
  page.document.open();
  page.document.write(html);
  page.document.close();
}