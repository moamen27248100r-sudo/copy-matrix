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

const onlyId = process.argv[2]; // optional: run against a single leader id first

let leaderCount = 0;
let signalCount = 0;

for (const leader of LEADERS) {
  if (onlyId && leader.id !== onlyId) continue;

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
