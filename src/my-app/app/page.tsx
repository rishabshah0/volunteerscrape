"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react"; // Assuming lucide-react is installed for icons

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between bg-background/80 backdrop-blur-md shadow-sm sticky top-0 z-10">
        <div className="font-bold text-2xl tracking-tight">Acme Inc</div>
        <div className="space-x-4">
          <Button variant="ghost" onClick={() => router.push("/search")} className="hover:bg-accent/50">
            Browse
          </Button>
          <Button onClick={() => router.push("/login")}>
              Login
          </Button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl w-full text-center space-y-10">
          <h1 className="text-5xl md:text-5xl font-extrabold tracking-tighter leading-tight">
            Discover Your Next CSR Opportunity
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find and filter meaningful opportunities to make a real impact in your community.
          </p>
          <div className="flex gap-3 max-w-lg mx-auto">
            <div className="relative flex-1">
              <Input
                placeholder="Search by title, org, tag..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-10 pr-4 py-6 text-base rounded-full border-2 border-border focus:border-accent shadow-sm"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            </div>
            <Button
              onClick={() =>
                router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`)
              }
              className="px-8 py-6 rounded-full transition-all duration-300 hover:shadow-md"
            >
              Search
            </Button>
          </div>
        </div>
      </main>
      <footer className="px-6 py-8 text-center text-sm text-muted-foreground border-t border-border">
        Demo UI • Built with Next.js + shadcn/ui
      </footer>
    </div>
  );
}