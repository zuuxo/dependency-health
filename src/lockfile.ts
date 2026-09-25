import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import semver from "semver";
import type { DuplicateVersion, LockSummary } from "./types.js";

type VersionMap = Map<string, Set<string>>;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function addVersion(map: VersionMap, name: string, version: string): void {
  if (!name || !version) return;
  const versions = map.get(name) ?? new Set<string>();
  versions.add(version);
  map.set(name, versions);
}

function npmName(path: string): string | null {
  const tail = path.split("node_modules/").pop();
  if (!tail) return null;
  const parts = tail.split("/");
  if (parts[0]?.startsWith("@") && parts[1]) return `${parts[0]}/${parts[1]}`;
  return parts[0] || null;
}

function duplicates(map: VersionMap): DuplicateVersion[] {
  return [...map.entries()]
    .filter(([, versions]) => versions.size > 1)
    .map(([name, versions]) => {
      const list = [...versions];
      const majors = new Set(
        list.map(v => semver.valid(v) ? semver.major(v) : null)
            .filter((v): v is number => v !== null)
      );
      return { name, versions: list.sort(), majorCount: majors.size };
    })
    .sort((a, b) => b.majorCount - a.majorCount || b.versions.length - a.versions.length);
}

async function npmLock(project: string): Promise<LockSummary> {
  const raw = await readFile(join(project, "package-lock.json"), "utf8");
  const data = JSON.parse(raw) as any;
  const map: VersionMap = new Map();
  let count = 0;
  let depth = 0;

  for (const [path, meta] of Object.entries<any>(data.packages ?? {})) {
    if (!path) continue;
    count++;
    const name = meta.name || npmName(path);
    if (name && meta.version) addVersion(map, name, meta.version);
    depth = Math.max(depth, (path.match(/node_modules\//g) ?? []).length);
  }

  return {
    type: "npm",
    file: "package-lock.json",
    packageCount: count,
    uniquePackages: map.size,
    maxDepth: depth,
    duplicates: duplicates(map)
  };
}

async function pnpmLock(project: string): Promise<LockSummary> {
  const raw = await readFile(join(project, "pnpm-lock.yaml"), "utf8");
  const data = YAML.parse(raw) as any;
  const map: VersionMap = new Map();
  const packages = data.packages ?? data.snapshots ?? {};
  let count = 0;

  for (const key of Object.keys(packages)) {
    const clean = key.replace(/^\/+/, "").split("(")[0];
    const at = clean.lastIndexOf("@");
    if (at <= 0) continue;
    const name = clean.slice(0, at);
    const version = clean.slice(at + 1);
    if (!name || !version) continue;
    count++;
    addVersion(map, name, version);
  }

  return {
    type: "pnpm",
    file: "pnpm-lock.yaml",
    packageCount: count,
    uniquePackages: map.size,
    maxDepth: null,
    duplicates: duplicates(map)
  };
}

async function yarnLock(project: string): Promise<LockSummary> {
  const raw = await readFile(join(project, "yarn.lock"), "utf8");
  const map: VersionMap = new Map();
  let current = "";
  let count = 0;

  for (const line of raw.split(/\r?\n/)) {
    if (line && !line.startsWith(" ") && line.endsWith(":")) {
      current = line.split(",")[0].trim().replace(/^"|"$/g, "").slice(0, -1);
      continue;
    }

    const versionMatch = line.match(/^\s+version\s+"([^"]+)"/);
    if (!versionMatch || !current) continue;

    const name = current.startsWith("@")
      ? current.slice(0, current.indexOf("@", 1))
      : current.slice(0, current.indexOf("@"));

    if (name) {
      count++;
      addVersion(map, name, versionMatch[1]);
    }
    current = "";
  }

  return {
    type: "yarn",
    file: "yarn.lock",
    packageCount: count,
    uniquePackages: map.size,
    maxDepth: null,
    duplicates: duplicates(map)
  };
}

export async function analyzeLockfile(project: string): Promise<LockSummary> {
  if (await exists(join(project, "package-lock.json"))) return npmLock(project);
  if (await exists(join(project, "pnpm-lock.yaml"))) return pnpmLock(project);
  if (await exists(join(project, "yarn.lock"))) return yarnLock(project);

  return {
    type: "none",
    file: null,
    packageCount: 0,
    uniquePackages: 0,
    maxDepth: null,
    duplicates: []
  };
}
