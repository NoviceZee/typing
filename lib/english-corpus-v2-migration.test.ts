import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isExactSeededRerun,
  validateMigrationAgainstApprovedContract,
  verifyApprovedContractSources
} from "../scripts/englishCorpusV2MigrationContract.mjs";

const migrationPath = "supabase/migrations/202608090001_english_corpus_v2.sql";
const approvedContractPath = "outputs/english-corpus-v2/approved/english-corpus-v2-release-contract.json";
const retainedIds = [
  "ba0f8790-0f76-4f5e-b8a5-da982790ef5c", "fd2dd1c5-a220-4e9b-955a-7e7d1588ec56",
  "70c4aca3-fe8f-4c24-b8bb-6a712f07b3db", "f29ca6e3-783e-4590-bfed-f45bfe4961d5",
  "248158a6-12d4-4c29-a3fd-2f8d8468b402", "bc9cc109-e666-4b1b-ad25-60a134a6a3ab",
  "e90fe4d4-05f5-49b6-a492-7c836c2050eb", "f0add780-3d92-4dca-8c99-c19173a8b6fe",
  "dbfc3376-f2ec-49fc-996f-7b0ce865990a", "3dd4d7ef-252e-4502-a683-e3c26cd6959d",
  "cb49ecbe-b752-481f-8a53-b4742085bd99", "682bc8fc-1d1f-4dbe-ade6-43cc84385fba",
  "175eca7f-23d1-4da5-b7d9-538c6f20e88e", "64f6857d-fa40-4c71-87be-b133810dd9c9",
  "3287f915-e590-47dd-8f74-e8c16fb658c3", "7cc18c21-9347-45ab-ab01-0d65a1c1cee0",
  "2ccf24c0-1a68-45a8-ab81-eec10238062d", "4cae241a-8af6-40b5-afa4-11d7742e1443",
  "3f611bfe-c197-4708-bbbe-c58be57ff7e6", "d800ba7c-e99a-420b-b141-becb16ed2c76",
  "62e392f2-7bdd-4e7c-93f7-d902b473c46d", "6947738b-52f4-4196-af0e-054d20d80e2f",
  "56ab756e-b97e-44aa-8658-2c893aed52f9", "9bce4cff-5c6e-4780-a9ae-78a11e57af71",
  "cab3d15c-cb20-4fa2-a6df-a096fece199e", "20030528-60b9-475b-905d-d29ad44f3b98",
  "604ea509-1508-4bf6-8fdb-395928dd754a", "ad1c394c-f3e9-493e-b3fa-a906ad7b8af7",
  "dd1e645f-0713-4fbc-8ff7-cf039653cfd1", "283bca77-6486-4a0a-92a2-9209a9c48492",
  "d7591888-42b6-4f9b-89cc-ed5c8ab7d3d2", "66304766-4e1c-40e1-86c9-ba58d7029177",
  "a66bcad1-3b90-4ca0-8c8b-861987e1e11f", "ed0e9fad-b181-4f08-bf3a-8b5c71fe6da7",
  "607eff87-49e0-4439-a52a-198daa10a45b", "e176c4ce-d0fd-49d3-b576-559e398f9dda",
  "7dfb275e-86d1-4f9f-a8dd-69ee04854e3f", "a8e0bd50-a8ae-4150-80b1-ec8dd20ac14c",
  "d9b28b43-0216-414c-b782-585602865712", "e2beb944-f1c7-423a-b1e6-f0fef5f5a49f"
];
const deactivatedIds = [
  "c13f0f8c-cefb-4d93-9b74-241d3229e448", "443f564d-7b45-4008-a0b3-6ae275ca9f9f",
  "a903c9e1-356c-4204-8091-f0ad3f308f4d", "0179ca91-3532-45ad-97ac-ea9dae8bbc09",
  "47c4994c-ef4e-47ec-9736-5e86916586cd", "a5488771-cfb4-47c5-bec6-d71899c442aa",
  "ef8eaa37-80eb-4c0e-be7d-8bbf0d9a06ae", "04c16e3c-0f9c-4d38-80c0-2edbe57e4b5d",
  "f0c7ba6a-07e9-4efb-8289-845f36f6f56f"
];
const categories = [
  "Articles", "Personal writing", "News", "Business communication",
  "Government & public information", "Proposals & tenders", "Legal & contracts"
];

function parseSeedRows(sql: string) {
  const pattern = /^\s*\('([^']+)', '([0-9a-f-]+)'::uuid, (true|false), '((?:''|[^'])*)', '([^']+)', 'General', '([0-9a-f]{64})', \$ecv2\$/gm;
  return Array.from(sql.matchAll(pattern), (match) => ({
    briefId: match[1], id: match[2], retained: match[3] === "true",
    title: match[4].replaceAll("''", "'"), category: match[5], hash: match[6]
  }));
}

describe("English Corpus v2 production migration contract", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const rows = parseSeedRows(sql);

  it("contains the locked 40 updates, 100 inserts, and 140 final records", () => {
    expect(rows).toHaveLength(140);
    expect(rows.filter((row) => row.retained)).toHaveLength(40);
    expect(rows.filter((row) => !row.retained)).toHaveLength(100);
    expect(new Set(rows.map((row) => row.briefId)).size).toBe(140);
    expect(new Set(rows.map((row) => row.id)).size).toBe(140);
    expect(new Set(rows.map((row) => row.title)).size).toBe(140);
    expect(rows.filter((row) => row.retained).map((row) => row.id).sort()).toEqual(retainedIds.sort());
  });

  it("contains exactly 20 records in each public category and no Random category", () => {
    for (const category of categories) {
      expect(rows.filter((row) => row.category === category)).toHaveLength(20);
    }
    expect(rows.some((row) => row.category === "Random paragraph")).toBe(false);
  });

  it("deactivates exactly the nine approved legacy passage IDs", () => {
    const ids = Array.from(
      sql.matchAll(/^\s*\('([0-9a-f-]+)'::uuid, '[^']+'\)(?:,|;)?$/gm),
      (match) => match[1]
    );
    expect(ids.sort()).toEqual(deactivatedIds.sort());
  });

  it("uses passage-specific assignments and guards the migration transaction", () => {
    expect(rows.find((row) => row.title === "A Library Open After Dark")?.category).toBe("News");
    expect(rows.find((row) => row.title === "The Useful Pause")?.category).toBe("Articles");
    expect(rows.find((row) => row.title === "Why Slow Practice Works")?.category).toBe("Articles");
    expect(sql).toContain("begin;");
    expect(sql).toContain("on conflict (id) do update");
    expect(sql).toContain("Corpus v2 postflight failed");
    expect(sql).toContain("language = 'english'");
    expect(sql).not.toMatch(/set\s+category\s*=\s*case\s+category/i);
  });

  it("accepts only a complete exact seeded row as a deterministic-ID rerun", () => {
    const seed = {
      id: "11111111-1111-5111-8111-111111111111",
      language: "english",
      title: "Seed title",
      category: "Articles",
      style: "General",
      content: "Approved content.",
      is_active: true,
      is_public: true
    };

    expect(isExactSeededRerun(seed, { ...seed })).toBe(true);
    expect(isExactSeededRerun(seed, { ...seed, content: "Different content." })).toBe(false);
    expect(isExactSeededRerun(seed, { ...seed, category: "News" })).toBe(false);
    expect(isExactSeededRerun(seed, { ...seed, style: "Formal" })).toBe(false);
    expect(isExactSeededRerun(seed, { ...seed, is_active: false })).toBe(false);
    expect(isExactSeededRerun(seed, { ...seed, is_public: false })).toBe(false);
    expect(isExactSeededRerun(seed, { ...seed, language: "chinese" })).toBe(false);
  });

  it("guards every seeded identity field before any production mutation", () => {
    const guard = sql.slice(sql.indexOf("select count(*) into colliding_new_ids"), sql.indexOf("select count(*) into colliding_titles"));
    expect(guard).toContain("passage.id");
    expect(guard).toContain("passage.language is distinct from 'english'");
    expect(guard).toContain("passage.title is distinct from seed.title");
    expect(guard).toContain("passage.category is distinct from seed.category");
    expect(guard).toContain("passage.style is distinct from seed.style");
    expect(guard).toContain("digest(passage.content, 'sha256')");
    expect(guard).toContain("passage.is_active is distinct from true");
    expect(guard).toContain("passage.is_public is distinct from true");
    expect(sql.indexOf("select count(*) into colliding_new_ids")).toBeLessThan(sql.indexOf("update public.passages passage"));
  });

  it("validates migration prose and hashes against the independent locked approved baseline", () => {
    const contract = JSON.parse(readFileSync(approvedContractPath, "utf8"));
    expect(verifyApprovedContractSources(contract)).toEqual([]);
    expect(validateMigrationAgainstApprovedContract(sql, contract)).toEqual([]);

    const driftedContract = structuredClone(contract);
    driftedContract.passages[0].sha256 = "0".repeat(64);
    expect(verifyApprovedContractSources(driftedContract)).toContain(
      `${rows[0].briefId}: release contract hash differs from approved baseline workbook`
    );

    const first = rows[0];
    const originalContent = sql.match(new RegExp(`'${first.hash}', \\$ecv2\\$([\\s\\S]*?)\\$ecv2\\$`))?.[1];
    expect(originalContent).toBeTruthy();
    const driftedContent = `${originalContent} Drifted.`;
    const driftedHash = createHash("sha256").update(driftedContent).digest("hex");
    const coupledDrift = sql
      .replace(first.hash, driftedHash)
      .replace(originalContent!, driftedContent);
    expect(validateMigrationAgainstApprovedContract(coupledDrift, contract)).toContain(
      `${first.briefId}: migration hash differs from approved baseline`
    );
  });
});
