"use client";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { listOpportunities } from "@/lib/api";
import type { Opportunity } from "@/lib/types";
import { Search, CalendarIcon, MapPin, Building2, Filter, X, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export default function SearchPage() {
  const [rawItems, setRawItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [location, setLocation] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function load() {
    setLoading(true);
    setError(null);
    try {
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
      base = base.filter((i) => i.tags?.some(t => t.toLowerCase() === tag));
    }
    if (location) {
      const re = new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      base = base.filter((i) => re.test(i.location || ""));
    }
    if (dateRange?.from || dateRange?.to) {
      base = base.filter((i) => {
        if (!i.dateStart) return false;
        const d = new Date(i.dateStart).getTime();
        if (dateRange?.from && d < new Date(dateRange.from).getTime()) return false;
        if (dateRange?.to && d > new Date(dateRange.to).getTime()) return false;
        return true;
      });
    }
    if (q.trim()) {
      const fuse = new Fuse(base, { keys: ["title", "organization", "tags", "location", "description"], threshold: 0.35, ignoreLocation: true });
      return fuse.search(q.trim()).map(r => r.item);
    }
    return base;
  }, [rawItems, q, tag, location, dateRange]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [q, tag, location, dateRange]);

  const activeFilters = [tag, location, dateRange?.from, dateRange?.to].filter(Boolean).length;

  const clearAllFilters = () => {
    setQ("");
    setTag("");
    setLocation("");
    setDateRange(undefined);
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const nowYear = new Date().getFullYear();
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d); // e.g. Sep
    const day = d.getDate();
    const year = d.getFullYear();
    return month + ' ' + day + (year !== nowYear ? `, ${year}` : '');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-white/90 dark:bg-slate-900/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-slate-900/70">
        <div className="mx-auto w-full max-w-7xl pl-3 pr-5 sm:pl-4 sm:pr-6 py-4">
          <div className="flex items-center w-full gap-3">
            <h1 className="mr-2 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap">Acme Inc</h1>
            <div className="relative flex-1 max-w-4xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search opportunities, organizations, locations..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-10 h-10 rounded-full bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 focus-visible:ring-slate-300 dark:focus-visible:ring-slate-600"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(v => !v)}
              className="gap-2 bg-white dark:bg-slate-800"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilters > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 text-xs">{activeFilters}</Badge>
              )}
            </Button>
            <Button variant="default" onClick={() => window.location.assign('/login')} className="hidden sm:inline-flex">Login</Button>
          </div>

          {showFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
              {/* Tag Select */}
              <div className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-2 h-10">
                <span className="text-slate-500 dark:text-slate-400">Tag</span>
                <Select value={tag} onValueChange={(v) => setTag(v)}>
                  <SelectTrigger className="h-7 bg-transparent border-none shadow-none focus:ring-0 focus-visible:ring-0 px-0 text-[12px] min-w-[7rem]">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {['environment','food security','education','community','healthcare','animal welfare','disaster relief','homeless support','advocacy'].map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tag && (
                  <button aria-label="Clear tag" onClick={() => setTag("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="h-3 w-3" /></button>
                )}
              </div>
              {/* Location */}
              <div className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-2 h-10">
                <span className="text-slate-500 dark:text-slate-400">Location</span>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City / Region"
                  className="h-7 w-40 bg-transparent border-none focus-visible:ring-0 focus:outline-none px-0 text-[12px]"
                />
                {location && (
                  <button aria-label="Clear location" onClick={() => setLocation("")} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="h-3 w-3" /></button>
                )}
              </div>
              {/* Date Range */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 pl-4 pr-4 h-10 text-slate-600 dark:text-slate-300 text-[12px] hover:bg-slate-50 dark:hover:bg-slate-800/80">
                    <CalendarIcon className="h-4 w-4" />
                    {dateRange?.from || dateRange?.to ? (
                      <span>
                        {dateRange?.from ? formatShortDate(dateRange.from.toISOString()) : '…'} – {dateRange?.to ? formatShortDate(dateRange.to.toISOString()) : '…'}
                      </span>
                    ) : (
                      <span>Date range</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-3 space-y-3 w-auto">
                  <Calendar
                    mode="range"
                    numberOfMonths={2}
                    selected={dateRange}
                    onSelect={setDateRange}
                    defaultMonth={dateRange?.from}
                    disabled={{ before: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) }}
                    className="rounded-lg border border-border/40 shadow-sm"
                  />
                  {dateRange?.from || dateRange?.to ? (
                    <div className="flex justify-between items-center text-[11px] pt-1">
                      <span className="text-slate-500 dark:text-slate-400">{dateRange?.from && dateRange?.to ? 'Range selected' : 'Partial range'}</span>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDateRange(undefined)}>Clear</Button>
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>
              {activeFilters > 0 && (
                <Button size="sm" variant="ghost" className="h-10 rounded-full text-[12px] px-4" onClick={clearAllFilters}>Clear all</Button>
              )}
            </div>
          )}

          {activeFilters > 0 && !showFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              {tag && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-slate-700 dark:text-slate-300">Tag: {tag}<button onClick={() => setTag('')} className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-100"><X className="h-3 w-3" /></button></span>
              )}
              {location && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-slate-700 dark:text-slate-300">Location: {location}<button onClick={() => setLocation('')} className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-100"><X className="h-3 w-3" /></button></span>
              )}
              {(dateRange?.from || dateRange?.to) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-slate-700 dark:text-slate-300">Date: {dateRange?.from ? formatShortDate(dateRange.from.toISOString()) : '…'} – {dateRange?.to ? formatShortDate(dateRange.to.toISOString()) : '…'}<button onClick={() => setDateRange(undefined)} className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-100"><X className="h-3 w-3" /></button></span>
              )}
              <button onClick={clearAllFilters} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline-offset-2 hover:underline ml-1">Clear all</button>
            </div>
          )}
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 py-6">
        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-md border border-red-200/60 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div>
        )}
        {/* No Results */}
        {!loading && filtered.length === 0 && (
          <div className="py-20 text-center text-sm text-slate-600 dark:text-slate-400">No opportunities match your query.</div>
        )}

        {/* Results List */}
        {loading ? (
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="py-5 animate-pulse space-y-3">
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm">
            <ul className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
              {pageItems.map((o) => (
                <li key={o.id} className="group relative py-4 first:pt-0 last:pb-0">
                  <div className="flex gap-5">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <h3 className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-100 group-hover:underline underline-offset-4">
                        {o.url ? (
                          <a href={o.url} target="_blank" rel="noreferrer" className="outline-none focus-visible:ring-2 ring-slate-300 dark:ring-slate-600 rounded-sm">
                            {o.title}
                          </a>
                        ) : (
                          o.title
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-normal text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{o.organization}</span>
                        {o.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{o.location}</span>}
                        {o.dateStart && <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{formatShortDate(o.dateStart)}</span>}
                      </div>
                      {o.tags && o.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {o.tags.slice(0, 6).map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {t}
                            </span>
                          ))}
                          {o.tags.length > 6 && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800 text-[11px] font-medium text-slate-500 dark:text-slate-400">+{o.tags.length - 6}</span>
                          )}
                        </div>
                      )}
                      {o.description && (
                        <p className="mt-1 line-clamp-2 leading-relaxed text-slate-600 dark:text-slate-400 text-[13px]">
                          {o.description}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-10 text-sm">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-8 px-3"
            >
              Previous
            </Button>
            <span className="text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-8 px-3"
            >
              Next
            </Button>
          </div>
        )}

        {/* Load More Alternate */}
        {page < totalPages && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={() => setPage(page + 1)}
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
            >
              Load More
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}