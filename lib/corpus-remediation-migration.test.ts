import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const corpusPath = "outputs/corpus-remediation/replacement-corpus-v1.json";
const migrationPath = "supabase/migrations/202608220002_replace_c_rated_passages.sql";
const sourceMigrationPath = "supabase/migrations/202608090001_english_corpus_v2.sql";
const typingEnginePath = "lib/typing-engine.ts";

type Verification = "no" | "light" | "light technical" | "light music" | "light culinary" | "yes" | "yes medical" | "yes sports science" | "yes local geology" | "yes local geography" | "yes architecture" | "yes local history/architecture" | "yes engineering" | "yes maritime conservation" | "yes ornithology" | "yes archaeology" | "yes astronomy/optics" | "yes mathematics";

type ExpectedPassage = {
  oldId: string;
  oldTitle: string;
  title: string;
  language: "chinese" | "english";
  category: string;
  style: string;
  min: number;
  max: number;
  verification: Verification;
};

type CorpusPassage = ExpectedPassage & {
  newId: string;
  unit: "characters" | "words";
  sourceType: "synthetic";
  fictional: boolean;
  riskClassification: "A";
  reviewStatus: "approved";
  reviewedAt: string;
  reviewNotes: string;
  sources: Array<{ url: string; note: string }>;
  content: string;
  sha256: string;
};

const expectedPassages = parseExpectedPassages(`
435c0368-4299-468d-8968-0b0d41efad09|人工智能需要可問責|霧氣落在窗上的早晨|chinese|生活|Descriptive|505|520|light
05246dd3-d8f6-46f5-b909-295b47504eac|保育與旅遊的界線|一鍋高湯如何慢慢變清|chinese|生活|Everyday explanatory|515|535|light
15fdf612-d778-45f7-9777-8ebd613f50bd|個人行動與制度改變|失而復得的舊相簿|chinese|生活|Narrative|500|515|no
b10cc209-99f4-45a3-9e29-e1877724a109|儲備應如何使用|陽台上的四季香草|chinese|生活|Descriptive|500|520|light
68602d48-cc07-4428-8156-566a99ff70d1|公共交通的可靠性|雨天收傘的小技巧|chinese|生活|Everyday-life|505|525|no
6929a54a-879d-4a67-9b0c-5fd00ee57492|公共服務的申請門檻|一張購物清單的路線|chinese|生活|Everyday-life|500|510|no
59a66a44-9da5-4e01-b7c3-2ff0c9c1958c|公共財政要看長遠|倉庫盤點的一天|chinese|工作|Workplace narrative|505|525|no
1f9a94ae-89ca-45ab-9cd6-2b88e2b9229b|公屋社區的長遠管理|一件木器的品質檢查|chinese|工作|Science/technical|565|585|yes
6d6843fe-6bfa-4ee5-a239-25107ab3a9ef|再培訓要連接真實職位|圖書館閉館後的還書流程|chinese|工作|Workplace narrative|505|525|light
15268c96-1e0e-471b-83de-8602d65b82a2|最低工資與生活成本|冷鏈貨物如何交接|chinese|工作|Science/technical|520|540|yes
65414482-1e71-4062-833b-a7298ff693f0|單車政策需要連接|工場裡的工具影子板|chinese|工作|Explanatory|505|530|light
f0b6da8c-ad90-4428-9a1f-b1deb6b42f4a|土地供應與公共利益|攝影檔案的命名規則|chinese|工作|Explanatory|560|580|no
dcdb1e81-2768-49d8-bcf0-b5c2dbe9bc88|土地資料應該透明|間隔練習為何有用|chinese|教育|Explanatory|505|525|yes
8f2076a5-b029-44b2-8675-228665161959|城市需要保留空白|從錯字建立個人字表|chinese|教育|Everyday-life|510|530|no
f952efde-16af-41b7-9d0b-b495724d4aa0|基層醫療的重要|用摺紙理解幾何|chinese|教育|Explanatory|510|535|yes
d5418e83-5476-47f4-adca-3b235c2a93b1|基建投資的真正成本|聽寫與聲音記憶|chinese|教育|Explanatory|500|518|light
d4b38707-f849-4368-ba33-c58722df3e15|填海不是單一答案|地圖比例尺的練習|chinese|教育|Science/technical|520|540|yes
eb3885a5-fa9f-4db8-8ced-7092153ad201|居家安老的支援網|樂器慢練的一小節|chinese|教育|Narrative|500|512|no
5454d3a1-213c-41d7-b580-55d87767230f|工時與生產力|電腦如何壓縮一張照片|chinese|科技|Science/technical|510|530|yes
b819fde9-4f1d-470c-b2b2-ba2107cba3bc|房屋不只是單位數目|資料庫索引像書後索引|chinese|科技|Science/technical|580|600|yes
772d57a5-8dfb-4373-8d29-4a430234dcc2|教師時間也是教育資源|感應器如何量度溫度|chinese|科技|Science/technical|515|540|yes
aa16c7c7-04bb-40eb-ba86-cadd17e8a7d1|教育不應只追逐分數|網絡封包的短途旅行|chinese|科技|Science/technical|525|550|yes
e83d37bf-38cd-4c64-9d4f-8d3de9726779|數碼學習的真正門檻|字型如何顯示在螢幕上|chinese|科技|Science/technical|525|545|yes
71ba19dd-0c82-4133-99a6-57ebaee1b2b0|數碼服務不能留下任何人|機械臂如何重複定位|chinese|科技|Science/technical|500|518|yes
84c2652d-f058-495f-a152-5a4ce12907ba|棕地發展的先後次序|陶器入窰前的準備|chinese|文化|Cultural/history|525|550|yes
d35e0383-9c94-42f4-b4ca-c021591040c3|極端天氣下的城市韌性|木版年畫的層層套色|chinese|文化|Cultural/history|520|540|yes
992323f7-1fd4-489d-9659-d7553f9e0d37|步行城市的細節|茶樓點心車的記憶|chinese|文化|Cultural narrative|495|510|light
f6c067cd-0fbf-4d46-9530-87fa968f69a1|減廢要從設計開始|古地圖上的海岸線|chinese|文化|Cultural/history|505|525|yes
dcfa0d17-e079-42e2-8abe-cd654a88fc84|無障礙出行是基本需要|博物館如何為器物造支架|chinese|文化|Cultural/technical|515|540|yes
149df133-3975-4039-ba3c-0c0335243eb8|照顧者也需要被照顧|竹篾如何編成一盞燈|chinese|文化|Cultural/history|515|540|yes
a0504f2a-92c2-4576-b13a-996ba93f00b6|物價上升下的家庭選擇|潮池一天兩次的變化|chinese|環境|Descriptive|505|525|yes
eb069953-d22c-4507-bca8-4a93f5489e81|社區設施要配合人口|候鳥如何找到中途站|chinese|環境|Science/technical|520|540|yes
5b9ec5d4-0be7-461f-86ca-833906372911|科技產品的維修權|榕樹氣根的生長|chinese|環境|Science/technical|505|525|yes
f0e1855d-1489-4e37-a18d-51ea79a18f9a|租務市場需要穩定|珊瑚礁裡的夜班生物|chinese|環境|Descriptive|555|575|yes
3d86e024-fc94-4515-8799-bf2f047beaf5|稅制的公平不只看稅率|雲層如何預告午後驟雨|chinese|環境|Science/technical|500|518|yes
50842194-f1ff-42f8-a5b1-ae15207e6432|積極養老需要選擇|森林地面的分解者|chinese|環境|Science/technical|510|535|yes
dd27c608-a41a-4f01-b1a7-7b2c4a47797f|精神健康需要早期支援|內耳如何幫助保持平衡|chinese|健康|Explanatory|510|530|yes medical
6b7b5814-bedb-4225-a0c1-f43e9d8aee97|結果為本的公共開支|肌肉在熱身時發生甚麼|chinese|健康|Explanatory|500|512|yes medical
53c5d974-9cf5-4cbb-8ef5-a07f716a9bcd|職安需要日常制度|呼吸節奏與長跑步幅|chinese|健康|Explanatory|495|510|yes sports science
421de059-fe71-4427-b33d-98080f4da631|職業教育需要新形象|眼睛如何適應黑暗|chinese|健康|Explanatory|505|525|yes medical
9ab36034-97e9-440f-8ffc-7b4b48a9a35e|能源轉型需要公平|味覺與嗅覺如何合作|chinese|健康|Explanatory|500|520|yes medical
0177a027-de1e-47cc-8ea8-4ee6cf8d41f5|自動化與工作轉型|睡眠週期中的不同階段|chinese|健康|Explanatory|505|525|yes medical
ee7927b3-10f4-44c0-8fb2-d7554e356cfa|舊區重建的兩難|香港花崗岩山徑的紋理|chinese|香港|Descriptive|560|585|yes local geology
eafc4d4a-98bb-443f-bdaa-c7389aa699b1|街市與社區生活|維港潮水一天的進退|chinese|香港|Descriptive/scientific|500|515|yes local geography
7dc8bfdd-a81b-47dc-87e8-31c0bf6a3d95|認知障礙友善社區|電車駛過彎路時的聲音|chinese|香港|Descriptive|520|545|light technical
bb9a6b36-0b39-4dca-bf0a-7f6d11809f64|輪候時間背後的流程|唐樓樓梯間的光影|chinese|香港|Cultural/descriptive|505|525|yes architecture
387db5d7-2377-46aa-bbf6-53b2c8ba9e4f|退休保障的跨代平衡|大澳棚屋的木構細節|chinese|香港|Cultural/history|500|515|yes local history/architecture
000859cf-6702-4d88-b909-530f0cebd4c6|道路收費與選擇|山城斜路上的城市視角|chinese|香港|Descriptive|525|550|yes local geography
379fd277-c697-4ba3-a219-eaa7f75e80e2|醫療數據與私隱|合唱團如何找到同一個呼吸|chinese|社會|Explanatory|500|520|light music
a639f6ef-4b3a-4b90-9dda-bceb2ad9a995|閱讀能力如何建立|社區廚房的一次晚餐準備|chinese|社會|Narrative|500|520|no
1f1611df-787f-4359-8cab-d7b0e5b2469b|院舍質素如何衡量|博物館義工的開館早晨|chinese|社會|Narrative|520|545|no
6b528975-1f6f-46e4-9ef7-9aaa623f18c4|零工經濟的保障缺口|棋會裡的一盤慢棋|chinese|社會|Narrative|500|522|no
938e88b7-ffd7-4233-870b-2d8340621f62|青年置業與流動選擇|失物招領桌上的紅雨傘|chinese|社會|Narrative|550|575|no
7e1946cb-0769-4253-b7f3-36dc3bbfbfdb|預防醫學的投資回報|小型樂團排練前的十分鐘|chinese|社會|Narrative|500|515|no
9bce4cff-5c6e-4780-a9ae-78a11e57af71|A Constructive Response to Public Consultation|Coordinating the Return of a Travelling Exhibition|english|Business communication|Professional email/memo|355|375|no
d7591888-42b6-4f9b-89cc-ed5c8ab7d3d2|Housing Affordability and Secure Renting|How a Suspension Bridge Shares Its Load|english|Articles|Technical explanatory|345|365|yes engineering
cb49ecbe-b752-481f-8a53-b4742085bd99|Keeping Digital Records Useful|A Practical Naming System for Field Photographs|english|Business communication|Concise procedural|200|220|no
d800ba7c-e99a-420b-b141-becb16ed2c76|Keeping Long-Term Commitments Affordable|Caring for a Wooden Sailing Vessel Through the Seasons|english|Articles|Technical narrative|370|390|yes maritime conservation
bc9cc109-e666-4b1b-ad25-60a134a6a3ab|Preparing Public Services for an Ageing Population|How Migratory Birds Navigate Across Seasons|english|Articles|Science narrative|355|375|yes ornithology
fd2dd1c5-a220-4e9b-955a-7e7d1588ec56|Responsible Land Use for a Dense City|Reading the Layers of an Archaeological Trench|english|Articles|Historical explanatory|340|360|yes archaeology
64f6857d-fa40-4c71-87be-b133810dd9c9|Strengthening Primary Healthcare Capacity|How a Telescope Turns Faint Light into an Image|english|Articles|Science/technical|355|375|yes astronomy/optics
f895f26e-2be2-5816-aa91-ca3e20dda07b|The Journeys Hidden in a Mixed Street|The Geometry Hidden in a Folded Map|english|Articles|Compact explanatory|225|245|yes mathematics
dc9063ba-e555-56b4-b6e6-c67d38481859|The Promise Inside a Service Standard|What a Recipe Measures—and What It Leaves to Judgement|english|Articles|Reflective explanatory|225|245|light culinary
`);

const bRatedIds = `
a444442e-3eca-508e-94e9-fd0c108fa6d3
8fb8f511-cc01-5a23-830c-653fd93ca848
04d4ea10-75c4-5c2c-9bea-3b2447b90fc8
54915d56-da5d-5013-a7d5-88b5646405ba
716cb320-8056-51b0-b22f-ddd2e49df226
a14c4991-6e14-510b-b81b-203c57490b39
a892ac88-6631-5fb9-bbf6-43003572a2ce
b6799906-7710-5b98-ad40-b75049d013cb
91bc7bc1-7a43-5731-a453-12487414bd44
3dcb3cfa-2e67-5b59-b7d7-635f78002b3a
3dd4d7ef-252e-4502-a683-e3c26cd6959d
7f239e87-924f-5a8d-8265-c3bd64f8920c
7eb700d0-3a00-56c0-b5de-27cf22e82101
56ab756e-b97e-44aa-8658-2c893aed52f9
20030528-60b9-475b-905d-d29ad44f3b98
900b19ba-1ed0-5b18-8887-e4f382bf162e
283bca77-6486-4a0a-92a2-9209a9c48492
0469c41f-db8d-5a9c-8d3c-a54c2adf6b6e
a66bcad1-3b90-4ca0-8c8b-861987e1e11f
0162ba87-0977-5fe2-8bf7-d9dbe7f45787
cb97e3f3-7060-5a5c-a5d3-261866b9a1b9
74f1dcf1-96c8-559a-b59c-69f896326eb1
51a96dec-ed47-5ec0-b7e0-333c43da3331
`.trim().split("\n");

const approvedSourceHosts = `
asq.org
b.asp.si.edu
blogs.loc.gov
blueprintkentucky.mgcafe.uky.edu
dfzb.suzhou.gov.cn
exhibits.si.edu
floridakeys.noaa.gov
freetype.org
historicengland.org.uk
hkss.cedd.gov.hk
home.nps.gov
hos.ifas.ufl.edu
nationalzoo.si.edu
nrich.maths.org
oceanservice.noaa.gov
ocw.mit.edu
opentextbooks.library.arizona.edu
pmc.ncbi.nlm.nih.gov
pubmed.ncbi.nlm.nih.gov
repository.hku.hk
science.nasa.gov
tcdbdata.ntcri.gov.tw
weather.metoffice.gov.uk
www.afcd.gov.hk
www.amo.gov.hk
www.britishmuseum.org
www.cambridge.org
www.canada.ca
www.cedd.gov.hk
www.coris.noaa.gov
www.fda.gov
www.fhwa.dot.gov
www.hkmapservice.gov.hk
www.hko.gov.hk
www.hktramways.com
www.ice.edu
www.icho.hk
www.info.gov.hk
www.islands.gov.hk
www.lcsd.gov.hk
www.loc.gov
www.nauticalcharts.noaa.gov
www.ndsu.edu
www.nei.nih.gov
www.nhlbi.nih.gov
www.nidcd.nih.gov
www.nist.gov
www.nps.gov
www.ntcri.gov.tw
www.ordnancesurvey.co.uk
www.pland.gov.hk
www.postgresql.org
www.rfc-editor.org
www.rhs.org.uk
www.vam.ac.uk
`.trim().split("\n");

function parseExpectedPassages(value: string): ExpectedPassage[] {
  return value.trim().split("\n").map((line) => {
    const [oldId, oldTitle, title, language, category, style, min, max, verification] = line.split("|");
    return {
      oldId,
      oldTitle,
      title,
      language: language as ExpectedPassage["language"],
      category,
      style,
      min: Number(min),
      max: Number(max),
      verification: verification as Verification
    };
  });
}

function readCorpus(): { schemaVersion?: number; uuidNamespace?: string; passages: CorpusPassage[] } {
  if (!existsSync(corpusPath)) return { passages: [] };
  return JSON.parse(readFileSync(corpusPath, "utf8"));
}

function readMigration(): string {
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function uuidV5(namespace: string, name: string): string {
  const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const digest = createHash("sha1").update(namespaceBytes).update(name).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const value = digest.subarray(0, 16).toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function extractEnglishV2Rows(sql: string) {
  const pattern = /^\s*\('([^']+)', '([0-9a-f-]+)'::uuid, (?:true|false), '((?:''|[^'])*)', '((?:''|[^'])*)', '((?:''|[^'])*)', '([0-9a-f]{64})', \$ecv2\$([\s\S]*?)\$ecv2\$\)(?:,|;)?$/gm;
  return new Map(Array.from(sql.matchAll(pattern), (match) => [
    match[2],
    {
      title: match[3].replaceAll("''", "'"),
      category: match[4].replaceAll("''", "'"),
      style: match[5].replaceAll("''", "'"),
      sha256: match[6],
      content: match[7]
    }
  ]));
}

function extractBGuardHex(sql: string): Map<string, string> {
  const section = sql.match(/-- BEGIN B-RATED BYTE GUARD([\s\S]*?)-- END B-RATED BYTE GUARD/)?.[1] ?? "";
  return new Map(Array.from(
    section.matchAll(/\('([0-9a-f-]+)'::uuid, decode\('([0-9a-f]+)', 'hex'\)\)(?:,|;)?/g),
    (match) => [match[1], match[2]]
  ));
}

describe("C-rated replacement corpus contract", () => {
  const corpus = readCorpus();
  const passages = corpus.passages;

  it("checks in the auditable corpus and guarded migration", () => {
    expect(existsSync(corpusPath), `${corpusPath} is missing`).toBe(true);
    expect(existsSync(migrationPath), `${migrationPath} is missing`).toBe(true);
  });

  it("matches all 63 approved mappings, categories, styles, ranges, and verification flags", () => {
    expect(passages).toHaveLength(63);
    expect(passages.map(({ oldId, oldTitle, title, language, category, style, min, max, verification }) => ({
      oldId, oldTitle, title, language, category, style, min, max, verification
    }))).toEqual(expectedPassages);
    expect(passages.filter((passage) => passage.language === "chinese")).toHaveLength(54);
    expect(passages.filter((passage) => passage.language === "english")).toHaveLength(9);
    expect(passages.some((passage) => bRatedIds.includes(passage.oldId))).toBe(false);
  });

  it("uses unique deterministic UUIDv5 identities and unique replacement titles", () => {
    expect(corpus.schemaVersion).toBe(1);
    expect(corpus.uuidNamespace).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(passages.map((passage) => passage.oldId)).size).toBe(63);
    expect(new Set(passages.map((passage) => passage.newId)).size).toBe(63);
    expect(new Set(passages.map((passage) => passage.title)).size).toBe(63);
    expect(new Set(passages.map((passage) => passage.sha256)).size).toBe(63);
    for (const passage of passages) {
      expect(passage.newId).toBe(uuidV5(corpus.uuidNamespace!, `typing-station:corpus-remediation-v1:${passage.oldId}`));
      expect(passage.newId).not.toBe(passage.oldId);
    }
  });

  it("meets every approved character or word target", () => {
    for (const passage of passages) {
      const count = passage.unit === "characters" ? Array.from(passage.content).length : countWords(passage.content);
      expect(count, `${passage.title} count`).toBeGreaterThanOrEqual(passage.min);
      expect(count, `${passage.title} count`).toBeLessThanOrEqual(passage.max);
      expect(passage.unit).toBe(passage.language === "chinese" ? "characters" : "words");
      expect(passage.content).toBe(passage.content.trim());
    }
  });

  it("stores approved A metadata and internal source notes without citations in public prose", () => {
    for (const passage of passages) {
      expect(passage.sourceType).toBe("synthetic");
      expect(typeof passage.fictional).toBe("boolean");
      expect(passage.riskClassification).toBe("A");
      expect(passage.reviewStatus).toBe("approved");
      expect(Number.isFinite(Date.parse(passage.reviewedAt))).toBe(true);
      expect(passage.reviewNotes.trim().length).toBeGreaterThan(0);
      expect(passage.content).not.toMatch(/https?:\/\//);
      expect(passage.sha256).toBe(createHash("sha256").update(passage.content).digest("hex"));
      if (passage.verification !== "no") {
        expect(passage.sources.length, `${passage.title} sources`).toBeGreaterThan(0);
        for (const source of passage.sources) {
          expect(source.url).toMatch(/^https:\/\//);
          expect(source.note.trim().length).toBeGreaterThan(0);
          expect(passage.reviewNotes).toContain(source.url);
        }
      }
    }
  });

  it("pins the reviewed authoritative source set and strengthened primary-source coverage", () => {
    const sourceRecords = passages.flatMap((passage) => passage.sources);
    const sourceHosts = Array.from(new Set(sourceRecords.map((source) => new URL(source.url).hostname))).sort();
    expect(sourceRecords).toHaveLength(68);
    expect(sourceHosts).toEqual([...approvedSourceHosts].sort());

    const sourcesByTitle = new Map(passages.map((passage) => [
      passage.title,
      new Set(passage.sources.map((source) => source.url))
    ]));
    expect(sourcesByTitle.get("榕樹氣根的生長")).toContain("https://repository.hku.hk/handle/10722/215014");
    expect(sourcesByTitle.get("肌肉在熱身時發生甚麼")).toContain("https://pubmed.ncbi.nlm.nih.gov/41336260/");
    expect(sourcesByTitle.get("茶樓點心車的記憶")).toContain("https://www.lcsd.gov.hk/clpss/tc/webApp/NewsDetails.do?id=18460");
    expect(sourcesByTitle.get("一件木器的品質檢查")).toContain("https://www.canada.ca/en/conservation-institute/services/care-objects/furniture-wooden-objects-basketry/basic-care-furniture-objects-wood.html");
    expect(sourcesByTitle.get("木版年畫的層層套色")).toContain("https://dfzb.suzhou.gov.cn/dfzb/szdq/202307/5f8473123cc3488e8275cc7233514186.shtml");
    expect(sourcesByTitle.get("竹篾如何編成一盞燈")).toContain("https://tcdbdata.ntcri.gov.tw/upload/file/2024-05-13/d4a2b33a-b98d-490d-9537-287d9079d0de/CraftingTaiwan100YearsAndMore_ExhibitionGuidebook.pdf");
  });

  it("keeps Chinese prose Traditional and scans all public prose for prohibited framing", () => {
    const simplifiedOnly = /[这发为与从个们会体传现应对开关进过边层气术图书业东车马门间见长风万鸟听医网点实复节总适质温后并于么云众优侧储写军农决冻净凉减则创别动劳势区协单卫历压参双变叶号听园围国圆场块尘备头夹奖妇学实宽导将录忆态旧时显机权条来构标树样检楼汇汉汤沟浅测润渐湾湿滚满灯爱牵状环画盘稳笔签简类紧红约级线练组经结统维绿网职联脑脚脸艺获营虽装见观规觉触认记说请调谢轨转轮轻达运还选邻铁锅镜闭难雾静顺预领题颜飞饭馆骤鱼鸟黄齐龙葱]/;
    const chineseProhibited = /(政府|政策|選舉|議會|立法|公共服務|公營|諮詢|倡議|示威|地緣政治|問責|監管)/;
    const englishProhibited = /\b(government|council|consultation|election|legislation|public[- ]policy|public affairs?|advocacy|protest)\b/i;
    for (const passage of passages) {
      expect(passage.content, `${passage.title} uses quotation marks`).not.toMatch(/[「」『』“”"]/);
      if (passage.language === "chinese") {
        const hanCharacters = passage.content.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
        expect(hanCharacters / Array.from(passage.content).length, `${passage.title} Chinese-script ratio`).toBeGreaterThan(0.7);
        expect(passage.content, `${passage.title} contains a simplified-only character`).not.toMatch(simplifiedOnly);
        expect(passage.content, `${passage.title} contains prohibited framing`).not.toMatch(chineseProhibited);
      } else {
        expect(passage.content, `${passage.title} contains prohibited framing`).not.toMatch(englishProhibited);
      }
    }
  });

  it("keeps health passages descriptive and uses varied typing-practice punctuation", () => {
    const healthAdvice = /(你應|你可以|讀者應|建議讀者|務必|最好先|如有.{0,12}請|應立即)/;
    for (const passage of passages) {
      const sentenceCount = passage.content.split(/[。！？.!?]+/).filter((part) => part.trim().length > 0).length;
      expect(sentenceCount, `${passage.title} sentence count`).toBeGreaterThanOrEqual(5);
      expect(passage.content, `${passage.title} punctuation complexity`).toMatch(/[,，:：;；—]/);
      if (passage.category === "健康") {
        expect(passage.content, `${passage.title} contains medical advice`).not.toMatch(healthAdvice);
        expect(passage.content, `${passage.title} addresses the reader`).not.toContain("你");
      }
    }
  });

  it("keeps reviewed claims within the scope of their authoritative sources", () => {
    const byTitle = new Map(passages.map((passage) => [passage.title, passage]));
    expect(byTitle.get("一件木器的品質檢查")!.content).not.toMatch(/允收範圍|抽屜縫隙|螺絲頭|膠線/);
    expect(byTitle.get("木版年畫的層層套色")!.content).not.toMatch(/漸變效果|局部調整水分/);
    expect(byTitle.get("茶樓點心車的記憶")!.content).not.toContain("後來不少茶樓改用點心紙落單");
    expect(byTitle.get("肌肉在熱身時發生甚麼")!.content).not.toMatch(/肌腱|蛋白質|運動單位|神經協調/);
    expect(byTitle.get("圖書館閉館後的還書流程")!.sources[0].note).toContain("一般流程");
    expect(byTitle.get("竹篾如何編成一盞燈")!.content).not.toMatch(/承受燈泡重量|重心落在中央/);
  });

  it("keeps reviewed wording clear and the field-photo ingest sequence safe", () => {
    const byTitle = new Map(passages.map((passage) => [passage.title, passage.content]));
    const allContent = passages.map((passage) => passage.content).join("\n");
    for (const wording of [
      "洋葱",
      "摺線上的每一點到該點與映射點距離相同",
      "隨着年輪增加",
      "牠們的活動受到",
      "合上節拍器",
      "beside the original outward loan file securely"
    ]) {
      expect(allContent).not.toContain(wording);
    }

    const fieldPhotos = byTitle.get("A Practical Naming System for Field Photographs")!;
    expect(fieldPhotos).toContain("before renaming any file");
    expect(fieldPhotos).toContain("Verify the transfer");
    expect(fieldPhotos).toContain("Rename only the working copies");
    expect(fieldPhotos.indexOf("Verify the transfer")).toBeLessThan(fieldPhotos.indexOf("Rename only the working copies"));
    expect(fieldPhotos).not.toContain("Name each field photograph before copying it from the memory card");

    expect(byTitle.get("珊瑚礁裡的夜班生物")).toMatch(
      /觸鬚、氣味與水流成為礁區活動的重要線索，另一套夜間生活隨即展開。$/
    );
  });

  it("keeps collection-level Chinese structure varied without banning ordinary transitions", () => {
    const chinese = passages.filter((passage) => passage.language === "chinese");
    const paragraphCounts = chinese.map((passage) => passage.content.split(/\n\s*\n/).length);
    const paragraphFrequencies = Array.from(new Set(paragraphCounts)).map((count) => (
      paragraphCounts.filter((value) => value === count).length
    ));
    const synthesisMarker = /(不是|而是|因此|並非)/;
    const markedPassages = chinese.filter((passage) => synthesisMarker.test(passage.content));
    const markerOccurrences = chinese.reduce((total, passage) => (
      total + (passage.content.match(/(不是|而是|因此|並非)/g) ?? []).length
    ), 0);
    const markedEndings = chinese.filter((passage) => {
      const sentences = passage.content.split(/[。！？]/).map((sentence) => sentence.trim()).filter(Boolean);
      return /(不是|而是|因此|並非)/.test(sentences[sentences.length - 1] ?? "");
    });

    expect(new Set(paragraphCounts).size).toBeGreaterThanOrEqual(4);
    expect(Math.max(...paragraphFrequencies)).toBeLessThanOrEqual(20);
    expect(markedPassages.length).toBeLessThanOrEqual(34);
    expect(markerOccurrences).toBeLessThanOrEqual(70);
    expect(markedEndings.length).toBeLessThanOrEqual(16);
  });
});

describe("C-rated replacement migration contract", () => {
  const sql = readMigration();
  const corpus = readCorpus();

  it("uses one guarded transaction and a durable one-to-one mapping table", () => {
    expect(sql.trimStart().toLowerCase().startsWith("begin;")).toBe(true);
    expect(sql.trimEnd().toLowerCase().endsWith("commit;")).toBe(true);
    expect(sql).toContain("create table if not exists public.passage_replacement_map");
    expect(sql).toContain("old_passage_id uuid primary key");
    expect(sql).toContain("new_passage_id uuid not null unique");
    expect(sql).toContain("lock table public.passages in access exclusive mode");
    expect(sql).not.toContain("lock table public.passages in share row exclusive mode");
    expect(sql).toContain("seed_range_mismatch");
    expect(sql).toContain("char_length(seed.content)");
    expect(sql).toContain("regexp_split_to_array(btrim(seed.content), '[[:space:]]+')");
    expect(sql).toContain("Corpus remediation preflight failed");
    expect(sql).toContain("Corpus remediation postflight failed");
    expect(sql).not.toMatch(/delete\s+from\s+public\.passages/i);
  });

  it("inserts approved replacements, deactivates only mapped old rows, and postflights final totals", () => {
    expect(sql).toContain("risk_classification, source_type, fictional, reviewed_at, review_notes, review_status");
    expect(sql).toContain("'A', seed.source_type, seed.fictional, seed.reviewed_at, seed.review_notes, 'approved'");
    expect(sql).toContain("set is_active = false, is_public = false");
    expect(sql).toContain("where passage.id = seed.old_id");
    expect(sql).toContain("active_public_total <> 218");
    expect(sql).toContain("active_public_english <> 140");
    expect(sql).toContain("active_public_chinese <> 78");
    expect(sql).toContain("old_inactive_private <> 63");
    expect(sql).toContain("new_active_public <> 63");
  });

  it("embeds the exact auditable corpus prose, hashes, and deterministic mapping", () => {
    const embedded = Array.from(
      sql.matchAll(/\$(replacement_\d{3})\$([\s\S]*?)\$\1\$/g),
      (match) => ({ tag: match[1], content: match[2] })
    );
    expect(embedded).toHaveLength(63);
    corpus.passages.forEach((passage, index) => {
      expect(embedded[index]).toEqual({
        tag: `replacement_${String(index + 1).padStart(3, "0")}`,
        content: passage.content
      });
      expect(sql).toContain(`'${passage.oldId}'::uuid, '${passage.newId}'::uuid`);
      expect(sql).toContain(`'${passage.sha256}'`);
    });
  });

  it("grandfathers exactly the 23 approved B rows while restoring the review gate", () => {
    for (const id of bRatedIds) expect(sql).toContain(id);
    expect(new Set(bRatedIds).size).toBe(23);
    expect(sql).toContain("alter table public.passages disable trigger enforce_passage_review_gate");
    expect(sql).toContain("drop constraint if exists passages_publication_requires_approval");
    expect(sql).toContain("add constraint passages_publication_requires_approval");
    expect(sql).toContain("not valid");
    expect(sql).toContain("alter table public.passages enable trigger enforce_passage_review_gate");
    expect(sql).toContain("set risk_classification = 'B'");
    expect(sql).toContain("B-rated grandfathering failed");
  });

  it("pins the unchanged local B-rated News article fallback beside the 23 remote rows", () => {
    const source = readFileSync(typingEnginePath, "utf8");
    const block = source.match(/"News article": \[([\s\S]*?)\n  \],/)?.[1] ?? "";
    const entries = Array.from(block.matchAll(/"((?:\\.|[^"\\])*)"/g), (match) => JSON.parse(`"${match[1]}"`));
    expect(entries).toEqual([
      "The committee announced new transport measures on Monday, stating that the revised timetable would improve peak-hour capacity and reduce passenger waiting times across major districts.",
      "Officials said the changes followed several months of consultation with operators, passenger groups, and district representatives.",
      "Further adjustments may be introduced after the first review period, during which the department will monitor service reliability, passenger flow, and public feedback."
    ]);
  });

  it("embeds and checks the exact current UTF-8 bytes for every B row", () => {
    const sourceRows = extractEnglishV2Rows(readFileSync(sourceMigrationPath, "utf8"));
    const guardHex = extractBGuardHex(sql);
    expect(Array.from(guardHex.keys()).sort()).toEqual([...bRatedIds].sort());
    for (const id of bRatedIds) {
      const expected = sourceRows.get(id);
      expect(expected, `${id} missing from English corpus v2`).toBeDefined();
      expect(Buffer.from(guardHex.get(id) ?? "", "hex")).toEqual(Buffer.from(expected!.content, "utf8"));
      expect(createHash("sha256").update(expected!.content).digest("hex")).toBe(expected!.sha256);
    }
    expect(sql).toContain("convert_to(passage.content, 'UTF8') is distinct from guard.content_bytes");
  });

  it("guards every pre-existing prose byte and runtime state outside the explicit C cutover", () => {
    expect(sql).toContain("create temp table typing_station_preserved_passage_guard on commit drop as");
    expect(sql).toContain("convert_to(passage.content, 'UTF8') as content_bytes");
    expect(sql).not.toContain("convert_to(content, 'UTF8') as content_bytes");
    expect(sql).toContain("Protected passage drift detected");
    expect(sql).toContain("create temp table typing_station_old_c_content_guard on commit drop as");
    expect(sql).toContain("Old C-rated content drift detected");
    expect(sql).toContain("create temp table typing_station_b_runtime_guard on commit drop as");
    expect(sql).toContain("B-rated runtime state changed");
  });

  it("backfills established A rows only by excluding the exact C and B sets", () => {
    expect(sql).toContain("set risk_classification = 'A'");
    expect(sql).toContain("where passage.is_active and passage.is_public");
    expect(sql).toContain("not exists (select 1 from typing_station_corpus_replacements seed where seed.old_id = passage.id)");
    expect(sql).toContain("not exists (select 1 from typing_station_b_guard guard where guard.id = passage.id)");
  });
});
