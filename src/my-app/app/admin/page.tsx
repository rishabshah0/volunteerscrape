"use client";

import React, { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Line,
  PieChart,
  Pie,
  Cell,
  LineChart,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

/*************************
 * Type Definitions
 *************************/
interface KpiMetric {
  id: string;
  label: string;
  value: number | string;
  delta?: string;
  deltaVariant?: "positive" | "negative" | "neutral" | "warning"; // retained for semantic meaning, but rendered monochrome
  assistive?: string;
  badgeVariant?: "destructive" | "outline" | "default" | "secondary";
  urgent?: boolean;
}

interface SupplyDemandPoint {
  day: string;
  newOpportunities: number;
  remoteKeywordVolume: number;
}

interface StatusDistributionSlice { name: string; value: number; color: string }

interface TriageItem {
  id: string;
  label: string;
  value: string | number;
  actionLabel?: string;
  actionType?: "link" | "button";
  severity?: "normal" | "warning" | "critical";
  tags?: string[];
}

/*************************
 * Mock Data
 *************************/
const kpis: KpiMetric[] = [
  {
    id: "active_unfilled",
    label: "Active & Unfilled Opportunities",
    value: 128,
    delta: "-5 from yesterday",
    deltaVariant: "negative",
  },
  {
    id: "new_orgs",
    label: "New & Vetted Organizations",
    value: 3,
    assistive: "Goal: 5",
    deltaVariant: "neutral",
  },
  {
    id: "signups",
    label: "Volunteer Sign-Ups (Last 7 Days)",
    value: 57,
    delta: "+12% vs. prev. week",
    deltaVariant: "positive",
  },
  {
    id: "awaiting_review",
    label: "Opportunities Awaiting Review",
    value: 7,
    deltaVariant: "warning",
    urgent: true,
  },
];

const supplyDemandData: SupplyDemandPoint[] = [
  { day: "Mon", newOpportunities: 14, remoteKeywordVolume: 54 },
  { day: "Tue", newOpportunities: 18, remoteKeywordVolume: 60 },
  { day: "Wed", newOpportunities: 26, remoteKeywordVolume: 92 }, // spike
  { day: "Thu", newOpportunities: 22, remoteKeywordVolume: 88 },
  { day: "Fri", newOpportunities: 19, remoteKeywordVolume: 66 },
  { day: "Sat", newOpportunities: 11, remoteKeywordVolume: 40 },
  { day: "Sun", newOpportunities: 9, remoteKeywordVolume: 38 },
];

// Replace regionDistribution colors & concept with status distribution (non-location, actionable)
const statusDistribution: StatusDistributionSlice[] = [
  { name: "Active", value: 128, color: "#111111" },
  { name: "Awaiting Review", value: 7, color: "#404040" },
  { name: "Expiring <7d", value: 14, color: "#737373" },
  { name: "Filled", value: 45, color: "#a3a3a3" },
  { name: "Draft", value: 9, color: "#d4d4d4" },
];

const triageItems: TriageItem[] = [
  {
    id: "expired",
    label: "Opportunities Flagged as Expired/Inactive",
    value: 12,
    actionLabel: "View / Clear",
    actionType: "button",
    severity: "warning",
  },
  {
    id: "vetting",
    label: "New Organizations Awaiting Vetting",
    value: 3,
    actionLabel: "Review",
    actionType: "link",
    severity: "critical",
  },
  {
    id: "missing_tags",
    label: "Top 3 Missing Tags",
    value: "",
    tags: ["Accessibility", "Evening Shift", "Youth-friendly"],
    severity: "normal",
  },
  {
    id: "support_tickets",
    label: "Users with Open Support Tickets",
    value: 2,
    actionLabel: "View Tickets",
    actionType: "button",
    severity: "normal",
  },
];

/*************************
 * Helper Components (updated for monochrome)
 *************************/
const DeltaText: React.FC<{ metric: KpiMetric }> = ({ metric }) => {
  if (metric.urgent) {
    return <span className="mt-1 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">URGENT</span>;
  }
  const base = "mt-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground";
  if (metric.delta) {
    if (metric.deltaVariant === "positive") {
      return (
        <div className={base}>
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          {metric.delta}
        </div>
      );
    }
    if (metric.deltaVariant === "negative") {
      return (
        <div className={base}>
          <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
          {metric.delta}
        </div>
      );
    }
    return <div className={base}>{metric.delta}</div>;
  }
  if (metric.assistive) return <div className={base}>{metric.assistive}</div>;
  return null;
};

const KpiCard: React.FC<{ metric: KpiMetric }> = ({ metric }) => (
  <Card className="relative overflow-hidden">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium leading-tight">
        {metric.label}
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      <div className="text-3xl font-semibold tracking-tight">
        {metric.value}
      </div>
      <DeltaText metric={metric} />
      {metric.assistive && !metric.delta && !metric.urgent && (
        <div className="mt-1 text-xs text-muted-foreground">{metric.assistive}</div>
      )}
    </CardContent>
  </Card>
);

interface CombinedTooltipPayload {
  payload?: any;
  label?: string;
  active?: boolean;
}

const CombinedChartTooltip: React.FC<CombinedTooltipPayload> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const newOps = payload.find((p: any) => p.dataKey === "newOpportunities");
  const remote = payload.find((p: any) => p.dataKey === "remoteKeywordVolume");
  const prevRemote = payload.find((p: any) => p.dataKey === "prevRemoteKeywordVolume");
  return (
    <div className="rounded border bg-background/95 px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium">{label}</div>
      {newOps && (
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-neutral-900" />New Ops: <span className="font-semibold tabular-nums">{newOps.value}</span></div>
      )}
      {remote && (
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-neutral-500" />Remote KW: <span className="font-semibold tabular-nums">{remote.value}</span></div>
      )}
      {prevRemote && (
        <div className="flex items-center gap-2 opacity-80"><span className="size-2 rounded-full bg-neutral-300" />Prev Week: <span className="font-semibold tabular-nums">{prevRemote.value}</span></div>
      )}
    </div>
  );
};

/*************************
 * Redesigned Triage List (monochrome, prioritized)
 *************************/
interface PrioritizedItem extends TriageItem { priority: number }

const severityOrder: Record<string, number> = { critical: 1, warning: 2, normal: 3 };

function buildPrioritized(items: TriageItem[]): PrioritizedItem[] {
  return items
    .map(i => ({ ...i, priority: severityOrder[i.severity || "normal"] || 99 }))
    .sort((a, b) => a.priority - b.priority);
}

const SeverityBadge: React.FC<{ severity?: string }> = ({ severity }) => {
  if (!severity) return null;
  const textMap: Record<string, string> = { critical: "Critical", warning: "Attention", normal: "Info" };
  return (
    <span className={cn(
      "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-background",
      severity === "critical" && "border-neutral-900 font-semibold",
      severity === "warning" && "border-neutral-500",
      severity === "normal" && "border-neutral-300"
    )}>
      {textMap[severity] || severity}
    </span>
  );
};

const TriageList: React.FC<{ items: TriageItem[] }> = ({ items }) => {
  const prioritized = buildPrioritized(items);
  return (
    <ol className="divide-y border rounded-md">
      {prioritized.map(item => (
        <li
          key={item.id}
          className={cn(
            "flex flex-col gap-2 p-4 md:flex-row md:items-center md:gap-6",
            item.severity === "critical" && "bg-neutral-50 dark:bg-neutral-900/40"
          )}
        >
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={item.severity} />
              <p className="font-medium leading-none tracking-tight">{item.label}</p>
              {typeof item.value === "number" && (
                <span className="ml-1 inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono font-semibold tabular-nums">{item.value}</span>
              )}
            </div>
            {item.tags && item.tags.length > 0 && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                Missing tags: {item.tags.join(", ")}
              </p>
            )}
            {!item.tags && typeof item.value !== "number" && item.value && (
              <p className="text-xs text-muted-foreground">{item.value}</p>
            )}
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            {item.actionLabel && (
              <Button
                size="sm"
                variant={item.severity === "critical" ? "default" : "outline"}
                className={cn(
                  "h-7 text-xs",
                  item.severity !== "critical" && "bg-transparent text-foreground"
                )}
              >
                {item.actionLabel}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
};

/*************************
 * Main Dashboard Component
 *************************/
export default function AdminDashboard() {
  const [showComparison, setShowComparison] = useState(false);
  const comparisonData = useMemo(() => {
    if (!showComparison) return supplyDemandData;
    return supplyDemandData.map(d => ({
      ...d,
      prevRemoteKeywordVolume: Math.max(
        10,
        Math.round(
          d.remoteKeywordVolume * (0.75 + (d.day === "Wed" ? 0.05 : 0) + (d.day === "Thu" ? 0.02 : 0))
        )
      ),
    }));
  }, [showComparison]);
  const totalOpportunities = useMemo(() => statusDistribution.reduce((a,c)=>a+c.value,0), []);

  return (
    <div className="w-full px-2 md:px-4 lg:px-6 py-3 space-y-5" aria-label="Admin dashboard overview">
      <header className="space-y-0.5">
        <h1 className="text-lg font-semibold tracking-tight md:text-xl">Admin Dashboard</h1>
        <p className="text-[11px] md:text-xs text-muted-foreground">Operational health & indexing performance</p>
      </header>

      {/* KPI Grid */}
      <section aria-labelledby="kpi-heading" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <h2 id="kpi-heading" className="sr-only">Key performance indicators</h2>
        {kpis.map(k => <KpiCard key={k.id} metric={k} />)}
      </section>

      {/* Triage moved up for prominence */}
      <section aria-labelledby="triage-heading">
        <Card className="border-neutral-300 dark:border-neutral-700">
          <CardHeader className="pb-3 gap-1">
            <CardTitle id="triage-heading" className="text-sm font-semibold tracking-tight">Triage (Today)</CardTitle>
            <CardDescription className="text-[11px]">Highest-priority operational items</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <TriageList items={triageItems} />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2">
                View Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Charts Section */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3" aria-label="Charts section">
        <Card className="flex flex-col lg:col-span-2" aria-labelledby="supply-demand-title">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle id="supply-demand-title" className="text-sm font-semibold tracking-tight">Opportunity Supply & Keyword Demand (7 Days)</CardTitle>
            <CardDescription className="text-xs">Line: New opportunities indexed • Gray Line: Remote keyword search volume</CardDescription>
            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <Switch
                  checked={showComparison}
                  onCheckedChange={setShowComparison}
                  aria-label="Toggle previous week comparison"
                />
                Compare previous week
              </label>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pt-0">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {/* Line chart replacing bar+line combo */}
                <LineChart data={comparisonData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{ stroke: "#d4d4d4" }} content={<CombinedChartTooltip />} />
                  <Line type="monotone" dataKey="newOpportunities" stroke="#111111" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="remoteKeywordVolume" stroke="#555555" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  {showComparison && (
                    <Line type="monotone" dataKey="prevRemoteKeywordVolume" stroke="#bbbbbb" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2"><span className="size-2 rounded-sm bg-neutral-900" /> New Ops</div>
              <div className="flex items-center gap-2"><span className="size-2 rounded-sm bg-neutral-500" /> Remote KW</div>
              {showComparison && (
                <div className="flex items-center gap-2"><span className="size-2 rounded-sm bg-neutral-300" /> Prev Week</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card aria-labelledby="distribution-title" className="flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle id="distribution-title" className="text-sm font-semibold tracking-tight">Opportunity Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-0">
            <div className="relative h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const p: any = payload[0];
                      return (
                        <div className="rounded border bg-background/95 px-3 py-2 text-xs shadow-sm">
                          <div className="mb-1 font-medium">{p.name}</div>
                          <div className="flex items-center gap-1"><span className="font-semibold tabular-nums">{p.value}</span> ops</div>
                        </div>
                      );
                    }}
                  />
                  <Pie
                    data={statusDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={92}
                    paddingAngle={1.2}
                  >
                    {statusDistribution.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-xl font-semibold leading-none tabular-nums">{totalOpportunities}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">Total Ops</div>
              </div>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              {statusDistribution.map(slice => (
                <li key={slice.name} className="flex items-center gap-2">
                  <span className="size-2 rounded-sm" style={{ backgroundColor: slice.color }} />
                  <span className="truncate">{slice.name}</span>
                  <span className="ml-auto font-medium tabular-nums text-foreground">{slice.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
