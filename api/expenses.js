// Admin only. Business expenses for the dashboard (stored encrypted).
// GET    /api/expenses          → all expenses
// POST   /api/expenses          → { date, category, amount, note }
// DELETE /api/expenses?id=…
import crypto from "node:crypto";
import { json, isAuthed, hasStorage, readExpenses, writeExpenses } from "./_lib.js";

export const CATEGORIES = ["Stock purchase", "Shipping & delivery", "Marketing", "Packaging", "Rent & utilities", "Salaries", "Software & fees", "Other"];

export async function GET(request) {
  if (!isAuthed(request)) return json({ error: "Not signed in" }, 401);
  return json({ expenses: await readExpenses(), categories: CATEGORIES });
}

export async function POST(request) {
  if (!isAuthed(request)) return json({ error: "Your session has expired. Please sign in again." }, 401);
  if (!hasStorage()) return json({ error: "Connect storage first." }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const amount = Math.round(Number(b.amount) * 100) / 100;
  if (!(amount > 0)) return json({ error: "Enter an amount." }, 422);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date || "") ? b.date : new Date().toISOString().slice(0, 10);
  const expense = {
    id: crypto.randomBytes(6).toString("hex"), date, amount,
    category: CATEGORIES.includes(b.category) ? b.category : "Other",
    note: String(b.note || "").trim().slice(0, 300), createdAt: new Date().toISOString(),
  };
  const list = await readExpenses();
  list.push(expense);
  list.sort((a, c) => c.date.localeCompare(a.date));
  await writeExpenses(list);
  return json({ expense, expenses: list });
}

export async function DELETE(request) {
  if (!isAuthed(request)) return json({ error: "Your session has expired. Please sign in again." }, 401);
  const id = new URL(request.url).searchParams.get("id");
  const list = (await readExpenses()).filter((e) => e.id !== id);
  await writeExpenses(list);
  return json({ expenses: list });
}
