const TIERS = [10, 50, 100, 500, 1000];
const BASE = "https://api.razorpay.com/v1";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in env. Load .env (direnv) first.");
  process.exit(1);
}

const mode = keyId.startsWith("rzp_test_") ? "TEST" : "LIVE";
if (mode === "LIVE" && !process.argv.includes("--live")) {
  console.error("Refusing LIVE keys without --live flag. Re-run with --live to create real plans.");
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

async function rzp(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { authorization: auth, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`razorpay ${path} → ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function findExistingPlans() {
  const byTier = new Map();
  const list = await rzp("/plans?count=100");
  for (const plan of list.items ?? []) {
    if (plan.notes?.program === "rupee-fund" && plan.notes?.tier) {
      byTier.set(Number(plan.notes.tier), plan.id);
    }
  }
  return byTier;
}

async function main() {
  console.error(`Razorpay mode: ${mode}`);
  const existing = await findExistingPlans();
  const results = [];

  for (const tier of TIERS) {
    const reused = existing.get(tier);
    if (reused) {
      console.error(`  ₹${tier}/mo  reused  ${reused}`);
      results.push([tier, reused]);
      continue;
    }
    const plan = await rzp("/plans", {
      method: "POST",
      body: JSON.stringify({
        period: "monthly",
        interval: 1,
        item: { name: `The Rupee Fund — ₹${tier}/month`, amount: tier * 100, currency: "INR" },
        notes: { program: "rupee-fund", tier: String(tier) },
      }),
    });
    console.error(`  ₹${tier}/mo  created ${plan.id}`);
    results.push([tier, plan.id]);
  }

  console.error("\nPaste into .env:\n");
  for (const [tier, id] of results) {
    console.log(`RZP_PLAN_${tier}="${id}"`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
