-- Seed a copyright-safe bilingual starter collection.
-- Classical Chinese works below are in the public domain. English passages are
-- original FormalType practice copy. Re-running this migration is safe: titles
-- that already exist are skipped.

insert into public.passages (title, category, style, content, language, is_active, is_public)
select seed.title, seed.category, seed.style, seed.content, seed.language, true, true
from (values
  ('岳陽樓記（節錄）', '文言文', 'Classical', '若夫霪雨霏霏，連月不開，陰風怒號，濁浪排空；日星隱耀，山岳潛形；商旅不行，檣傾楫摧；薄暮冥冥，虎嘯猿啼。登斯樓也，則有去國懷鄉，憂讒畏譏，滿目蕭然，感極而悲者矣。至若春和景明，波瀾不驚，上下天光，一碧萬頃；沙鷗翔集，錦鱗游泳；岸芷汀蘭，郁郁青青。', 'chinese'),
  ('醉翁亭記（節錄）', '文言文', 'Classical', '環滁皆山也。其西南諸峰，林壑尤美，望之蔚然而深秀者，琅琊也。山行六七里，漸聞水聲潺潺，而瀉出於兩峰之間者，釀泉也。峰迴路轉，有亭翼然臨於泉上者，醉翁亭也。作亭者誰？山之僧智仙也。名之者誰？太守自謂也。', 'chinese'),
  ('桃花源記（節錄）', '文言文', 'Classical', '晉太元中，武陵人捕魚為業。緣溪行，忘路之遠近。忽逢桃花林，夾岸數百步，中無雜樹，芳草鮮美，落英繽紛。漁人甚異之，復前行，欲窮其林。林盡水源，便得一山，山有小口，彷彿若有光，便舍船，從口入。', 'chinese'),
  ('陋室銘', '文言文', 'Classical', '山不在高，有仙則名。水不在深，有龍則靈。斯是陋室，惟吾德馨。苔痕上階綠，草色入簾青。談笑有鴻儒，往來無白丁。可以調素琴，閱金經。無絲竹之亂耳，無案牘之勞形。南陽諸葛廬，西蜀子雲亭。孔子云：何陋之有？', 'chinese'),
  ('愛蓮說', '文言文', 'Classical', '水陸草木之花，可愛者甚蕃。晉陶淵明獨愛菊。自李唐來，世人甚愛牡丹。予獨愛蓮之出淤泥而不染，濯清漣而不妖，中通外直，不蔓不枝，香遠益清，亭亭淨植，可遠觀而不可褻玩焉。', 'chinese'),
  ('勸學（節錄）', '文言文', 'Classical', '君子曰：學不可以已。青，取之於藍，而青於藍；冰，水為之，而寒於水。木直中繩，輮以為輪，其曲中規，雖有槁暴，不復挺者，輮使之然也。故木受繩則直，金就礪則利，君子博學而日參省乎己，則知明而行無過矣。', 'chinese'),
  ('出師表（節錄）', '文言文', 'Classical', '先帝創業未半而中道崩殂，今天下三分，益州疲弊，此誠危急存亡之秋也。然侍衛之臣不懈於內，忠志之士忘身於外者，蓋追先帝之殊遇，欲報之於陛下也。誠宜開張聖聽，以光先帝遺德，恢弘志士之氣。', 'chinese'),
  ('蘭亭集序（節錄）', '文言文', 'Classical', '永和九年，歲在癸丑，暮春之初，會於會稽山陰之蘭亭，修禊事也。群賢畢至，少長咸集。此地有崇山峻嶺，茂林修竹；又有清流激湍，映帶左右，引以為流觴曲水，列坐其次。雖無絲竹管弦之盛，一觴一詠，亦足以暢敘幽情。', 'chinese'),
  ('春望', '詩詞', 'Poetry', '國破山河在，城春草木深。感時花濺淚，恨別鳥驚心。烽火連三月，家書抵萬金。白頭搔更短，渾欲不勝簪。', 'chinese'),
  ('水調歌頭', '詩詞', 'Poetry', '明月幾時有？把酒問青天。不知天上宮闕，今夕是何年。我欲乘風歸去，又恐瓊樓玉宇，高處不勝寒。起舞弄清影，何似在人間。轉朱閣，低綺戶，照無眠。不應有恨，何事長向別時圓？人有悲歡離合，月有陰晴圓缺，此事古難全。但願人長久，千里共嬋娟。', 'chinese'),
  ('將進酒（節錄）', '詩詞', 'Poetry', '君不見黃河之水天上來，奔流到海不復回。君不見高堂明鏡悲白髮，朝如青絲暮成雪。人生得意須盡歡，莫使金樽空對月。天生我材必有用，千金散盡還復來。', 'chinese'),
  ('虞美人', '詩詞', 'Poetry', '春花秋月何時了？往事知多少。小樓昨夜又東風，故國不堪回首月明中。雕欄玉砌應猶在，只是朱顏改。問君能有幾多愁？恰似一江春水向東流。', 'chinese'),
  ('A Clear Project Handover', 'Business email', 'Formal', 'A useful handover explains what has been completed, what remains open, and who owns each next action. It records important decisions without burying them in long meeting notes. Dates, dependencies, file locations, and known risks should be stated plainly so that the incoming team can continue the work without guessing.', 'english'),
  ('Designing a Reliable Process', 'Tender / proposal writing', 'Formal', 'A reliable process makes the expected result visible at every stage. It defines the inputs, assigns responsibility, and includes checks before work moves forward. When an exception occurs, the team should know who can decide, what evidence is required, and how the decision will be recorded for later review.', 'english'),
  ('A Better Public Notice', 'Government / formal English', 'Formal', 'A public notice should tell readers what is changing, when the change takes effect, and what action they need to take. Essential details belong near the beginning. Supporting explanations may follow, but contact information, deadlines, eligibility conditions, and accessible alternatives should never be difficult to find.', 'english'),
  ('The Morning Ferry Service', 'News article', 'Intermediate', 'The transport operator introduced an additional morning ferry service after passenger numbers increased during the previous quarter. The trial will run for three months. Officials said they will review punctuality, capacity, and customer feedback before deciding whether the timetable should become permanent.', 'english'),
  ('Learning to Notice Small Details', 'Casual writing', 'Simple', 'I used to think progress had to feel dramatic, but most improvements are almost invisible at first. A cleaner sentence, a better shortcut, or five quiet minutes of practice may not seem important on its own. Repeated often enough, those small choices begin to change how the whole day feels.', 'english'),
  ('Service Continuity Clause', 'Legal / contract style', 'Formal', 'The supplier shall maintain reasonable continuity arrangements throughout the service period. If an event materially affects delivery, the supplier shall notify the client promptly, describe the expected impact, and provide a recovery plan. Such notice shall not relieve either party of obligations that remain capable of performance.', 'english'),
  ('Why Slow Practice Works', 'Random paragraph', 'Intermediate', 'Slow practice reveals errors that speed can hide. When typists reduce the pace, they can notice tension, repeated mistakes, and awkward transitions between keys. Accuracy becomes deliberate rather than accidental. Once the movement feels stable, speed can increase without sacrificing control.', 'english'),
  ('Reading Before Responding', 'Business email', 'Concise', 'Before replying to a complicated message, identify the decision being requested and separate it from the background information. Confirm the facts, answer the direct question, and list any unresolved points. A short, structured response is often more helpful than a long reply written before the issue is fully understood.', 'english'),
  ('Evaluating a Practical Proposal', 'Tender / proposal writing', 'Advanced', 'A strong proposal connects each promised benefit to a credible method, named resources, and measurable evidence. Reviewers should be able to trace how the supplier will move from planning to delivery. Attractive claims carry little weight when the timetable, governance, and quality controls remain vague.', 'english'),
  ('Keeping Digital Records Useful', 'Government / formal English', 'Formal', 'Digital records remain useful only when they can be found, understood, and trusted. File names should follow a consistent pattern, access should reflect operational need, and important versions should be retained according to policy. Sensitive information must not be copied into informal channels merely for convenience.', 'english'),
  ('A Library Open After Dark', 'News article', 'Intermediate', 'The district library will extend its weekday opening hours next month as part of a six-month pilot programme. The later schedule is intended to support students and shift workers. Visitor numbers, staffing costs, and public comments will be reviewed before the authority considers a permanent change.', 'english'),
  ('The Useful Pause', 'Random paragraph', 'Punctuation-heavy', 'A pause is not wasted time; it is a small space for checking direction. Before sending, submitting, or deciding, ask three questions: Is the purpose clear? Is anything important missing? Could the reader misunderstand the next step? A brief review can prevent a much longer correction.', 'english')
) as seed(title, category, style, content, language)
where not exists (
  select 1 from public.passages existing where existing.title = seed.title
);
