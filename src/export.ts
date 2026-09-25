import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { HealthReport } from "./types.js";

const esc = (value: string) =>
  value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

export async function writeJson(report: HealthReport, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(report, null, 2), "utf8");
}

export async function writeHtml(report: HealthReport, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const findings = report.findings.map(f => `
    <tr>
      <td><span class="badge ${f.severity}">${esc(f.severity)}</span></td>
      <td>${esc(f.code)}</td>
      <td>${esc(f.package ?? "—")}</td>
      <td>${esc(f.message)}</td>
    </tr>`).join("");

  const deps = report.directDependencies.map(d => `
    <tr>
      <td>${esc(d.name)}</td>
      <td>${esc(d.requested)}</td>
      <td>${esc(d.latest ?? "—")}</td>
      <td>${d.outdated === null ? "?" : d.outdated ? "yes" : "no"}</td>
      <td>${d.deprecated === null ? "?" : d.deprecated ? "yes" : "no"}</td>
    </tr>`).join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>dependency-health — ${esc(report.project.name)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f6f8;color:#141922;font:14px/1.5 Inter,system-ui,sans-serif}
main{width:min(1150px,calc(100% - 32px));margin:48px auto}h1{font-size:48px;letter-spacing:-.05em;margin:5px 0}
.muted{color:#7a8490}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:28px 0}
.card{background:#fff;border-radius:18px;padding:18px}.card span{color:#7a8490;font-size:11px;text-transform:uppercase}.card strong{display:block;font-size:28px}
section{margin-top:30px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden}
th,td{padding:12px 14px;border-bottom:1px solid #eceff3;text-align:left;vertical-align:top}
th{color:#7a8490;font-size:11px;text-transform:uppercase}.badge{padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800;text-transform:uppercase}
.high{background:#ffe0e4;color:#a62f42}.medium{background:#fff0c9;color:#8a6514}.low{background:#dfeaff;color:#315a9c}.info{background:#e8ebee;color:#58616d}
@media(max-width:760px){.grid{grid-template-columns:repeat(2,1fr)}h1{font-size:38px}}
</style>
</head>
<body><main>
<div class="muted">DEPENDENCY HEALTH REPORT</div>
<h1>${esc(report.project.name)}</h1>
<div class="muted">${esc(report.project.path)} · ${esc(report.generatedAt)}</div>

<div class="grid">
<div class="card"><span>Direct deps</span><strong>${report.summary.directDependencies}</strong></div>
<div class="card"><span>Outdated</span><strong>${report.summary.outdated}</strong></div>
<div class="card"><span>Duplicates</span><strong>${report.summary.duplicatePackages}</strong></div>
<div class="card"><span>High findings</span><strong>${report.summary.high}</strong></div>
</div>

<section><h2>Lockfile</h2>
<p class="muted">${esc(report.lock.file ?? "none")} · ${report.lock.packageCount} entries · ${report.lock.uniquePackages} unique packages</p></section>

<section><h2>Findings</h2><table>
<thead><tr><th>Severity</th><th>Code</th><th>Package</th><th>Message</th></tr></thead>
<tbody>${findings || '<tr><td colspan="4">No findings</td></tr>'}</tbody>
</table></section>

<section><h2>Direct dependencies</h2><table>
<thead><tr><th>Package</th><th>Requested</th><th>Latest</th><th>Outdated</th><th>Deprecated</th></tr></thead>
<tbody>${deps || '<tr><td colspan="5">No dependencies</td></tr>'}</tbody>
</table></section>
</main></body></html>`;

  await writeFile(path, html, "utf8");
}
