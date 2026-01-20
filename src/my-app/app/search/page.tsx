"use client";
import { useEffect, useMemo, useState } from "react";
import Fuse from "fuse.js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { listOpportunities } from "@/lib/api";
import type { Opportunity } from "@/lib/types";
import { Search, CalendarIcon, MapPin, Building2, Filter, X, ChevronDown, ArrowRight, SlidersHorizontal, Sparkles, LayoutGrid, List } from "lucide-react";
import { DateRange } from "react-day-picker";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function SearchPage() {
  const router = useRouter();
  const [rawItems, setRawItems] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("all");
  const [location, setLocation] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // View Mode
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

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
    if (tag && tag !== "all") {
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

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  };

  // Format time slot codes to full day names
  const formatTimeSlot = (slot?: string) => {
    if (!slot) return null;
    const map: Record<string, string> = {
      "Su": "Sunday", "M": "Monday", "T": "Tuesday", "W": "Wednesday",
      "Th": "Thursday", "F": "Friday", "Sa": "Saturday",
      "Sun": "Sunday", "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday",
      "Thu": "Thursday", "Fri": "Friday", "Sat": "Saturday"
    };
    return slot.split(/[\s,]+/)
      .map(part => map[part] || part)
      .join(", ");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline-block">Acme Inc</span>
          </div>

          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search opportunities..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 flex-1 flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filters */}
        <aside className="w-full lg:w-64 space-y-8 shrink-0">
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filters
            </h3>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Cause</label>
                <Select value={tag} onValueChange={setTag}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Causes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Causes</SelectItem>
                    {['environment', 'food security', 'education', 'community', 'healthcare', 'animal welfare', 'disaster relief', 'homeless support', 'advocacy'].map(opt => (
                      <SelectItem key={opt} value={opt} className="capitalize">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City or Region"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Date Range</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{formatShortDate(dateRange.from.toISOString())} - {formatShortDate(dateRange.to.toISOString())}</>
                        ) : (
                          formatShortDate(dateRange.from.toISOString())
                        )
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {(tag !== 'all' || location || dateRange) && (
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setTag("all");
                    setLocation("");
                    setDateRange(undefined);
                  }}
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight">Opportunities</h2>
            <div className="flex items-center gap-2 border rounded-lg p-1 bg-muted/30">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive mb-6">
              Error: {error}
            </div>
          )}

          {loading ? (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl border bg-card animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No opportunities found</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
              {pageItems.map((item) => (
                <Card key={item.id} className={`group transition-all hover:border-primary/50 ${viewMode === 'list' ? 'flex flex-col sm:flex-row' : 'flex flex-col'}`}>
                  <CardHeader className={`${viewMode === 'list' ? 'flex-1 p-6' : 'p-6'}`}>
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <Badge variant="outline" className="rounded-md font-normal">
                        {item.activityType || "Volunteer"}
                      </Badge>
                      {item.dateStart && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {formatShortDate(item.dateStart)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-xl leading-tight group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <Building2 className="h-4 w-4" />
                        <span>{item.organization}</span>
                      </div>
                      {item.timeSlot && (
                        <div className="text-xs text-muted-foreground">
                          {formatTimeSlot(item.timeSlot)}
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className={`${viewMode === 'list' ? 'flex-1 p-6 pt-0 sm:pt-6 sm:border-l border-border/50' : 'p-6 pt-0 flex-1'}`}>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {item.tags?.slice(0, 3).map(t => (
                        <Badge key={t} variant="secondary" className="font-normal text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {item.location || "Remote"}
                      </div>
                      {item.url && (
                        <Button size="sm" variant="ghost" className="h-8 gap-1 hover:text-primary" asChild>
                          <a href={item.url} target="_blank" rel="noreferrer">
                            View Details <ArrowRight className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}