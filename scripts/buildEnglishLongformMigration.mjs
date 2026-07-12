import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "supabase/migrations/202607130001_seed_english_longform.sql");
const sourceArticles = readSourceArticles(path.join(root, "Articles.txt")).slice(0, 5).map((article) => ({
  ...article,
  category: "Random paragraph",
  style: "English longform v1"
}));

const briefs = [
  brief("A Clear Project Handover", "Business email", "handing a complex project to a new team", ["a concise statement of current status", "named owners for every open action", "decisions that must not be reopened without evidence", "dependencies and deadlines that affect other teams", "file locations and access permissions", "a short route for questions and escalation"]),
  brief("A Constructive Response to Public Consultation", "Business email", "responding to a public policy consultation", ["a respectful summary of the proposal", "the parts that deserve support", "concerns supported by practical examples", "the people likely to experience unintended effects", "specific amendments instead of general objections", "a clear invitation to continue the discussion"]),
  brief("Escalating a Service Risk Early", "Business email", "warning senior colleagues about a service risk", ["the observable facts and their source", "the difference between possibility and confirmed impact", "what has already been tried", "the decision that is now required", "temporary controls while a decision is pending", "the next update time even if nothing changes"]),
  brief("Requesting a Decision Without Creating Pressure", "Business email", "asking a busy decision-maker for timely approval", ["the exact decision in the opening lines", "a recommendation with a brief reason", "real alternatives and their consequences", "the latest safe decision date", "attachments that support rather than bury the request", "a courteous route for clarification"]),
  brief("Closing a Difficult Customer Complaint", "Business email", "resolving a complaint after a service failure", ["acknowledging the customer experience without defensiveness", "separating verified facts from assumptions", "explaining the correction in plain language", "offering proportionate remedy", "recording prevention work and ownership", "closing only after the customer knows the next step"]),

  brief("Community Health Outreach Proposal", "Tender / proposal writing", "delivering preventive health services in underserved districts", ["evidence of local need", "an accessible service model", "qualified staff and safeguarding", "partnerships with trusted community organisations", "measurable health and participation outcomes", "a sustainable handover after the funded period"]),
  brief("Residential Energy Retrofit Programme", "Tender / proposal writing", "improving energy efficiency in ageing residential buildings", ["a fair method for selecting buildings", "technical surveys before promising savings", "resident communication during disruptive works", "quality assurance and independent testing", "support for low-income owners and tenants", "measurement of energy use after completion"]),
  brief("Integrated Transport Data Platform", "Tender / proposal writing", "building a shared transport information platform", ["common data standards across operators", "accurate real-time service information", "privacy and security by design", "open interfaces for public-interest applications", "resilience when one supplier fails", "governance for corrections and future upgrades"]),
  brief("Circular Logistics and Recycling Service", "Tender / proposal writing", "operating a city-wide collection and recycling network", ["convenient collection for different neighbourhoods", "traceability from collection to final processing", "safe working conditions", "incentives that reward cleaner material streams", "public reporting of contamination and recovery", "capacity for seasonal and emergency surges"]),
  brief("Workforce Reskilling Partnership", "Tender / proposal writing", "helping experienced workers move into growing industries", ["labour-market evidence rather than fashionable course titles", "recognition of existing skills", "training designed with employers", "paid practical experience", "support for carers and low-income learners", "employment and retention outcomes after graduation"]),

  brief("Housing Affordability and Secure Renting", "Government / formal English", "improving housing affordability without relying on a single tenure", ["the distinction between supply and affordability", "secure rental options", "public housing for households in greatest need", "transport and services around new homes", "transparent eligibility and allocation", "long-term monitoring of household outcomes"]),
  brief("Responsible Land Use for a Dense City", "Government / formal English", "balancing housing, employment, nature, and public facilities", ["comparable evidence for competing uses", "full infrastructure costs", "protection of ecologically valuable land", "space for essential but low-margin industries", "early participation by affected communities", "review points when forecasts change"]),
  brief("Preparing Public Services for an Ageing Population", "Government / formal English", "adapting services to population ageing", ["prevention and healthy ageing", "home and community care", "support for unpaid carers", "accessible transport and housing", "a stable care workforce", "financial plans that remain fair across generations"]),
  brief("A Framework for Fiscal Sustainability", "Government / formal English", "maintaining reliable public finances over the long term", ["realistic economic and demographic scenarios", "separation of temporary and recurrent spending", "maintenance liabilities for public assets", "transparent use of reserves", "evaluation of programme outcomes", "regular independent review of assumptions"]),
  brief("Strengthening Primary Healthcare Capacity", "Government / formal English", "moving care closer to patients and communities", ["continuous relationships with primary care teams", "management of chronic disease", "safe sharing of clinical records", "clear referral pathways", "affordable access for high-risk groups", "outcomes based on health rather than visit counts"]),

  brief("Rail Operator Publishes Reliability Recovery Plan", "News article", "reporting a transport operator's response to repeated disruption", ["the scale and timing of recent incidents", "what passengers experienced", "the operator's stated causes", "the regulator's required actions", "independent expert assessment", "the milestones the public can verify next"]),
  brief("Districts Open Heat Shelters Under New Summer Plan", "News article", "reporting a coordinated response to extreme heat", ["the thresholds that trigger action", "locations and opening hours", "support for outdoor workers and isolated residents", "changes to schools and public facilities", "health advice from clinicians", "how results will be reviewed after summer"]),
  brief("Schools Pilot Broader Assessment Model", "News article", "reporting a school assessment pilot beyond examinations", ["why the pilot was introduced", "how student work will be assessed", "teacher workload and training", "views from students and parents", "concerns about fairness and consistency", "the evidence required before expansion"]),
  brief("New Rules Proposed for High-Risk Artificial Intelligence", "News article", "reporting proposed regulation of consequential AI systems", ["which uses count as high risk", "testing and documentation duties", "notice and appeal rights for individuals", "responsibility when vendors are involved", "penalties and enforcement capacity", "responses from industry and civil society"]),
  brief("Platform Workers Seek Portable Benefits", "News article", "reporting debate over protections for platform workers", ["how platform work is organised", "income and expense volatility", "accident and sickness protection", "the proposed portable account", "concerns raised by platforms and workers", "the timetable for legislative review"]),

  brief("Learning to Read Without Rushing", "Casual writing", "building a patient daily reading habit", ["choosing material that creates genuine curiosity", "protecting a small regular time", "reading difficult paragraphs twice", "writing questions instead of perfect summaries", "alternating depth with lighter reading", "noticing progress over months rather than days"]),
  brief("What a Neighbourhood Walk Can Teach You", "Casual writing", "paying closer attention during an ordinary walk", ["the rhythm of shops opening and closing", "small barriers faced by different pedestrians", "how shade and seating change a street", "the stories carried by older buildings", "brief exchanges that create familiarity", "returning at another hour to see a different place"]),
  brief("Sharing Care for an Older Parent", "Casual writing", "organising family care without exhausting one person", ["starting with an honest conversation", "listing visible and invisible tasks", "matching responsibilities to real availability", "using professional help before a crisis", "allowing the main carer genuine rest", "reviewing the arrangement as needs change"]),
  brief("Working From Home Without Living at Work", "Casual writing", "creating healthy boundaries while working from home", ["a simple signal that the workday has begun", "priorities that fit available attention", "breaks away from the screen", "clear expectations with colleagues", "a shutdown routine at the end of the day", "kindness when home life interrupts the plan"]),
  brief("Finding a Better Digital Balance", "Casual writing", "using digital tools without surrendering attention", ["turning off notifications that have no urgent purpose", "keeping the phone away from selected activities", "choosing information deliberately", "recognising design that encourages endless scrolling", "replacing a habit rather than leaving an empty space", "reviewing whether technology still serves the original goal"]),

  brief("Data Processing and Confidentiality Schedule", "Legal / contract style", "setting contractual controls for personal data", ["defined processing purposes", "instructions and limits on further use", "access controls and staff confidentiality", "security incident notification", "subprocessor approval and responsibility", "return or deletion when services end"]),
  brief("Service Continuity and Recovery Clause", "Legal / contract style", "maintaining essential services through disruption", ["services and recovery priorities", "tested continuity plans", "notification of material incidents", "alternative arrangements during recovery", "records and cooperation with investigation", "review after each exercise or real event"]),
  brief("Workplace Safety Responsibilities", "Legal / contract style", "allocating safety duties in contracted work", ["risk assessment before work begins", "competent supervision and training", "authority to stop unsafe work", "equipment inspection and maintenance", "reporting of incidents and near misses", "remedial action without shifting statutory duties"]),
  brief("Residential Repair and Maintenance Terms", "Legal / contract style", "clarifying repair responsibilities in a tenancy", ["urgent hazards and response times", "routine maintenance by each party", "access with reasonable notice", "records of condition and completed work", "temporary arrangements during major repair", "a proportionate dispute resolution route"]),
  brief("Responsible Artificial Intelligence Procurement Terms", "Legal / contract style", "contracting for a high-impact AI service", ["approved use and prohibited decisions", "training data and performance documentation", "testing for material bias", "human review and appeal mechanisms", "audit access and change notification", "suspension, correction, and exit assistance"])
];

const generatedArticles = briefs.map(buildArticle);
const allArticles = [...generatedArticles, ...sourceArticles];
validateArticles(allArticles);
fs.writeFileSync(outputPath, renderMigration(allArticles));
const counts = allArticles.map((article) => wordCount(article.content));
console.log(`Generated ${allArticles.length} passages (${Math.min(...counts)}-${Math.max(...counts)} words) at ${outputPath}`);

function brief(title, category, subject, pillars) {
  return { title, category, subject, pillars, style: "English longform v1" };
}

function buildArticle(item) {
  const openings = {
    "Business email": `This message sets out a practical approach to ${item.subject}. It is intended to make the requested action, supporting reasons, and next steps easy to identify. A useful business message should be concise without becoming incomplete, and courteous without hiding the decision that is needed.`,
    "Tender / proposal writing": `This proposal presents a deliverable model for ${item.subject}. The approach combines evidence, implementation discipline, measurable outcomes, and transparent governance. It is designed to show not only what will be delivered, but how quality will be maintained when conditions change.`,
    "Government / formal English": `This paper considers options for ${item.subject}. The issue requires coordinated action because its costs and benefits extend across departments, communities, and future budget periods. The recommended framework emphasises fairness, evidence, operational feasibility, and regular public review.`,
    "News article": `Authorities and community representatives have begun a new phase of work on ${item.subject}. The development follows growing public attention and a series of operational concerns. This report explains what has changed, what remains uncertain, and which results will allow the public to judge progress.`,
    "Casual writing": `I have been thinking about ${item.subject}. It sounds like the kind of goal that should be easy once a good intention is in place, but ordinary routines are rarely that simple. The more useful approach is to notice the small choices that make the habit easier or harder.`,
    "Legal / contract style": `The following terms establish the parties' respective obligations in relation to ${item.subject}. They are intended to create a clear operational standard, preserve accountability, and provide proportionate remedies where performance falls below the agreed requirement.`
  };
  const paragraphPatterns = [
    (pillar) => `First, the approach must give proper attention to ${pillar}. This is not a decorative feature or a matter to be postponed until implementation. It affects whether the arrangement can work under ordinary pressure, whether people understand what is expected, and whether problems can be identified before they become expensive. The responsible team should document the relevant assumptions, test them with the people who will use the service, and name an owner for follow-up. Evidence should be recorded in a form that another person can review without relying on private conversations or institutional memory.`,
    (pillar) => `A second consideration is ${pillar}. Plans often appear convincing at a high level but fail when this issue is treated as someone else's responsibility. A stronger model identifies the practical steps, resources, and decision rights in advance. It also distinguishes a genuine constraint from a convenient excuse. Where the preferred option cannot be delivered immediately, the team should use a time-limited interim measure, explain the remaining risk, and set a date for reassessment. This keeps temporary arrangements from quietly becoming permanent weaknesses.`,
    (pillar) => `The work must also address ${pillar}. Different groups may experience the same policy or service in very different ways, so an average result can conceal serious gaps. Implementation should therefore combine numerical measures with direct feedback, especially from people who face the greatest barriers. The purpose is not to collect comments for appearance's sake. Feedback must be linked to a process for correction, with reasons provided when a suggestion cannot be adopted. That discipline improves both fairness and the quality of later decisions.`,
    (pillar) => `Another essential element is ${pillar}. This should be considered across the full life of the arrangement rather than only at launch. Initial funding, staffing, or publicity may create a strong beginning, but long-term performance depends on maintenance, training, and the ability to adapt. The plan should state what will be reviewed, how often the review will occur, and what evidence would justify a change. It should also account for low-probability events that would cause serious harm, while avoiding controls so burdensome that normal work becomes impossible.`,
    (pillar) => `Particular care is required in relation to ${pillar}. Clear communication is necessary, but communication cannot replace capacity or accountability. People should know what will happen, who is responsible, how long it is expected to take, and where they can raise a concern. The organisation must then support those promises with adequate people, systems, and authority. If delivery falls behind, an early and specific update is more useful than reassurance that avoids the difficult facts. Trust grows when information remains accurate under pressure.`,
    (pillar) => `Finally, the model should make provision for ${pillar}. Completion should not be defined as the moment a document is signed, a platform is launched, or a public announcement is made. The real test is whether the intended result continues and whether unintended harm is corrected. A named review body should compare outcomes with the original baseline, publish a proportionate summary, and assign further work. Lessons should be carried into future projects so that each programme improves institutional capability rather than beginning again from zero.`
  ];
  const closing = `Taken together, these elements provide a balanced basis for ${item.subject}. They do not remove every uncertainty, and they should not be presented as a guarantee of perfect results. They do, however, make responsibilities visible, create evidence for review, and give affected people a meaningful route to respond. The next step should be a documented decision followed by a realistic implementation plan, with early review dates rather than a distant promise to evaluate the work after problems have already become established.`;
  const content = [openings[item.category], ...item.pillars.map((pillar, index) => paragraphPatterns[index](pillar)), closing].join("\n\n");
  return { ...item, content };
}

function readSourceArticles(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/^---$/m).map((part) => part.trim()).filter(Boolean).map((part) => {
    const match = part.match(/^##\s+(.+)\n/);
    if (!match) throw new Error("Every Articles.txt passage must begin with a level-two heading.");
    return { title: match[1].trim(), content: part.replace(/^##[^\n]*\n/, "").trim() };
  });
}

function wordCount(value) {
  return value.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
}

function validateArticles(articles) {
  const categories = ["Business email", "Tender / proposal writing", "Government / formal English", "News article", "Casual writing", "Legal / contract style", "Random paragraph"];
  if (articles.length !== 35) throw new Error(`Expected 35 articles, received ${articles.length}.`);
  for (const category of categories) {
    const categoryArticles = articles.filter((article) => article.category === category);
    if (categoryArticles.length !== 5) throw new Error(`${category} has ${categoryArticles.length} articles instead of 5.`);
  }
  const short = articles.filter((article) => wordCount(article.content) < 500);
  if (short.length) throw new Error(`Articles below 500 words: ${short.map((article) => article.title).join(", ")}`);
}

function renderMigration(articles) {
  const values = articles.map((article) => `  (${sqlLiteral(article.title)}, ${sqlLiteral(article.category)}, ${sqlLiteral(article.style)}, ${dollarQuote(article.content)}, 'english', true, true)`).join(",\n");
  return `-- Generated by scripts/buildEnglishLongformMigration.mjs.\n-- 35 standalone English passages: seven categories, five passages each, minimum 500 words.\n\ncreate temporary table formaltype_english_longform_seed (\n  title text primary key,\n  category text not null,\n  style text not null,\n  content text not null,\n  language text not null,\n  is_active boolean not null,\n  is_public boolean not null\n+) on commit drop;\n\ninsert into formaltype_english_longform_seed (title, category, style, content, language, is_active, is_public) values\n${values};\n\nupdate public.passages as passage\nset category = seed.category, style = seed.style, content = seed.content, language = seed.language, is_active = true, is_public = true, updated_at = now()\nfrom formaltype_english_longform_seed as seed\nwhere passage.title = seed.title;\n\ninsert into public.passages (title, category, style, content, language, is_active, is_public)\nselect seed.title, seed.category, seed.style, seed.content, seed.language, seed.is_active, seed.is_public\nfrom formaltype_english_longform_seed as seed\nwhere not exists (select 1 from public.passages existing where existing.title = seed.title);\n\ndo $$\ndeclare\n  missing_count integer;\n  short_count integer;\nbegin\n  select count(*) into missing_count\n  from (values ('Business email'), ('Tender / proposal writing'), ('Government / formal English'), ('News article'), ('Casual writing'), ('Legal / contract style'), ('Random paragraph')) as required(category)\n  where (select count(*) from public.passages p where p.category = required.category and p.language = 'english' and p.style = 'English longform v1' and p.is_active) < 5;\n\n  select count(*) into short_count\n  from public.passages\n  where language = 'english' and style = 'English longform v1' and is_active\n    and array_length(regexp_split_to_array(trim(content), E'\\\\s+'), 1) < 500;\n\n  if missing_count > 0 or short_count > 0 then\n    raise exception 'English longform coverage incomplete: % categories below five passages, % active passages below 500 words', missing_count, short_count;\n  end if;\nend $$;\n`;
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function dollarQuote(value) {
  if (value.includes("$formaltype$")) throw new Error("Unexpected dollar quote marker in content.");
  return `$formaltype$${value}$formaltype$`;
}
