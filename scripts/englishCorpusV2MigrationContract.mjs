import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const seedPattern = /^\s*\('([^']+)', '([0-9a-f-]+)'::uuid, (true|false), '((?:''|[^'])*)', '([^']+)', '([^']+)', '([0-9a-f]{64})', \$ecv2\$([\s\S]*?)\$ecv2\$\)(?:,|;)$/gm;

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function parseEnglishCorpusV2MigrationSeeds(sql) {
  return Array.from(sql.matchAll(seedPattern), (match) => ({
    briefId: match[1],
    id: match[2],
    retained: match[3] === "true",
    title: unquote(match[4]),
    category: match[5],
    style: match[6],
    hash: match[7],
    content: match[8],
    language: "english",
    is_active: true,
    is_public: true
  }));
}

export function isExactSeededRerun(seed, existing) {
  return Boolean(
    existing
    && existing.id === seed.id
    && existing.language === seed.language
    && existing.title === seed.title
    && existing.category === seed.category
    && existing.style === seed.style
    && sha256(existing.content) === sha256(seed.content)
    && existing.is_active === seed.is_active
    && existing.is_public === seed.is_public
  );
}

export function findActiveDeactivationLeaks(deactivations, activePublicPassages) {
  const activeIds = new Set(activePublicPassages.map((passage) => passage.id));
  return deactivations.filter((passage) => activeIds.has(passage.id));
}

export function verifyApprovedContractSources(contract, rootDir = process.cwd()) {
  const errors = [];
  for (const source of Object.values(contract.generatedFrom ?? {})) {
    const actual = sha256(readFileSync(resolve(rootDir, source.path)));
    if (actual !== source.sha256) errors.push(`${source.path}: source workbook hash differs from release contract`);
  }

  const baselineSource = contract.generatedFrom?.approvedBaseline;
  const manifestSource = contract.generatedFrom?.editorialManifest;
  if (!baselineSource || !manifestSource) return [...errors, "release contract source workbook metadata is incomplete"];

  const baselineRows = readXlsxSheetRows(resolve(rootDir, baselineSource.path), "xl/worksheets/sheet2.xml").slice(1);
  const manifestRows = readXlsxSheetRows(resolve(rootDir, manifestSource.path), "xl/worksheets/sheet2.xml").slice(1);
  const baselineByBrief = new Map(baselineRows.map((row) => [row.A, row]));
  const manifestByBrief = new Map(manifestRows.map((row) => [row.A, row]));

  if (baselineByBrief.size !== 140) errors.push(`approved baseline workbook contains ${baselineByBrief.size} Brief IDs, expected 140`);
  if (manifestByBrief.size !== 140) errors.push(`editorial manifest workbook contains ${manifestByBrief.size} Brief IDs, expected 140`);

  for (const passage of contract.passages ?? []) {
    const baseline = baselineByBrief.get(passage.briefId);
    const manifest = manifestByBrief.get(passage.briefId);
    if (!baseline) {
      errors.push(`${passage.briefId}: missing from approved baseline workbook`);
      continue;
    }
    if (!manifest) {
      errors.push(`${passage.briefId}: missing from editorial manifest workbook`);
      continue;
    }
    if (passage.title !== baseline.B) errors.push(`${passage.briefId}: release contract title differs from approved baseline workbook`);
    if (passage.sha256 !== baseline.F) errors.push(`${passage.briefId}: release contract hash differs from approved baseline workbook`);
    if (Number(passage.batch) !== Number(baseline.C)) errors.push(`${passage.briefId}: release contract batch differs from approved baseline workbook`);
    if (Number(passage.batchOrder) !== Number(baseline.D)) errors.push(`${passage.briefId}: release contract batch order differs from approved baseline workbook`);
    if (Number(passage.wordCount) !== Number(baseline.E)) errors.push(`${passage.briefId}: release contract word count differs from approved baseline workbook`);
    if (passage.status !== baseline.G) errors.push(`${passage.briefId}: release contract status differs from approved baseline workbook`);

    const retained = manifest.B !== "NEW";
    const expectedId = retained ? manifest.B : uuidV5(`typing-station:english-corpus-v2:${passage.briefId}`);
    if (passage.retained !== retained) errors.push(`${passage.briefId}: release contract disposition differs from editorial manifest workbook`);
    if (passage.id !== expectedId) errors.push(`${passage.briefId}: release contract passage ID differs from editorial manifest workbook`);
    if (passage.category !== manifest.E) errors.push(`${passage.briefId}: release contract category differs from editorial manifest workbook`);
  }
  return errors;
}

export function validateMigrationAgainstApprovedContract(sql, contract) {
  const errors = [];
  const seeds = parseEnglishCorpusV2MigrationSeeds(sql);
  const seedByBrief = new Map(seeds.map((seed) => [seed.briefId, seed]));
  const approved = contract.passages ?? [];

  if (seeds.length !== 140) errors.push(`migration seed count is ${seeds.length}, expected 140`);
  if (approved.length !== 140) errors.push(`approved contract count is ${approved.length}, expected 140`);

  for (const expected of approved) {
    const actual = seedByBrief.get(expected.briefId);
    if (!actual) {
      errors.push(`${expected.briefId}: missing from migration`);
      continue;
    }
    if (actual.id !== expected.id) errors.push(`${expected.briefId}: passage ID differs from approved contract`);
    if (actual.retained !== expected.retained) errors.push(`${expected.briefId}: retained disposition differs from approved contract`);
    if (actual.title !== expected.title) errors.push(`${expected.briefId}: title differs from approved baseline`);
    if (actual.category !== expected.category) errors.push(`${expected.briefId}: category differs from approved manifest`);
    if (actual.style !== expected.style) errors.push(`${expected.briefId}: style differs from approved contract`);
    if (actual.hash !== expected.sha256) errors.push(`${expected.briefId}: migration hash differs from approved baseline`);
    if (sha256(actual.content) !== expected.sha256) errors.push(`${expected.briefId}: migration prose differs from approved baseline`);
    if (sha256(actual.content) !== actual.hash) errors.push(`${expected.briefId}: migration prose does not match its embedded hash`);
  }

  for (const seed of seeds) {
    if (!approved.some((row) => row.briefId === seed.briefId)) errors.push(`${seed.briefId}: not present in approved contract`);
  }
  return errors;
}

function unquote(value) {
  return value.replaceAll("''", "'");
}

function readXlsxSheetRows(workbookPath, entryPath) {
  const xml = execFileSync("unzip", ["-p", workbookPath, entryPath], { encoding: "utf8" });
  return Array.from(xml.matchAll(/<x:row\b[^>]*>([\s\S]*?)<\/x:row>/g), (rowMatch) => {
    const row = {};
    for (const cellMatch of rowMatch[1].matchAll(/<x:c\b[^>]*r="([A-Z]+)\d+"[^>]*>([\s\S]*?)<\/x:c>/g)) {
      const value = cellMatch[2].match(/<x:v>([\s\S]*?)<\/x:v>/)?.[1] ?? "";
      row[cellMatch[1]] = decodeXml(value);
    }
    return row;
  });
}

function decodeXml(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function uuidV5(name) {
  const namespace = Buffer.from("6ba7b8109dad11d180b400c04fd430c8", "hex");
  const bytes = createHash("sha1").update(Buffer.concat([namespace, Buffer.from(name)])).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
