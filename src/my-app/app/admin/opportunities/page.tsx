"use client";
import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { MoreHorizontal, Plus, Pencil, RefreshCcw, Search, FolderPlus, X, List, Tag as TagIcon, Eye, Filter, Archive, Building2 } from "lucide-react";
import { toast } from "sonner";
import type { Opportunity } from "@/lib/types";
import { createOpportunity, deleteOpportunity, listOpportunities, updateOpportunity } from "@/lib/api";
import { OpportunityForm, type OpportunityFormValues } from "@/components/admin/opportunity-form";

export default function OpportunitiesPage() {
  // mounted state for hydration fix
  const [mounted, setMounted] = useState(false);

  // data state
  const [items, setItems] = useState<Opportunity[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // search (debounced)
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openAdd, setOpenAdd] = useState(false);
  const [editItem, setEditItem] = useState<Opportunity | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [filterOrg, setFilterOrg] = useState("");
  const [filterLocation, setFilterLocation] = useState("");

  // helper: relative time
  function timeAgo(iso?: string) {
    if (!iso) return "-";
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "-";

    // Return consistent formatted date for SSR/hydration
    if (!mounted) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    // Client-side only: calculate relative time
    const diff = Date.now() - date.getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return "just now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.floor(day / 7);
    if (wk < 4) return `${wk}w ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    const yr = Math.floor(day / 365);
    return `${yr}y ago`;
  }

  // helper: format time slot codes to full text
  function formatTimeSlot(slot?: string) {
    if (!slot) return null;
    // Map common codes to full day names
    const map: Record<string, string> = {
      "Su": "Sunday", "M": "Monday", "T": "Tuesday", "W": "Wednesday",
      "Th": "Thursday", "F": "Friday", "Sa": "Saturday",
      "Sun": "Sunday", "Mon": "Monday", "Tue": "Tuesday", "Wed": "Wednesday",
      "Thu": "Thursday", "Fri": "Friday", "Sat": "Saturday"
    };

    // Split by space/comma, map codes, join back
    return slot.split(/[\s,]+/)
      .map(part => map[part] || part)
      .join(", ");
  }

  // Mount effect for hydration fix
  useEffect(() => {
    setMounted(true);
  }, []);

  // debounce search + filters combined
  useEffect(() => {
    const handle = setTimeout(() => {
      setPage(1);
      const parts = [search.trim(), tagFilter, filterOrg ? `org:${filterOrg}` : "", filterLocation ? `loc:${filterLocation}` : ""].filter(Boolean);
      setQ(parts.join(" "));
    }, 400);
    return () => clearTimeout(handle);
  }, [search, tagFilter, filterOrg, filterLocation]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await listOpportunities({ page, pageSize, q });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleCreate(values: OpportunityFormValues) {
    try {
      const payload: Partial<Opportunity> = {
        ...values,
        tags: values.tags ? values.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      };
      await createOpportunity(payload);
      toast.success("Opportunity added");
      setOpenAdd(false);
      setPage(1);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add";
      toast.error(msg);
    }
  }

  async function handleUpdate(values: OpportunityFormValues) {
    if (!editItem) return;
    try {
      const payload: Partial<Opportunity> = {
        ...values,
        tags: values.tags ? values.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      };
      await updateOpportunity(editItem.id, payload);
      toast.success("Opportunity updated");
      setEditItem(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast.error(msg);
    }
  }


  async function handleDelete(id: string) {
    if (!window.confirm("Delete this opportunity? This cannot be undone.")) return;
    try {
      await deleteOpportunity(id);
      toast.success("Opportunity deleted");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast.error(msg);
    }
  }

  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, i) => (
    <TableRow key={i}>
      <TableCell className="p-4"><Skeleton className="h-4 w-48" /></TableCell>
      <TableCell className="p-4"><Skeleton className="h-4 w-40" /></TableCell>
      <TableCell className="p-4 flex gap-1"><Skeleton className="h-5 w-12" /><Skeleton className="h-5 w-10" /><Skeleton className="h-5 w-8" /></TableCell>
      <TableCell className="p-4"><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell className="p-4"><Skeleton className="h-4 w-12" /></TableCell>
      <TableCell className="p-4 text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
    </TableRow>
  )), []);

  const topTags = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach(o => (o.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);
  }, [items]);

  const uniqueOrgs = useMemo(() => new Set(items.map(i => i.organization)).size, [items]);
  const avgTags = useMemo(() => (items.length ? (items.reduce((s, i) => s + (i.tags?.length || 0), 0) / items.length) : 0).toFixed(1), [items]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Opportunities</h1>
            <p className="text-sm text-muted-foreground">Manage and curate volunteer opportunities.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
              <RefreshCcw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
            <Button onClick={() => setOpenAdd(true)} size="sm">
              <Plus className="mr-1.5 size-3.5" />
              Add
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative p-4 shadow-sm border-muted/30">
            <div className="absolute right-3 top-3 text-muted-foreground/40"><List className="size-5" /></div>
            <div className="text-2xl font-semibold tracking-tight">{total}</div>
            <div className="text-sm text-muted-foreground mt-1">Total</div>
          </Card>
          <Card className="relative p-4 shadow-sm border-muted/30">
            <div className="absolute right-3 top-3 text-muted-foreground/40"><Eye className="size-5" /></div>
            <div className="text-2xl font-semibold tracking-tight">{items.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Showing (page)</div>
          </Card>
          <Card className="relative p-4 shadow-sm border-muted/30">
            <div className="absolute right-3 top-3 text-muted-foreground/40"><Building2 className="size-5" /></div>
            <div className="text-2xl font-semibold tracking-tight">{uniqueOrgs}</div>
            <div className="text-sm text-muted-foreground mt-1">Organizations (page)</div>
          </Card>
          <Card className="relative p-4 shadow-sm border-muted/30">
            <div className="absolute right-3 top-3 text-muted-foreground/40"><TagIcon className="size-5" /></div>
            <div className="text-2xl font-semibold tracking-tight">{avgTags}</div>
            <div className="text-sm text-muted-foreground mt-1">Avg Tags (page)</div>
          </Card>
        </div>

        {/* Filters & Search */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4 w-full">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title, tag, org..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-8"
                />
                {search && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              {/* Filter dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-fit"><Filter className="size-4 mr-2" /> Filter</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64 p-3 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Organization</label>
                    <Input placeholder="Contains..." value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)} className="h-8" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Location</label>
                    <Input placeholder="Contains..." value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="h-8" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" className="h-8 px-3" onClick={() => { setFilterOrg(""); setFilterLocation(""); }}>Reset</Button>
                    <Button type="button" size="sm" className="h-8 px-3" onClick={() => {/* debounce handles auto apply */}}>Apply</Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Filters are combined into the search query (org: / loc:)</p>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {topTags.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground">Quick tags:</span>
              {topTags.map(t => {
                const active = tagFilter === t;
                return (
                  <Badge
                    key={t}
                    variant={active ? "secondary" : "outline"}
                    onClick={() => setTagFilter(active ? "" : t)}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTagFilter(active ? "" : t); } }}
                    className={`cursor-pointer select-none ${active ? 'ring-1 ring-border' : ''}`}
                  >
                    {t}
                  </Badge>
                );
              })}
              {tagFilter && (
                <Badge
                  variant="outline"
                  onClick={() => setTagFilter("")}
                  className="cursor-pointer select-none"
                >Clear</Badge>
              )}
            </div>
          )}
        </div>

        {error && <div className="text-sm text-destructive bg-destructive/10 border border-destructive/40 rounded-md px-3 py-2 w-fit">{error}</div>}

        <Card className="overflow-hidden border-muted/40">
          <CardContent className="p-0">
            <div className="relative overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="p-4 min-w-[200px] max-w-[300px]">Title</TableHead>
                    <TableHead className="p-4 min-w-[150px] max-w-[200px]">Organization</TableHead>
                    <TableHead className="p-4 min-w-[150px]">Tags</TableHead>
                    <TableHead className="p-4 min-w-[120px] max-w-[180px]">Location</TableHead>
                    <TableHead className="p-4 w-[110px]">Updated</TableHead>
                    <TableHead className="p-4 w-[70px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    skeletonRows
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                          <div className="rounded-full bg-muted p-4 text-muted-foreground">
                            <FolderPlus className="size-6" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium">No opportunities</p>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">Get started by creating a new Volunteer opportunity or adjust your search.</p>
                          </div>
                          <Button size="sm" onClick={() => setOpenAdd(true)}>
                            <Plus className="size-4 mr-2" /> New Opportunity
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((o) => {
                      const extraTags = (o.tags?.length || 0) - 3;
                      const firstTags = o.tags?.slice(0, 3) || [];
                      const updatedRecently = (() => { try { return Date.now() - new Date(o.updatedAt).getTime() < 24 * 60 * 60 * 1000; } catch { return false; } })();
                      const fullTimestamp = (() => { try { return new Date(o.updatedAt).toLocaleString(); } catch { return o.updatedAt; } })();
                      return (
                        <TableRow key={o.id} className="hover:bg-muted/50 transition-colors animate-[fadeIn_0.25s_ease-out]">
                          <TableCell className="p-4 font-medium">
                            <div className="flex flex-col max-w-[300px]" title={o.description || o.title}>
                              <span className="truncate font-medium leading-snug">{o.title}</span>
                              {o.timeSlot && (
                                <span className="text-xs text-muted-foreground truncate">{formatTimeSlot(o.timeSlot)}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="p-4">
                            <span className="truncate block max-w-[200px]">{o.organization}</span>
                          </TableCell>
                          <TableCell className="p-4 space-x-1">
                            {firstTags.map((t) => (
                              <Badge key={t} variant="secondary" className="align-middle">{t}</Badge>
                            ))}
                            {extraTags > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="cursor-help">+{extraTags}</Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="text-xs leading-relaxed">{o.tags?.slice(3).join(", ")}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TableCell>
                          <TableCell className="p-4">
                            <span className="truncate block max-w-[180px]" title={o.location || undefined}>
                              {o.location || <span className="text-muted-foreground">—</span>}
                            </span>
                          </TableCell>
                          <TableCell className="p-4">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`text-xs whitespace-nowrap px-1 py-0.5 rounded ${updatedRecently ? 'bg-accent/40 font-medium' : 'text-muted-foreground'}`}>{timeAgo(o.updatedAt)}</div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">{fullTimestamp}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="p-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => toast.message("Details", { description: o.description || 'No description.' })} className="gap-2"><Eye className="size-4" /> View Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setEditItem(o)} className="gap-2"><Pencil className="size-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(o.id)} className="gap-2 text-destructive"><Archive className="size-4" /> Archive</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex-1 flex justify-center">
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
        </div>

        {/* Dialogs */}
        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Opportunity</DialogTitle>
            </DialogHeader>
            <OpportunityForm onSubmit={handleCreate} />
          </DialogContent>
        </Dialog>

        <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Opportunity</DialogTitle>
            </DialogHeader>
            {editItem && (
              <OpportunityForm
                initial={{
                  title: editItem.title,
                  organization: editItem.organization,
                  tags: editItem.tags?.join(", ") || "",
                  location: editItem.location,
                  url: editItem.url,
                  description: editItem.description,
                  timeSlot: editItem.timeSlot,
                }}
                onSubmit={handleUpdate}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
