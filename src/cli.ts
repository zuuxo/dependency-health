#!/usr/bin/env node
import { Command } from "commander";
import { analyzeProject } from "./analyze.js";
import { writeHtml, writeJson } from "./export.js";

const program = new Command();

program
  .name("dependency-health")
  .description("Audit dependency freshness, duplication and lockfile health")
  .version("0.1.0")
  .argument("[path]", "Project directory", ".")
  .option("--offline", "Skip npm registry lookups")
  .option("--json <path>", "Write JSON report")
  .option("--html <path>", "Write standalone HTML report")
  .option("--fail-on <severity>", "high, medium or low", "high")
  .action(async (path, options) => {
    try {
      const report = await analyzeProject(path, !options.offline);

      console.log(`dependency-health`);
      console.log(`${report.project.name}${report.project.version ? `@${report.project.version}` : ""}`);
      console.log("");
      console.log(
        `lockfile: ${report.lock.file ?? "none"} | packages: ${report.lock.packageCount} | unique: ${report.lock.uniquePackages}`
      );
      if (report.lock.maxDepth !== null) {
        console.log(`max npm tree depth: ${report.lock.maxDepth}`);
      }
      console.log(
        `direct: ${report.summary.directDependencies} | outdated: ${report.summary.outdated} | deprecated: ${report.summary.deprecated} | duplicates: ${report.summary.duplicatePackages}`
      );
      console.log(
        `findings: high ${report.summary.high} / medium ${report.summary.medium} / low ${report.summary.low} / info ${report.summary.info}`
      );

      if (report.findings.length) {
        console.log("\nFindings");
        const rank = { high: 4, medium: 3, low: 2, info: 1 };
        for (const finding of [...report.findings].sort((a,b)=>rank[b.severity]-rank[a.severity])) {
          console.log(
            `[${finding.severity.toUpperCase()}] ${finding.code}` +
            `${finding.package ? ` (${finding.package})` : ""}: ${finding.message}`
          );
        }
      }

      if (options.json) {
        await writeJson(report, options.json);
        console.log(`\nJSON report: ${options.json}`);
      }

      if (options.html) {
        await writeHtml(report, options.html);
        console.log(`HTML report: ${options.html}`);
      }

      const thresholds: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const threshold = thresholds[String(options.failOn).toLowerCase()];

      if (!threshold) throw new Error("--fail-on must be high, medium or low");

      const severity: Record<string, number> = { high: 3, medium: 2, low: 1, info: 0 };
      process.exitCode = report.findings.some(f => severity[f.severity] >= threshold) ? 1 : 0;
    } catch (error) {
      console.error(`dependency-health: ${error instanceof Error ? error.message : "unknown error"}`);
      process.exitCode = 2;
    }
  });

await program.parseAsync(process.argv);
