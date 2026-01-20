"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { scrapeAndSave } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Opportunity } from "@/lib/types";

export default function ScraperPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [model, setModel] = useState<"gemini" | "gpt">("gemini");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Opportunity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScrape = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await scrapeAndSave(url, model);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scrape");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Opportunity</h1>
            <p className="text-muted-foreground">Scrape and add a new Volunteer opportunity from a URL.</p>
          </div>
        </div>

        <Card className="border-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Scraper
            </CardTitle>
            <CardDescription>
              Enter a URL and let our AI extract the details automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="url">Opportunity URL</Label>
              <div className="flex gap-2">
                <Input
                  id="url"
                  placeholder="https://example.com/volunteer-opportunity"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={model} onValueChange={(v: "gemini" | "gpt") => setModel(v)} disabled={loading}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Gemini (Fast)</SelectItem>
                  <SelectItem value="gpt">GPT-4 (Precise)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="justify-end border-t bg-muted/10 px-6 py-4">
            <Button onClick={handleScrape} disabled={loading || !url} size="lg">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                "Scrape & Save"
              )}
            </Button>
          </CardFooter>
        </Card>

        {result && (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-semibold">Successfully Saved!</span>
              </div>
              <CardTitle>{result.title}</CardTitle>
              <CardDescription>{result.organization}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Location:</span>{" "}
                  {result.location || "N/A"}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Date:</span>{" "}
                  {result.dateStart ? new Date(result.dateStart).toLocaleDateString() : "N/A"}
                </div>
                <div className="col-span-full">
                  <span className="font-medium text-muted-foreground">Tags:</span>{" "}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.tags?.map((tag) => (
                      <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-background border">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="col-span-full">
                   <span className="font-medium text-muted-foreground">Description:</span>
                   <p className="mt-1 text-muted-foreground line-clamp-3">{result.description}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" onClick={() => window.open(result.url, "_blank")}>
                View Source
              </Button>
              <Button onClick={() => router.push("/search")}>
                View All Opportunities
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
