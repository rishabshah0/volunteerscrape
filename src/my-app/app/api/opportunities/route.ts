import { NextRequest, NextResponse } from "next/server";
import { Filter, Document } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { Opportunity } from "@/lib/types";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") || "10", 10)));
    const q = searchParams.get("q")?.trim();
    const tag = searchParams.get("tag")?.trim();
    const location = searchParams.get("location")?.trim();
    const dateFrom = searchParams.get("dateFrom")?.trim();
    const dateTo = searchParams.get("dateTo")?.trim();

    const col = await getCollection<Document>("opportunities");

    const filter: Filter<Document> = {};
    const and: Filter<Document>[] = [];
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      and.push({
        $or: [
          { title: regex },
          { organization: regex },
          { organization_name: regex },
          { location: regex },
          { tags: { $in: [regex] } },
          { description: regex },
          { extra: regex },
        ],
      });
    }
    if (tag) {
      and.push({ tags: { $in: [tag] } });
    }
    if (location) {
      const regex = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      and.push({ location: regex });
    }
    if (dateFrom || dateTo) {
      const range: { $gte?: string; $lte?: string } = {};
      if (dateFrom) range.$gte = dateFrom;
      if (dateTo) range.$lte = dateTo;
      and.push({ $or: [{ dateStart: range }, { date_start: range }] });
    }
    if (and.length) (filter as Record<string, unknown>).$and = and;

    const total = await col.countDocuments(filter);
    const itemsRaw = await col
      .find(filter)
      .sort({ _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    const items = itemsRaw.map(mapDocToOpportunity);

    return NextResponse.json({ items, total, page, pageSize });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const obj = (typeof body === "object" && body && !Array.isArray(body) ? (body as Record<string, unknown>) : {}) as Record<string, unknown>;
    const now = new Date().toISOString();
    const doc: Document = {
      title: asString(obj.title) ?? "Untitled",
      organization: asString(obj.organization) ?? "",
      tags: asStringArray(obj.tags) ?? [],
      location: asString(obj.location) ?? "",
      description: asString(obj.description) ?? "",
      activityType: asString(obj.activityType) ?? "",
      timeSlot: asString(obj.timeSlot) ?? "",
      dateStart: asString(obj.dateStart),
      dateEnd: asString(obj.dateEnd),
      url: asString(obj.url) ?? "",
      contactEmail: asString(obj.contactEmail),
      contactPhone: asString(obj.contactPhone),
      createdAt: now,
      updatedAt: now,
    };
    const col = await getCollection<Document>("opportunities");
    const res = await col.insertOne(doc);
    const inserted = await col.findOne({ _id: res.insertedId } as Filter<Document>);
    if (!inserted) return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    return NextResponse.json(mapDocToOpportunity(inserted));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
