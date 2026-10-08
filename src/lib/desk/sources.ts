import type { SourceLink } from "./types";

function escapeHtml(value: string): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  return value.replace(/[&<>"]/g, (ch) => (ch === "&" ? amp : ch === "<" ? lt : ch === ">" ? gt : quot));
}

export function openSourcesPage(title: string, links: SourceLink[]) {
  const page = window.open("", "_blank", "noopener,noreferrer");
  if (!page) return;
  const rows = links
    .map(
      (link) =>
        `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a><div>${escapeHtml(link.url)}</div></li>`,
    )
    .join("");
  page.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} sources</title>
  <style>
    body { margin: 2rem; font: 16px/1.45 "IBM Plex Sans", sans-serif; background: #101820; color: #e8eef6; }
    a { color: #3ec6ff; }
    li { margin: 0.8rem 0; }
    div { color: #8ea0b3; font-size: 13px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>Sources for this GWN window. The map stays open in the other tab.</p>
  <ul>${rows || "<li>No links were attached.</li>"}</ul>
</body>
</html>`);
  page.document.close();
}
