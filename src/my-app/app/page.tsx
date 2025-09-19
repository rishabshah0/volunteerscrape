"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="font-semibold">@my-app</div>
        <div className="space-x-2">
          <Button variant="ghost" onClick={() => router.push("/search")}>
            Browse
          </Button>
          <Button onClick={() => router.push("/login")}>Admin Login</Button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold">
            Find volunteering opportunities
          </h1>
          <p className="text-muted-foreground">
            Search and filter opportunities by tags, location, and more.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Search by title, org, tag..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button
              onClick={() =>
                router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`)
              }
            >
              Search
            </Button>
          </div>
        </div>
      </main>
      <footer className="px-6 py-8 text-center text-sm text-muted-foreground">
        Demo UI • Built with Next.js + shadcn/ui
      </footer>
    </div>
  );
}
