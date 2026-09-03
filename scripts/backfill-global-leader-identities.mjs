// One-time backfill: give a curated set of ~20 platform-curated (user_id is
// null) leaders a realistic international name + country, bias their future
// symbol_bias toward an instrument that's genuinely theirs (home currency /
// home index / well-documented local market habit — never a personality
// stereotype), and reassign a majority of THEIR OWN historical signals to
// match, while preserving each trade's win/loss direction and roughly its
// existing % move magnitude. See plans/noble-floating-meadow.md.
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const ALL_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "XAUUSD", "EURUSD", "GBPUSD",
  "USDJPY", "SOLUSDT", "BNBUSDT", "XRPUSDT", "US30",
];

const { rows: priceRows } = await client.query(`select symbol, price from market_prices`);
const BASE_PRICE = Object.fromEntries(priceRows.map((r) => [r.symbol, Number(r.price)]));
// US30 (an index, not tracked in market_prices) — matches the level recent
// live US30 signals have actually been opening/closing at.
BASE_PRICE.US30 ??= 39000;
for (const s of ALL_SYMBOLS) {
  if (!(s in BASE_PRICE)) throw new Error(`missing base price for ${s}`);
}

const LEADERS = [
  { id: "e7b20ecd-121b-47a0-aeca-a4f03ee2dd91", country: "US", name: "Michael Turner", focus: "US30",
    bio: "متداول أمريكي محترف، متخصص في مؤشر داو جونز الصناعي ومتابعة حركة الأسواق الأمريكية عن كثب." },
  { id: "afda09da-9e88-4aaf-ad82-4b05ec232144", country: "GB", name: "Charlotte Bennett", focus: "GBPUSD",
    bio: "متداولة بريطانية متمرسة، تركّز على زوج الجنيه الإسترليني مقابل الدولار وتحليل قرارات بنك إنجلترا." },
  { id: "8ce804d0-c741-4682-9ca6-0ccc5e7e69fe", country: "BE", name: "Lucas Peeters", focus: "EURUSD",
    bio: "متداول بلجيكي، يركّز على زوج اليورو مقابل الدولار ومتابعة قرارات البنك المركزي الأوروبي." },
  { id: "d2dde98a-38cb-4c5f-8c50-0af8dcfaae7b", country: "JP", name: "Yuki Tanaka", focus: "USDJPY",
    bio: "متداولة يابانية، متخصصة في زوج الدولار مقابل الين الياباني وتحليل أسواق آسيا." },
  { id: "4656a6d8-b486-4caa-83a5-fcdbe57f9a7d", country: "DE", name: "Felix Wagner", focus: "EURUSD",
    bio: "متداول ألماني، يركّز على زوج اليورو مقابل الدولار ضمن أكبر اقتصاد في منطقة اليورو." },
  { id: "d52fd188-0145-4993-b189-98a7bc8202e7", country: "ZA", name: "Sipho Nkosi", focus: "XAUUSD",
    bio: "متداول من جنوب أفريقيا، متخصص في تداول الذهب انطلاقًا من خبرته في أحد أكبر أسواق إنتاجه عالميًا." },
  { id: "006cb6e5-4723-4b85-b128-c03187dbc8a1", country: "NG", name: "Chioma Okafor", focus: "BTCUSDT",
    bio: "متداولة نيجيرية، تركّز على العملات الرقمية في ظل الإقبال الكبير عليها في بلدها." },
  { id: "315b3fe8-4169-4c38-9297-fe3f8416694b", country: "FR", name: "Camille Laurent", focus: "EURUSD",
    bio: "متداولة فرنسية، تتابع زوج اليورو مقابل الدولار وتحركات الأسواق الأوروبية." },
  { id: "aa77a951-48d1-4333-bfbd-0f2bb981c4b0", country: "IN", name: "Ananya Sharma", focus: "ETHUSDT",
    bio: "متداولة هندية، متخصصة في العملات الرقمية ضمن واحد من أسرع أسواق التداول الرقمي نموًا." },
  { id: "1498ac2b-8805-410a-83b9-05cfb8bc0946", country: "KR", name: "Ji-woo Kim", focus: "SOLUSDT",
    bio: "متداولة كورية جنوبية، تركّز على العملات الرقمية في سوق معروف بنشاطه الكبير في هذا المجال." },
  { id: "aeda22ef-2562-4b02-a722-23a1ca8e1ef7", country: "CA", name: "Emily Carter", focus: "US30",
    bio: "متداولة كندية، تتابع المؤشرات الأمريكية عن قرب نظرًا للتقارب الاقتصادي الكبير بين البلدين." },
  { id: "70699779-e1ff-4b82-ae51-1ad7132936f1", country: "TR", name: "Elif Yılmaz", focus: "XAUUSD",
    bio: "متداولة تركية، متخصصة في تداول الذهب انطلاقًا من ثقافة الادخار به المنتشرة في بلدها." },
  { id: "1710f8c8-2ed5-4660-9ea7-ff6067575ac0", country: "BR", name: "Beatriz Souza", focus: "BTCUSDT",
    bio: "متداولة برازيلية، تركّز على العملات الرقمية ضمن أحد أنشط أسواقها في أمريكا الجنوبية." },
  { id: "e9d1a7ab-86bc-43ee-95ab-bfea805f30e5", country: "NL", name: "Sanne de Vries", focus: "EURUSD",
    bio: "متداولة هولندية، تتابع زوج اليورو مقابل الدولار وأسواق أوروبا الغربية." },
  { id: "8ce7b41b-c8e0-45a9-8c70-dcc95a0b917b", country: "IT", name: "Matteo Romano", focus: "EURUSD",
    bio: "متداول إيطالي، يركّز على زوج اليورو مقابل الدولار وتحركات الاقتصاد الأوروبي." },
  { id: "a6201d3c-43a3-4ba8-89a7-fa0a59d277af", country: "AU", name: "Chloe Anderson", focus: "XAUUSD",
    bio: "متداولة أسترالية، متخصصة في تداول الذهب انطلاقًا من مكانة بلدها كأحد أكبر منتجيه عالميًا." },
  { id: "d580d09c-666d-4e7d-a32a-ae475ebcca2c", country: "ES", name: "Pablo Fernández", focus: "EURUSD",
    bio: "متداول إسباني، يتابع زوج اليورو مقابل الدولار وأسواق جنوب أوروبا." },
  { id: "e9623130-3249-4903-93a9-9461b6d54929", country: "SE", name: "Erik Lindqvist", focus: "EURUSD",
    bio: "متداول سويدي، يركّز على زوج اليورو مقابل الدولار ضمن أسواق شمال أوروبا." },
  { id: "fa01a15d-ef74-437f-882c-930bbb309cde", country: "MX", name: "Diego Hernández", focus: "US30",
    bio: "متداول مكسيكي، يتابع المؤشرات الأمريكية نظرًا للترابط الاقتصادي الكبير بين البلدين." },
  { id: "64b86189-401d-4f3e-9dc9-e64e1dd823de", country: "ID", name: "Bayu Pratama", focus: "BNBUSDT",
    bio: "متداول إندونيسي، متخصص في العملات الرقمية ضمن أحد أسرع أسواقها نموًا في جنوب شرق آسيا." },

  // Second batch — 30 more, per explicit follow-up request to expand beyond 20.
  { id: "e62ab48a-29e6-4c94-a0f1-4210264488a9", country: "AR", name: "Valentina Rojas", focus: "BTCUSDT",
    bio: "متداولة أرجنتينية، تركّز على العملات الرقمية في ظل إقبال كبير عليها كوسيلة للتحوّط من التضخم في بلدها." },
  { id: "75f987d3-ccdf-42db-9d1c-0cbd4c95420b", country: "CO", name: "Mariana Gómez", focus: "BTCUSDT",
    bio: "متداولة كولومبية، تركّز على العملات الرقمية ضمن أحد أنشط أسواقها في أمريكا اللاتينية." },
  { id: "fdca4b59-6e7c-4d91-98f2-43c0425a5519", country: "CL", name: "Sebastián Muñoz", focus: "ETHUSDT",
    bio: "متداول تشيلي، يتابع العملات الرقمية ضمن سوقها المتنامي في أمريكا الجنوبية." },
  { id: "3ad3ecc3-0de7-4b99-85ea-be1ec10a5b81", country: "PE", name: "Diego Vargas", focus: "XAUUSD",
    bio: "متداول من بيرو، متخصص في تداول الذهب انطلاقًا من مكانة بلده كأحد أكبر منتجيه عالميًا." },
  { id: "018841c8-06cf-44a9-9288-f154e38ebbdb", country: "PL", name: "Zofia Kowalska", focus: "BTCUSDT",
    bio: "متداولة بولندية، تركّز على العملات الرقمية في ظل النشاط الكبير لسوقها الرقمي في أوروبا." },
  { id: "f5d3fca2-e57a-4456-a0e8-e0e6684a5ca2", country: "PT", name: "Rodrigo Silva", focus: "EURUSD",
    bio: "متداول برتغالي، يركّز على زوج اليورو مقابل الدولار ضمن منطقة اليورو." },
  { id: "5051957d-9e3a-4b02-8d0f-f1a6c316040d", country: "CH", name: "Laura Meier", focus: "XAUUSD",
    bio: "متداولة سويسرية، متخصصة في تداول الذهب انطلاقًا من مكانة بلدها كمركز عالمي لتكرير الذهب وتجارته." },
  { id: "ebd2c19c-d1a2-4c5f-93d9-69f937364b72", country: "AT", name: "Jonas Gruber", focus: "EURUSD",
    bio: "متداول نمساوي، يركّز على زوج اليورو مقابل الدولار ضمن منطقة اليورو." },
  { id: "2a304d2a-4630-4e41-bba1-8623c2a93b0c", country: "NO", name: "Magnus Haugen", focus: "BNBUSDT",
    bio: "متداول نرويجي، يتابع العملات الرقمية ضمن سوق تقني نشط في بلده." },
  { id: "9c736034-a220-44fb-be80-dafdf3ed55b4", country: "DK", name: "Freja Nielsen", focus: "EURUSD",
    bio: "متداولة دنماركية، تتابع زوج اليورو مقابل الدولار نظرًا لارتباط عملة بلدها الوثيق باليورو." },
  { id: "2b576c61-5f59-4ed9-88d4-c0c152c59bf0", country: "FI", name: "Elias Korhonen", focus: "EURUSD",
    bio: "متداول فنلندي، يركّز على زوج اليورو مقابل الدولار ضمن منطقة اليورو." },
  { id: "30bc097f-825a-441f-9852-093e0db800de", country: "GR", name: "Nikos Papadopoulos", focus: "EURUSD",
    bio: "متداول يوناني، يركّز على زوج اليورو مقابل الدولار ضمن منطقة اليورو." },
  { id: "6beaa599-f5ba-4354-ae5e-852624e8725b", country: "IE", name: "Aoife Byrne", focus: "EURUSD",
    bio: "متداولة إيرلندية، تركّز على زوج اليورو مقابل الدولار ضمن منطقة اليورو." },
  { id: "2ea6158c-1e72-4a0b-96ed-7a4f6f92b700", country: "RU", name: "Dmitri Volkov", focus: "XAUUSD",
    bio: "متداول روسي، متخصص في تداول الذهب انطلاقًا من مكانة بلده كأحد أكبر منتجيه ومراكمي احتياطاته عالميًا." },
  { id: "4f102edb-bfbc-49e3-9009-b5502a58f546", country: "CN", name: "Wei Zhang", focus: "BTCUSDT",
    bio: "متداول صيني، يتابع العملات الرقمية ضمن سوق ذي تاريخ طويل ونشاط كبير في هذا المجال." },
  { id: "75252413-8507-46d3-aedb-4bbd710763f5", country: "TH", name: "Somchai Charoen", focus: "SOLUSDT",
    bio: "متداول تايلاندي، يتابع العملات الرقمية في ظل الإقبال الكبير عليها في بلده." },
  { id: "6b18752c-60eb-4b21-9b66-71f00407e0fa", country: "MY", name: "Nur Aisyah", focus: "ETHUSDT",
    bio: "متداولة ماليزية، تتابع العملات الرقمية ضمن سوق تقني نشط في جنوب شرق آسيا." },
  { id: "89c736ee-80b9-44cf-80f0-101a7c61545f", country: "SG", name: "Michelle Tan", focus: "BTCUSDT",
    bio: "متداولة سنغافورية، تتابع العملات الرقمية انطلاقًا من مكانة بلدها كمركز عالمي رائد في التقنية المالية." },
  { id: "3c29020f-c6cc-4c86-bec7-4faccebdf6bf", country: "PH", name: "Miguel Santos", focus: "XRPUSDT",
    bio: "متداول فلبيني، يتابع العملات الرقمية في ظل الإقبال الكبير عليها في بلده." },
  { id: "c89cae41-320c-4326-9776-a41cef4b45a9", country: "VN", name: "Minh Nguyen", focus: "BNBUSDT",
    bio: "متداول فيتنامي، يتابع العملات الرقمية ضمن أحد أكثر أسواقها نشاطًا عالميًا." },
  { id: "a7ac556e-6776-45ec-ba4b-ef1e74a2319c", country: "PK", name: "Ayesha Khan", focus: "BTCUSDT",
    bio: "متداولة باكستانية، تتابع العملات الرقمية في ظل الإقبال المتنامي عليها في بلدها." },
  { id: "541df06d-1078-469b-9c4f-afde2b62d9a4", country: "NZ", name: "Charlotte Reid", focus: "XAUUSD",
    bio: "متداولة نيوزيلندية، متخصصة في تداول الذهب." },
  { id: "1141c959-f310-45f4-b189-55b18d55d961", country: "KE", name: "Amina Wanjiru", focus: "BTCUSDT",
    bio: "متداولة كينية، تتابع العملات الرقمية انطلاقًا من الريادة الكبيرة لبلدها في مجال التقنية المالية بأفريقيا." },
  { id: "991b3c54-3d97-4bcd-b1b7-fc702f4161bb", country: "GH", name: "Kwame Mensah", focus: "XAUUSD",
    bio: "متداول غاني، متخصص في تداول الذهب انطلاقًا من مكانة بلده كأكبر منتج له في أفريقيا." },
  { id: "f07db1dc-1003-4ee1-ac0a-64621597994b", country: "MA", name: "Youssef El Amrani", focus: "EURUSD",
    bio: "متداول مغربي، يتابع زوج اليورو مقابل الدولار نظرًا لارتباط عملة بلده الوثيق به." },
  { id: "b32bd947-51ad-41ba-8a3f-03bcae6e9cad", country: "CZ", name: "Tereza Nováková", focus: "ETHUSDT",
    bio: "متداولة تشيكية، تتابع العملات الرقمية ضمن أسواق أوروبا الوسطى النشطة." },
  { id: "00c24da0-1519-4744-91fb-273ee38479da", country: "HU", name: "Bence Szabó", focus: "SOLUSDT",
    bio: "متداول هنغاري، يتابع العملات الرقمية." },
  { id: "015d23a4-af54-4b35-bfca-97d77ba54d2d", country: "RO", name: "Andrei Popescu", focus: "BNBUSDT",
    bio: "متداول روماني، يتابع العملات الرقمية." },
  { id: "91c897b8-a46e-47b8-9226-856c4e31f14d", country: "UA", name: "Kateryna Shevchenko", focus: "BTCUSDT",
    bio: "متداولة أوكرانية، تتابع العملات الرقمية ضمن أحد أنشط أسواقها عالميًا." },
  { id: "af3eab2a-e2ac-49e0-a044-777575d7b83f", country: "IL", name: "Noa Cohen", focus: "ETHUSDT",
    bio: "متداولة إسرائيلية، تتابع العملات الرقمية انطلاقًا من مكانة بلدها كمركز عالمي نشط في مجال التقنية المالية وسلاسل الكتل." },
];

const REASSIGN_FRACTION = 0.75;
const MIN_MOVE = 0.003;

function jitteredBase(symbol) {
  return BASE_PRICE[symbol] * (1 + (Math.random() - 0.5) * 0.02);
}

async function reorderSymbolBias(leaderId, focus) {
  const { rows } = await client.query(`select symbol_bias from providers where id = $1`, [leaderId]);
  const old = rows[0]?.symbol_bias ?? ALL_SYMBOLS;
  const rest = old.filter((s) => s !== focus);
  return [focus, ...rest];
}

const onlyId = process.argv[2]; // optional: a single leader id, or "--new-only"

let leaderCount = 0;
let signalCount = 0;

for (const leader of LEADERS) {
  if (onlyId && onlyId !== "--new-only" && leader.id !== onlyId) continue;
  if (onlyId === "--new-only") {
    const { rows } = await client.query(`select country from providers where id = $1`, [leader.id]);
    if (rows[0]?.country) continue; // already has an identity from a previous run
  }

  const newBias = await reorderSymbolBias(leader.id, leader.focus);
  await client.query(
    `update providers set display_name = $1, country = $2, bio = $3, symbol_bias = $4 where id = $5`,
    [leader.name, leader.country, leader.bio, newBias, leader.id],
  );

  const { rows: signals } = await client.query(
    `select id, symbol, side, entry_price, exit_price, status from signals where provider_id = $1`,
    [leader.id],
  );

  const updates = [];
  for (const s of signals) {
    if (Math.random() >= REASSIGN_FRACTION) continue;

    const newEntry = jitteredBase(leader.focus);
    let newExit = null;

    if (s.status === "closed" && s.exit_price != null) {
      const entry = Number(s.entry_price);
      const exit = Number(s.exit_price);
      const oldPct = (exit - entry) / entry;
      const isWin = s.side === "buy" ? exit > entry : exit < entry;
      const magnitude = Math.max(Math.abs(oldPct) * (0.85 + Math.random() * 0.3), MIN_MOVE);
      const wantsUp = s.side === "buy" ? isWin : !isWin;
      newExit = newEntry * (1 + (wantsUp ? magnitude : -magnitude));
    }

    updates.push([s.id, leader.focus, newEntry, newExit]);
  }

  for (let i = 0; i < updates.length; i += 500) {
    const chunk = updates.slice(i, i + 500);
    await client.query(
      `update signals set symbol = v.symbol, entry_price = v.entry_price::numeric, exit_price = v.exit_price::numeric
       from unnest($1::uuid[], $2::text[], $3::numeric[], $4::numeric[]) as v(id, symbol, entry_price, exit_price)
       where signals.id = v.id`,
      [
        chunk.map((c) => c[0]),
        chunk.map((c) => c[1]),
        chunk.map((c) => c[2]),
        chunk.map((c) => c[3]),
      ],
    );
  }

  leaderCount += 1;
  signalCount += updates.length;
  console.log(`${leader.name} (${leader.country}): reassigned ${updates.length}/${signals.length} signals to ${leader.focus}`);
}

console.log(`Done: ${leaderCount} leader(s), ${signalCount} signal(s) reassigned.`);
await client.end();
