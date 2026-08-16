export type CorpusSeedRow = {
  briefId?: string;
  id: string;
  retained?: boolean;
  title: string;
  category: string;
  style: string;
  content: string;
  language: string;
  is_active: boolean;
  is_public: boolean;
};

export type ApprovedReleaseContract = {
  generatedFrom: Record<string, { path: string; sha256: string }>;
  passages: Array<{
    briefId: string;
    id: string;
    retained: boolean;
    title: string;
    category: string;
    style: string;
    batch: number;
    batchOrder: number;
    wordCount: number;
    sha256: string;
    status: string;
  }>;
};

export function sha256(value: string | Uint8Array): string;
export function parseEnglishCorpusV2MigrationSeeds(sql: string): CorpusSeedRow[];
export function isExactSeededRerun(seed: CorpusSeedRow, existing: CorpusSeedRow | null | undefined): boolean;
export function findActiveDeactivationLeaks<T extends { id: string }>(
  deactivations: T[],
  activePublicPassages: Array<{ id: string }>
): T[];
export function verifyApprovedContractSources(contract: ApprovedReleaseContract, rootDir?: string): string[];
export function validateMigrationAgainstApprovedContract(sql: string, contract: ApprovedReleaseContract): string[];
