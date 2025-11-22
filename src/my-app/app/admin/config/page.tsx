"use client";
import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listSiteConfigs, saveConfig, deleteSiteConfig } from "@/lib/api";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, RefreshCcw, Database, Settings, Globe } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SiteConfig = {
  domain: string;
  crawler: string;
  include: string;
  exclude: string;
  updatedAt: string;
};

export default function ConfigManagementPage() {
  const [configs, setConfigs] = useState<SiteConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [editConfig, setEditConfig] = useState<SiteConfig | null>(null);
  const [addMode, setAddMode] = useState(false);

  const [domain, setDomain] = useState("");
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await listSiteConfigs();
      setConfigs(res.configs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load configs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setDomain("");
    setInclude("");
    setExclude("");
    setAddMode(true);
  }

  function openEdit(config: SiteConfig) {
    setDomain(config.domain);
    setInclude(config.include);
    setExclude(config.exclude);
    setEditConfig(config);
  }

  function closeDialog() {
    setAddMode(false);
    setEditConfig(null);
    setDomain("");
    setInclude("");
    setExclude("");
  }

  async function handleSave() {
    if (!domain.trim() || !include.trim()) {
      toast.error("Domain and Include selector are required");
      return;
    }
    try {
      await saveConfig(domain.trim(), include.trim(), exclude.trim());
      toast.success(`Config ${editConfig ? "updated" : "created"} for ${domain}`);
      closeDialog();
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function handleDelete(configDomain: string) {
    if (!window.confirm(`Delete config for ${configDomain}?`)) return;
    try {
      await deleteSiteConfig(configDomain);
      toast.success(`Deleted config for ${configDomain}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const jsCount = useMemo(() => configs.filter(c => c.crawler === 'js').length, [configs]);
  const getCount = useMemo(() => configs.filter(c => c.crawler === 'get').length, [configs]);

  const skeletonRows = useMemo(() => Array.from({ length: 5 }, (_, i) => (
    <TableRow key={i}>
      <TableCell className="p-4"><Skeleton className="h-4 w-40" /></TableCell>
      <TableCell className="p-4"><Skeleton className="h-5 w-16" /></TableCell>
      <TableCell className="p-4"><Skeleton className="h-4 w-32" /></TableCell>
      <TableCell className="p-4"><Skeleton className="h-4 w-24" /></TableCell>
      <TableCell className="p-4"><Skeleton className="h-4 w-28" /></TableCell>
      <TableCell className="p-4"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
    </TableRow>
  )), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
          <p className="text-sm text-muted-foreground">Manage scraper configs for each domain.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCcw className="size-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4 mr-2" />
            Add Config
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Settings className="size-4" /> JS Crawler</CardTitle><CardDescription>Configs using JS engine</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{jsCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="size-4" /> GET Crawler</CardTitle><CardDescription>Configs using GET fetch</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{getCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="size-4" /> Domains</CardTitle><CardDescription>Total configured domains</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{configs.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><RefreshCcw className="size-4" /> Last Refresh</CardTitle><CardDescription>Manual refresh used</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{loading?"…":"Now"}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="p-4">Domain</TableHead>
                  <TableHead className="p-4">Crawler</TableHead>
                  <TableHead className="p-4">Include</TableHead>
                  <TableHead className="p-4">Exclude</TableHead>
                  <TableHead className="p-4">Updated</TableHead>
                  <TableHead className="p-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? skeletonRows : configs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      No configurations found. Click "Add Config" to create one.
                    </TableCell>
                  </TableRow>
                ) : configs.map(c => (
                  <TableRow key={c.domain} className="hover:bg-muted/30 border-b last:border-0">
                    <TableCell className="p-4 font-medium">{c.domain}</TableCell>
                    <TableCell className="p-4"><Badge variant={c.crawler==='js'? 'secondary':'outline'} className="text-xs">{c.crawler.toUpperCase()}</Badge></TableCell>
                    <TableCell className="p-4 truncate max-w-[160px]" title={c.include}>{c.include}</TableCell>
                    <TableCell className="p-4 truncate max-w-[140px]" title={c.exclude}>{c.exclude || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="p-4 text-xs text-muted-foreground">{new Date(c.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="h-8 w-8 p-0">
                          <Pencil className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(c.domain)} className="h-8 w-8 p-0">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addMode || !!editConfig} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editConfig ? "Edit Config" : "Add Config"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-3 mt-2">
            <div className="sm:col-span-1 space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" value={domain} onChange={e=>setDomain(e.target.value)} placeholder="example.org" />
            </div>
            <div className="sm:col-span-1 space-y-2">
              <Label htmlFor="include">Include Selectors</Label>
              <Input id="include" value={include} onChange={e=>setInclude(e.target.value)} placeholder="#main" />
            </div>
            <div className="sm:col-span-1 space-y-2">
              <Label htmlFor="exclude">Exclude Selectors</Label>
              <Input id="exclude" value={exclude} onChange={e=>setExclude(e.target.value)} placeholder="nav, footer" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSave}>{editConfig?"Update":"Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
