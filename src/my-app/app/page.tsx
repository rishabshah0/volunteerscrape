"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ArrowRight, Sparkles, Globe, Users, MapPin } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden selection:bg-primary/10 selection:text-primary">
      {/* Background Pattern */}
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
      </div>

      <header className="px-6 h-16 flex items-center justify-between border-b border-border/40 bg-background/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="font-bold text-xl tracking-tight flex items-center gap-2.5 cursor-pointer" onClick={() => router.push("/")}>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span>Acme Inc</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block" />
          <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
            Log in
          </Button>
          <Button size="sm" onClick={() => router.push("/register")}>
            Sign up
          </Button>
          <ThemeSwitcher />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-20 sm:py-32 relative">
        <div className="max-w-4xl w-full text-center space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">

          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
              Over 1,000+ active opportunities added this week
            </div>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tighter leading-[1.1]">
              Make a Difference <br className="hidden sm:block" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/50">
                Where It Matters
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Connect with world-changing organizations. Find opportunities that match your skills and passion for social impact.
            </p>
          </div>

          <div className="max-w-2xl mx-auto w-full relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative flex items-center bg-background rounded-xl border border-border/50 shadow-lg shadow-primary/5 p-2 transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50">
              <Search className="ml-4 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by cause, location, or organization..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
                  }
                }}
                className="flex-1 border-none shadow-none focus-visible:ring-0 bg-transparent h-12 text-base px-4 placeholder:text-muted-foreground/70"
              />
              <Button
                onClick={() =>
                  router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`)
                }
                size="lg"
                className="rounded-lg h-12 px-8 text-base font-medium shadow-md hover:shadow-lg transition-all"
              >
                Search
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 max-w-3xl mx-auto">
            {[
              { label: "Active Opportunities", value: "2,500+", icon: Globe },
              { label: "Non-Profits", value: "450+", icon: Users },
              { label: "Cities", value: "120+", icon: MapPin },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-6 rounded-2xl bg-muted/30 border border-border/50 backdrop-blur-sm hover:bg-muted/50 transition-colors">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                <div className="text-sm text-muted-foreground font-medium mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

        </div>
      </main>

      <footer className="py-8 text-center text-sm text-muted-foreground/60">
        <p>© 2024 Volunteer Connect. Built for impact.</p>
      </footer>
    </div>
  );
}