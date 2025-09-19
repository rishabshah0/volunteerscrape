import { NextRequest, NextResponse } from "next/server";
import { ObjectId, Document, Filter } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { Opportunity } from "@/lib/types";

function asStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;
}
function pickString(obj: Document, keys: string[], fallback?: string): string | undefined {
  for (const k of keys) {
    const v = obj[k as keyof Document];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return fallback;
}
function pickStringArray(obj: Document, keys: string[]): string[] | undefined {
  for (const k of keys) {
    const v = obj[k as keyof Document];
    const arr = asStringArray(v);
    if (arr && arr.length) return arr;
  }
  return undefined;
}

function mapDocToOpportunity(doc: Document): Opportunity {
  const id = String((doc as { _id?: unknown; id?: unknown })._id ?? (doc as { id?: unknown }).id ?? "");
  const createdAt = pickString(doc, ["createdAt"]) || new Date().toISOString();
  const updatedAt = pickString(doc, ["updatedAt"]) || createdAt;
  const title = pickString(doc, ["title", "activity_type", "activityType"], "Untitled") || "Untitled";
  const organization = pickString(doc, ["organization", "organization_name"], "") || "";
  const tags = pickStringArray(doc, ["tags"]) || [];
  const location = pickString(doc, ["location"], "") || "";
  const description = pickString(doc, ["description", "extra"], "") || "";
  const activityType = pickString(doc, ["activityType", "activity_type"], "") || "";
  const timeSlot = pickString(doc, ["timeSlot", "time_slot"], "") || "";
  const dateStart = pickString(doc, ["dateStart", "date_start"]);
  const dateEnd = pickString(doc, ["dateEnd", "date_end"]);
  const url = pickString(doc, ["url"], "") || "";
  const contactEmail = pickString(doc, ["contactEmail", "contact_email"]);
  const contactPhoneRaw = (doc as Record<string, unknown>)["contactPhone"] ?? (doc as Record<string, unknown>)["contact_number"];
  const contactPhone = typeof contactPhoneRaw === "string" ? contactPhoneRaw : typeof contactPhoneRaw === "number" ? String(contactPhoneRaw) : undefined;
  return { id, title, organization, tags, location, description, activityType, timeSlot, dateStart, dateEnd, url, contactEmail, contactPhone, createdAt, updatedAt };
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const col = await getCollection<Document>("opportunities");
    const _id = new ObjectId(id);
    const doc = await col.findOne({ _id } as Filter<Document>);
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(mapDocToOpportunity(doc));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const col = await getCollection<Document>("opportunities");
    const _id = new ObjectId(id);
    const body = (await req.json()) as unknown;
    const obj = (typeof body === "object" && body && !Array.isArray(body) ? (body as Record<string, unknown>) : {}) as Record<string, unknown>;
    const update: Document = {
      ...(obj as Document),
      updatedAt: new Date().toISOString(),
    };
    delete (update as Record<string, unknown>)["_id"];
    const res = await col.findOneAndUpdate({ _id } as Filter<Document>, { $set: update }, { returnDocument: "after" });
    const value = (res as unknown as { value?: Document }).value;
    if (!value) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(mapDocToOpportunity(value));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const col = await getCollection<Document>("opportunities");
    const _id = new ObjectId(id);
    const res = await col.deleteOne({ _id } as Filter<Document>);
    if (res.deletedCount === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
