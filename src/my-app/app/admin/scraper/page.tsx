"use client";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateConfigFromUrl, scrapeAndSave, saveConfig } from "@/lib/api";
import { toast } from "sonner";
import * as DMP from "diff-match-patch";
import Link from "next/link";
import { Sparkles, Wrench } from "lucide-react";

export default function AdminScraperPage() {
  const [url, setUrl] = useState("");
  const [model, setModel] = useState<"gemini" | "gpt">("gemini");
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [clean, setClean] = useState("");
  const [rawHtml, setRawHtml] = useState("");
  const [loadingGen, setLoadingGen] = useState(false);
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [activeView, setActiveView] = useState<"generate" | "scrape">("generate");

  const domain = (() => {
    try {
      if (!url.trim()) return "";
      return new URL(url.trim()).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  const diffHtml = useMemo(() => {
    if (!rawHtml || !clean) return "";
    const dmp = new DMP.diff_match_patch();
    const diffs = dmp.diff_main(rawHtml, clean);
    dmp.diff_cleanupSemantic(diffs);
    return dmp.diff_prettyHtml(diffs);
  }, [rawHtml, clean]);

  async function handleGenerate() {
    if (!url.trim()) return;
    try {
      setLoadingGen(true);
      const res = await generateConfigFromUrl(url.trim());
      setInclude(res.selectors.include || "");
      setExclude(res.selectors.exclude || "");
      setClean(res.cleaned_text || "");
      setRawHtml(res.raw_text || "");
      toast.success("Selectors generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setLoadingGen(false);
    }
  }

  async function handleScrape() {
    if (!url.trim()) return;
    try {
      setLoadingScrape(true);
      const opp = await scrapeAndSave(url.trim(), model);
      toast.success(
        <div className="flex items-center gap-2">
          <span>Saved: {opp.title}</span>
          <Link href="/admin/opportunities">
            <Button size="sm" variant="ghost">View</Button>
          </Link>
        </div>
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setLoadingScrape(false);
    }
  }

  async function handleSaveConfig() {
    if (!domain) {
      toast.error("Invalid URL for domain extraction");
      return;
    }
    if (!include.trim()) {
      toast.error("Include selector required");
      return;
    }
    try {
      setSavingCfg(true);
      const res = await saveConfig(domain, include.trim(), exclude.trim());
      toast.success(`Config saved for ${res.domain}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingCfg(false);
    }
  }

  function handleClear() {
    setInclude("");
    setExclude("");
    setClean("");
    setRawHtml("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Scraper Studio</h1>
        <p className="text-muted-foreground">Tools for generating selectors and scraping opportunities.</p>
      </div>

      {/* View Switcher */}
      <Tabs value={activeView} onValueChange={(v)=>setActiveView(v as "generate"|"scrape")} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="generate">
            <Wrench className="size-4 mr-2" />
            Generate Selectors
          </TabsTrigger>
          <TabsTrigger value="scrape">
            <Sparkles className="size-4 mr-2" />
            Scrape with LLM
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeView === "generate" ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate & Diff</CardTitle>
            <CardDescription>Generate selectors then view a semantic diff between raw and cleaned content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {/* URL and Model on the same row */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-9 space-y-2">
                  <Label htmlFor="url-gen">URL</Label>
                  <Input id="url-gen" placeholder="https://example.org/opportunity" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div className="col-span-3 space-y-2">
                  <Label>Model</Label>
                  <Tabs value={model} onValueChange={(value) => setModel(value as "gemini" | "gpt")}>
                    <TabsList className="grid w-full grid-cols-2 h-9">
                      <TabsTrigger value="gemini" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Gemini</TabsTrigger>
                      <TabsTrigger value="gpt" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">GPT</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              {/* Include on its own line */}
              <div className="space-y-2">
                <Label htmlFor="include">Include</Label>
                <Input id="include" value={include} onChange={(e) => setInclude(e.target.value)} placeholder="#main" />
              </div>
              {/* Exclude on its own line */}
              <div className="space-y-2">
                <Label htmlFor="exclude">Exclude</Label>
                <Input id="exclude" value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="nav" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} disabled={!url || loadingGen} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {loadingGen ? "Generating..." : "Generate"}
              </Button>
              <Button variant="ghost" onClick={handleGenerate} disabled={!url || loadingGen} className="border border-transparent hover:border-border">
                Regenerate
              </Button>
              <Button variant="ghost" onClick={handleSaveConfig} disabled={!include || savingCfg} className="border border-transparent hover:border-border">
                {savingCfg ? "Saving..." : "Save Config"}
              </Button>
              <Button variant="ghost" onClick={handleClear} disabled={!include && !exclude && !clean} className="border border-transparent hover:border-border">
                Clear
              </Button>
            </div>
            <Separator />
            <div className="rounded-md border bg-card">
              <div className="flex items-center justify-between px-4 py-2 border-b">
                <div className="text-sm font-medium">Preview</div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 bg-red-500/20 border border-red-500/40 rounded-sm" /> Removed</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 bg-green-500/20 border border-green-500/30 rounded-sm" /> Added</span>
                </div>
              </div>
              <div className="p-4 max-h-[460px] overflow-auto bg-muted/30">
                <div className="text-sm font-mono leading-relaxed [&_del]:bg-red-500/20 [&_del]:text-red-900 [&_del]:dark:text-red-200 [&_ins]:bg-green-500/20 [&_ins]:text-green-900 [&_ins]:dark:text-green-200 [&_ins]:no-underline"
                     dangerouslySetInnerHTML={{ __html: diffHtml || "<p class='text-muted-foreground'>Generate selectors to see a diff.</p>" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Scrape & Save</CardTitle>
            <CardDescription>Send the page through the extractor and save an Opportunity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="url-scrape">URL</Label>
                <Input id="url-scrape" placeholder="https://example.org/opportunity" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Tabs value={model} onValueChange={(value) => setModel(value as "gemini" | "gpt")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="gemini" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Gemini</TabsTrigger>
                    <TabsTrigger value="gpt" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">GPT</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleScrape} disabled={!url || loadingScrape} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {loadingScrape ? "Scraping..." : "Scrape & Save"}
              </Button>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              Saved items appear in <Badge variant="secondary" className="hover:bg-secondary/80"><Link href="/admin/opportunities">Admin → Opportunities</Link></Badge>.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
