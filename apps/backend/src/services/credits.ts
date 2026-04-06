import { credits as creditsTable, type ClipforgeDb } from "@clipforge/db";
import { eq } from "drizzle-orm";

const DEFAULT_ID = "default";

function nowIso() {
  return new Date().toISOString();
}

export async function ensureCreditsRow(db: ClipforgeDb): Promise<void> {
  const existing = await db
    .select()
    .from(creditsTable)
    .where(eq(creditsTable.id, DEFAULT_ID))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(creditsTable).values({
      id: DEFAULT_ID,
      balance: 3,
      updatedAt: nowIso(),
    });
  }
}

export async function getCredits(db: ClipforgeDb): Promise<number> {
  await ensureCreditsRow(db);
  const [row] = await db
    .select()
    .from(creditsTable)
    .where(eq(creditsTable.id, DEFAULT_ID))
    .limit(1);
  return row?.balance ?? 0;
}

export async function addCredits(db: ClipforgeDb, amount: number): Promise<number> {
  await ensureCreditsRow(db);
  const [row] = await db
    .select()
    .from(creditsTable)
    .where(eq(creditsTable.id, DEFAULT_ID))
    .limit(1);
  if (!row) {
    return 0;
  }
  await db
    .update(creditsTable)
    .set({
      balance: row.balance + amount,
      updatedAt: nowIso(),
    })
    .where(eq(creditsTable.id, DEFAULT_ID));
  return row.balance + amount;
}

export async function spendCredits(db: ClipforgeDb, amount: number): Promise<number> {
  await ensureCreditsRow(db);
  const [row] = await db
    .select()
    .from(creditsTable)
    .where(eq(creditsTable.id, DEFAULT_ID))
    .limit(1);
  if (!row || row.balance < amount) {
    throw new Error("insufficient_credits");
  }
  const next = row.balance - amount;
  await db
    .update(creditsTable)
    .set({
      balance: next,
      updatedAt: nowIso(),
    })
    .where(eq(creditsTable.id, DEFAULT_ID));
  return next;
}
