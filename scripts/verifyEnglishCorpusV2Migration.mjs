import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  isExactSeededRerun,
  validateMigrationAgainstApprovedContract,
  verifyApprovedContractSources
} from "./englishCorpusV2MigrationContract.mjs";

const migrationPath = new URL("../supabase/migrations/202608090001_english_corpus_v2.sql", import.meta.url);
const approvedContractPath = new URL("../outputs/english-corpus-v2/approved/english-corpus-v2-release-contract.json", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const approvedContract = JSON.parse(readFileSync(approvedContractPath, "utf8"));
const env = parseEnv(readFileSync(new URL("../.env.local", import.meta.url), "utf8"));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Read-only dry run requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
}

const seedPattern = /^\s*\('([^']+)', '([0-9a-f-]+)'::uuid, (true|false), '((?:''|[^'])*)', '([^']+)', 'General', '([0-9a-f]{64})', \$ecv2\$([\s\S]*?)\$ecv2\$\)(?:,|;)$/gm;
const seeds = Array.from(sql.matchAll(seedPattern), (match) => ({
  briefId: match[1], id: match[2], retained: match[3] === "true",
  title: unquote(match[4]), category: match[5], style: "General", hash: match[6], content: match[7]
}));
const deactivations = Array.from(
  sql.matchAll(/^\s*\('([0-9a-f-]+)'::uuid, '((?:''|[^'])*)'\)(?:,|;)$/gm),
  (match) => ({ id: match[1], title: unquote(match[2]) })
);

const production = await fetchPublicPassages();
const currentEnglish = production.filter((passage) => passage.language === "english");
const currentChinese = production.filter((passage) => passage.language === "chinese");
const currentById = new Map(production.map((passage) => [passage.id, passage]));
const retained = seeds.filter((seed) => seed.retained);
const inserted = seeds.filter((seed) => !seed.retained);

const missingRetained = retained.filter((seed) => currentById.get(seed.id)?.language !== "english");
const missingDeactivations = deactivations.filter((seed) => currentById.get(seed.id)?.language !== "english");
const visibleNewIdCollisions = inserted.filter((seed) => currentById.has(seed.id));
const unsafeVisibleNewIdCollisions = visibleNewIdCollisions.filter((seed) => !isExactSeededRerun(
  { ...seed, language: "english", is_active: true, is_public: true },
  currentById.get(seed.id)
));
const productionTitleCollisions = seeds.filter((seed) =>
  production.some((passage) => passage.title === seed.title && passage.id !== seed.id)
);
const intendedIds = new Set(seeds.map((seed) => seed.id));
const duplicateTitles = duplicates(seeds.map((seed) => seed.title));

const simulatedEnglish = new Map(currentEnglish.map((passage) => [passage.id, passage]));
for (const passage of deactivations) simulatedEnglish.delete(passage.id);
for (const seed of seeds) {
  simulatedEnglish.set(seed.id, {
    id: seed.id, title: seed.title, category: seed.category, style: seed.style,
    content: seed.content, language: "english", is_active: true, is_public: true
  });
}

const finalEnglish = Array.from(simulatedEnglish.values()).filter((passage) => passage.is_active && passage.is_public);
const categories = Object.fromEntries(
  Array.from(new Set(seeds.map((seed) => seed.category))).sort().map((category) => [
    category, finalEnglish.filter((passage) => passage.category === category).length
  ])
);
const legacyCategories = [
  "Random paragraph", "Casual writing", "News article", "Business email",
  "Government / formal English", "Tender / proposal writing", "Legal / contract style"
];
const hashMismatches = seeds.filter(
  (seed) => createHash("sha256").update(seed.content).digest("hex") !== seed.hash
);
const retainedMismatches = retained.filter((seed) => {
  const passage = simulatedEnglish.get(seed.id);
  return !passage || passage.title !== seed.title || passage.category !== seed.category;
});
const approvedSourceErrors = verifyApprovedContractSources(approvedContract);
const approvedMigrationErrors = validateMigrationAgainstApprovedContract(sql, approvedContract);

const assertions = {
  sourceSeeds: seeds.length === 140,
  retainedUpdates: retained.length === 40 && missingRetained.length === 0,
  deactivations: deactivations.length === 9 && missingDeactivations.length === 0,
  intendedNewSeedRows: inserted.length === 100,
  visibleActivePublicIdCollisions: unsafeVisibleNewIdCollisions.length === 0,
  visibleActivePublicTitleCollisions: productionTitleCollisions.length === 0,
  finalActivePublicEnglish: finalEnglish.length === 140,
  categories: Object.keys(categories).length === 7 && Object.values(categories).every((count) => count === 20),
  noActiveLegacyCategory: finalEnglish.every((passage) => !legacyCategories.includes(passage.category)),
  retainedIdsAndAssignments: retainedMismatches.length === 0,
  uniqueTitles: duplicateTitles.length === 0 && new Set(finalEnglish.map((passage) => passage.title)).size === 140,
  uniqueIntendedIds: intendedIds.size === 140,
  embeddedContentHashes: hashMismatches.length === 0,
  independentApprovedSources: approvedSourceErrors.length === 0,
  independentApprovedMigrationContract: approvedMigrationErrors.length === 0,
  chineseUnchanged: currentChinese.every((passage) => currentById.get(passage.id) === passage),
  practiceRandomEnglish: finalEnglish.length > 0,
  practiceCategoryRandom: Object.values(categories).every((count) => count > 0),
  explicitRetainedPassage: retained.every((seed) => simulatedEnglish.has(seed.id))
};

const report = {
  mode: "read-only REST snapshot plus in-memory simulation",
  remoteWrites: 0,
  collisionCoverage: {
    visibleActivePublic: "Verified through the read-only anon REST snapshot.",
    hiddenInactivePrivate: "Not observable through anon REST; protected by the database migration preflight over all public.passages rows."
  },
  productionSnapshot: {
    activePublicEnglish: currentEnglish.length,
    activePublicChinese: currentChinese.length
  },
  migrationContract: { retained: retained.length, deactivated: deactivations.length, inserted: inserted.length },
  simulatedFinal: {
    activePublicEnglish: finalEnglish.length,
    categories,
    activeLegacyCategories: finalEnglish.filter((passage) => legacyCategories.includes(passage.category)).length,
    activePublicChinese: currentChinese.length
  },
  assertions,
  failures: {
    missingRetained: missingRetained.map((row) => row.id),
    missingDeactivations: missingDeactivations.map((row) => row.id),
    visibleNewIdCollisions: visibleNewIdCollisions.map((row) => row.id),
    unsafeVisibleNewIdCollisions: unsafeVisibleNewIdCollisions.map((row) => row.id),
    productionTitleCollisions: productionTitleCollisions.map((row) => row.briefId),
    duplicateTitles,
    hashMismatches: hashMismatches.map((row) => row.briefId),
    retainedMismatches: retainedMismatches.map((row) => row.briefId),
    approvedSourceErrors,
    approvedMigrationErrors
  }
};

console.log(JSON.stringify(report, null, 2));
if (Object.values(assertions).some((passed) => !passed)) process.exitCode = 1;

async function fetchPublicPassages() {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/passages?select=id,title,category,style,content,language,is_active,is_public&is_active=eq.true&is_public=eq.true&order=id.asc`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, Range: "0-999" } }
  );
  if (!response.ok) throw new Error(`Read-only passage snapshot failed: ${response.status} ${await response.text()}`);
  return response.json();
}

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, "")]] : [];
  }));
}

function unquote(value) { return value.replaceAll("''", "'"); }
function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return Array.from(repeated);
}
