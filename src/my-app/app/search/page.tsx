"use client";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { listOpportunities } from "@/lib/api";
import type { Opportunity } from "@/lib/types";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, Search } from "lucide-react";

export default function SearchPage() {
  const [rawItems, setRawItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [location, setLocation] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 12;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Pull a generous page from server; client-side filters/fuzzy applied locally for the demo
      const res = await listOpportunities({ page: 1, pageSize: 200 });
      setRawItems(res.items);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Apply filters + fuzzy
  const filtered = useMemo(() => {
    let base = rawItems;
    if (tag) {
      base = base.filter((i) => i.tags?.includes(tag));
    }
    if (location) {
      const re = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      base = base.filter((i) => re.test(i.location || ""));
    }
    if (dateFrom || dateTo) {
      base = base.filter((i) => {
        if (!i.dateStart) return false;
        const d = new Date(i.dateStart).getTime();
        if (dateFrom && d < dateFrom.getTime()) return false;
        if (dateTo && d > dateTo.getTime()) return false;
        return true;
      });
    }
    if (q.trim()) {
      const fuse = new Fuse(base, { keys: ["title", "organization", "tags", "location", "description"], threshold: 0.35, ignoreLocation: true });
      return fuse.search(q.trim()).map((r) => r.item);
    }
    return base;
  }, [rawItems, q, tag, location, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [q, tag, location, dateFrom, dateTo]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center gap-4 border-b bg-background/60 sticky top-0 z-10">
        <div className="font-semibold">@my-app</div>
        <div className="flex-1 max-w-2xl flex gap-2">
          <Input placeholder="Search opportunities..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Button onClick={() => setPage(1)}><Search className="size-4 mr-2"/>Search</Button>
        </div>
        <Button variant="ghost" onClick={() => window.location.assign("/login")}>Admin</Button>
      </header>

      <main className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder="Tag (e.g. community)" value={tag} onChange={(e) => setTag(e.target.value)} className="w-48" />
          <Input placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="w-60" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2"><CalendarIcon className="size-4" /> From {dateFrom ? dateFrom.toLocaleDateString() : ""}</Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2"><CalendarIcon className="size-4" /> To {dateTo ? dateTo.toLocaleDateString() : ""}</Button>
            </PopoverTrigger>
            <PopoverContent className="p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" onClick={() => { setQ(""); setTag(""); setLocation(""); setDateFrom(undefined); setDateTo(undefined); }}>Reset</Button>
        </div>

        {error && <div className="text-sm text-destructive">{error}</div>}

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pageItems.map((o) => (
              <Card key={o.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base">{o.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2 flex-1">
                  <div className="text-muted-foreground">{o.organization}</div>
                  <div className="text-muted-foreground">{o.location}</div>
                  <div className="space-x-1">
                    {o.tags?.slice(0, 4).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                  {o.url && <a className="text-primary underline" href={o.url} target="_blank" rel="noreferrer">View</a>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">Page {page} of {totalPages} • {filtered.length} results</div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </main>
    </div>
  );
}

