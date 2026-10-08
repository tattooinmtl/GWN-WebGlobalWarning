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
  const usable = links.filter((link) => link.label && link.url);
  const body = usable.length
    ? `<ul>${usable
        .map(
          (link) =>
            `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a><div>${escapeHtml(link.url)}</div></li>`,
        )
        .join("")}</ul>`
    : `<p>${NONE}</p>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title || "Sources")}</title><style>html,body{margin:0;background:#101820;color:#e8eef6}body{padding:2rem;font:16px/1.45 sans-serif}a{color:#3ec6ff}li{margin:.8rem 0}div{color:#8ea0b3;font-size:13px;word-break:break-all}</style></head><body><h1>${escapeHtml(title || "Sources")}</h1>${body}</body></html>`;
  const page = window.open("", "_blank");
  if (!page) return;
  page.document.open();
  page.document.write(html);
  page.document.close();
}
