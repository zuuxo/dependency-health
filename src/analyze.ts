import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import semver from "semver";
import { analyzeLockfile } from "./lockfile.js";
import type {
  DependencyStatus,
  DirectDependency,
  Finding,
  HealthReport
} from "./types.js";

function collectDependencies(pkg: any): DirectDependency[] {
  const sections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ];

  const result: DirectDependency[] = [];

  for (const section of sections) {
    for (const [name, requested] of Object.entries<string>(pkg[section] ?? {})) {
      result.push({ name, requested, section });
    }
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

async function registryInfo(name: string): Promise<{
  latest: string | null;
  deprecated: boolean;
  message: string | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const encoded = name.startsWith("@")
      ? `@${encodeURIComponent(name.slice(1))}`
      : encodeURIComponent(name);

    const response = await fetch(`https://registry.npmjs.org/${encoded}`, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) return { latest: null, deprecated: false, message: null };

    const data = await response.json() as any;
    const latest = data["dist-tags"]?.latest ?? null;
    const message = latest && typeof data.versions?.[latest]?.deprecated === "string"
      ? data.versions[latest].deprecated
      : null;

    return { latest, deprecated: Boolean(message), message };
  } catch {
    return { latest: null, deprecated: false, message: null };
  } finally {
    clearTimeout(timer);
  }
}

function rangeFindings(dep: DirectDependency): Finding[] {
  const value = dep.requested.trim();
  const findings: Finding[] = [];

  if (value === "*" || value.toLowerCase() === "latest") {
    findings.push({
      severity: "high",
      code: "UNBOUNDED_RANGE",
      package: dep.name,
      message: `${dep.name} uses an unbounded version range (${value}).`
    });
  }

  if (/^(git\+|github:|https?:)/.test(value)) {
    findings.push({
      severity: "medium",
      code: "REMOTE_SOURCE",
      package: dep.name,
      message: `${dep.name} is installed from a remote source instead of a registry version.`
    });
  }

  if (/^(file:|link:)/.test(value)) {
    findings.push({
      severity: "info",
      code: "LOCAL_SOURCE",
      package: dep.name,
      message: `${dep.name} is linked from a local path.`
    });
  }

  if (semver.valid(value)) {
    findings.push({
      severity: "low",
      code: "EXACT_VERSION",
      package: dep.name,
      message: `${dep.name} is pinned to exact version ${value}.`
    });
  }

  return findings;
}

export async function analyzeProject(
  inputPath: string,
  online: boolean
): Promise<HealthReport> {
  const project = resolve(inputPath);
  const pkg = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
  const deps = collectDependencies(pkg);
  const lock = await analyzeLockfile(project);
  const findings: Finding[] = [];

  if (lock.type === "none") {
    findings.push({
      severity: "high",
      code: "NO_LOCKFILE",
      message: "No supported lockfile found."
    });
  }

  for (const dep of deps) findings.push(...rangeFindings(dep));

  for (const duplicate of lock.duplicates) {
    findings.push({
      severity: duplicate.majorCount > 1 ? "high" : "medium",
      code: duplicate.majorCount > 1 ? "MULTIPLE_MAJORS" : "DUPLICATE_VERSIONS",
      package: duplicate.name,
      message:
        `${duplicate.name} resolves to ${duplicate.versions.length} versions` +
        `${duplicate.majorCount > 1 ? ` across ${duplicate.majorCount} majors` : ""}: ` +
        duplicate.versions.join(", ")
    });
  }

  const statuses: DependencyStatus[] = [];

  for (const dep of deps) {
    const registry = online
      ? await registryInfo(dep.name)
      : { latest: null, deprecated: false, message: null };

    let outdated: boolean | null = null;
    const current = semver.minVersion(dep.requested)?.version ?? null;

    if (current && registry.latest && semver.valid(registry.latest)) {
      outdated = semver.lt(current, registry.latest);

      if (outdated) {
        const diff = semver.diff(current, registry.latest);
        findings.push({
          severity: diff === "major" || diff === "premajor" ? "medium" : "low",
          code: "OUTDATED_DIRECT",
          package: dep.name,
          message: `${dep.name} is behind latest: ${current} -> ${registry.latest}.`
        });
      }
    }

    if (registry.deprecated) {
      findings.push({
        severity: "high",
        code: "DEPRECATED_PACKAGE",
        package: dep.name,
        message: registry.message
          ? `${dep.name} is deprecated: ${registry.message}`
          : `${dep.name} is deprecated.`
      });
    }

    statuses.push({
      ...dep,
      latest: registry.latest,
      outdated,
      deprecated: online ? registry.deprecated : null
    });
  }

  if (lock.packageCount > 1000) {
    findings.push({
      severity: "medium",
      code: "LARGE_TREE",
      message: `Lockfile contains ${lock.packageCount} package entries.`
    });
  } else if (lock.packageCount > 500) {
    findings.push({
      severity: "low",
      code: "LARGE_TREE",
      message: `Lockfile contains ${lock.packageCount} package entries.`
    });
  }

  const count = (s: string) => findings.filter(f => f.severity === s).length;

  return {
    project: {
      name: pkg.name ?? "(unnamed)",
      version: pkg.version ?? null,
      path: project
    },
    generatedAt: new Date().toISOString(),
    lock,
    directDependencies: statuses,
    findings,
    summary: {
      directDependencies: deps.length,
      outdated: statuses.filter(d => d.outdated === true).length,
      deprecated: statuses.filter(d => d.deprecated === true).length,
      duplicatePackages: lock.duplicates.length,
      duplicateMajors: lock.duplicates.filter(d => d.majorCount > 1).length,
      high: count("high"),
      medium: count("medium"),
      low: count("low"),
      info: count("info")
    }
  };
}
