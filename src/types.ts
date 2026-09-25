export type Severity = "info" | "low" | "medium" | "high";

export interface DirectDependency {
  name: string;
  requested: string;
  section: string;
}

export interface Finding {
  severity: Severity;
  code: string;
  package?: string;
  message: string;
}

export interface DuplicateVersion {
  name: string;
  versions: string[];
  majorCount: number;
}

export interface LockSummary {
  type: "npm" | "pnpm" | "yarn" | "none";
  file: string | null;
  packageCount: number;
  uniquePackages: number;
  maxDepth: number | null;
  duplicates: DuplicateVersion[];
}

export interface DependencyStatus extends DirectDependency {
  latest: string | null;
  outdated: boolean | null;
  deprecated: boolean | null;
}

export interface HealthReport {
  project: { name: string; version: string | null; path: string };
  generatedAt: string;
  lock: LockSummary;
  directDependencies: DependencyStatus[];
  findings: Finding[];
  summary: {
    directDependencies: number;
    outdated: number;
    deprecated: number;
    duplicatePackages: number;
    duplicateMajors: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}
