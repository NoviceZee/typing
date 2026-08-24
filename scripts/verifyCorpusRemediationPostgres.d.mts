export interface CorpusRemediationPassage {
  oldId: string;
  oldTitle: string;
  newId: string;
  title: string;
  category: string;
  language: string;
}

export interface MigrationFile {
  name: string;
  path: string;
}

export function listMigrationsThrough(
  repoRoot: URL | string,
  cutoff: string,
): Promise<MigrationFile[]>;
export function buildSupabaseBootstrapSql(): string;
export function injectForcedFailure(
  source: string,
  phase: "before_bypass" | "after_bypass",
): string;
export function buildHistoricalResultSeedSql(
  passages: CorpusRemediationPassage[],
  userId: string,
): string;
export function extractBGuardIds(source: string): string[];
export function buildPsqlFileArgs(connection: string[], path: string): string[];
export function buildEnglishV2PrerequisiteSql(migrationSource: string): string;
export function buildOldCIdentityReconciliationSql(
  passages: CorpusRemediationPassage[],
): string;
export function buildProductionCountFixtureSql(): string;
export function getTemporaryClusterPrefix(): string;
export function lastScalarResult(output: string): string;
export function runDisposablePostgresLifecycle<T>(operations: {
  prepare: () => void | Promise<void>;
  start: () => void | Promise<void>;
  work: () => T | Promise<T>;
  stop: () => void | Promise<void>;
  isRunning: () => boolean | Promise<boolean>;
  remove: () => void | Promise<void>;
}): Promise<T>;
