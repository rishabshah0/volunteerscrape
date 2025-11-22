"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Sparkles } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/20">
      <header className="px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="font-bold text-2xl tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6" />
          Acme Inc
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/search")} className="hover:bg-accent/50">
            Browse
          </Button>
          <Button variant="ghost" onClick={() => router.push("/scraper")} className="hover:bg-accent/50">
            Scraper
          </Button>
          <Button onClick={() => router.push("/login")}>
            Login
          </Button>
          <ThemeSwitcher />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-4xl w-full text-center space-y-12">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter leading-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
              Discover Your Next CSR Opportunity
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Find and filter meaningful opportunities to make a real impact in your community.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Input
                placeholder="Search by title, org, tag..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
                  }
                }}
                className="pl-11 pr-4 py-6 text-base rounded-xl border-2 focus:border-primary shadow-sm transition-all"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            </div>
            <Button
              onClick={() =>
                router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`)
              }
              className="px-8 py-6 rounded-xl text-base transition-all duration-300 hover:shadow-lg group"
            >
              Search
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left">
            <div className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
              <div className="text-3xl font-bold mb-2">1000+</div>
              <div className="text-sm text-muted-foreground">Active Opportunities</div>
            </div>
            <div className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
              <div className="text-3xl font-bold mb-2">200+</div>
              <div className="text-sm text-muted-foreground">Partner Organizations</div>
            </div>
            <div className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
              <div className="text-3xl font-bold mb-2">50+</div>
              <div className="text-sm text-muted-foreground">Cities Covered</div>
            </div>
          </div>
        </div>
      </main>
      <footer className="px-6 py-8 text-center text-sm text-muted-foreground border-t border-border">
        Demo UI • Built with Next.js + shadcn/ui
      </footer>
    </div>
  );
}