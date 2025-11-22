"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export default function SettingsPage() {
  const fire = (label: string) => {
    toast.error("Not implemented", { description: `${label} is placeholder only.` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your application preferences and configurations.</p>
      </div>

      <div className="space-y-6">
        {/* General */}
        <Card>
          <CardHeader><CardTitle>General</CardTitle><CardDescription>Basic preferences</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive updates about new opportunities</p>
              </div>
              <Switch onCheckedChange={()=>fire('Email Notifications')} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Desktop Alerts</Label>
                <p className="text-sm text-muted-foreground">Browser notification popups</p>
              </div>
              <Switch onCheckedChange={()=>fire('Desktop Alerts')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select onValueChange={()=>fire('Language')}>
                <SelectTrigger id="language" style={{ backgroundColor: 'hsl(var(--background))' }}>
                  <SelectValue placeholder="English" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'hsl(var(--popover))' }}>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Scraper */}
        <Card>
          <CardHeader><CardTitle>Scraper</CardTitle><CardDescription>Extraction behavior</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="autosave" className="text-base cursor-pointer">Auto-save Opportunities</Label>
                <p className="text-sm text-muted-foreground">Store results immediately when scraped</p>
              </div>
              <Checkbox id="autosave" onCheckedChange={()=>fire('Auto-save')} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="jsrender" className="text-base cursor-pointer">Enable JavaScript Rendering</Label>
                <p className="text-sm text-muted-foreground">Use headless browser for dynamic sites</p>
              </div>
              <Checkbox id="jsrender" onCheckedChange={()=>fire('JS Rendering')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Default Model</Label>
              <Select defaultValue="gemini" onValueChange={()=>fire('Model')}>
                <SelectTrigger id="model" style={{ backgroundColor: 'hsl(var(--background))' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'hsl(var(--popover))' }}>
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="gpt">GPT-4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 max-w-[180px]">
              <Label htmlFor="rate">Rate Limit (req/min)</Label>
              <Input id="rate" defaultValue="60" onChange={()=>fire('Rate Limit')} />
            </div>
          </CardContent>
        </Card>

        {/* Display */}
        <Card>
          <CardHeader><CardTitle>Display</CardTitle><CardDescription>Visual preferences</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Compact Mode</Label>
                <p className="text-sm text-muted-foreground">Reduce spacing to show more data</p>
              </div>
              <Switch onCheckedChange={()=>fire('Compact Mode')} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Show Timestamps</Label>
                <p className="text-sm text-muted-foreground">Relative time on items</p>
              </div>
              <Switch onCheckedChange={()=>fire('Show Timestamps')} />
            </div>
            <div className="space-y-2 max-w-[180px]">
              <Label htmlFor="items">Items Per Page</Label>
              <Select defaultValue="25" onValueChange={()=>fire('Items Per Page')}>
                <SelectTrigger id="items" style={{ backgroundColor: 'hsl(var(--background))' }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'hsl(var(--popover))' }}>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Advanced */}
        <Card>
          <CardHeader><CardTitle>Advanced</CardTitle><CardDescription>Power features</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="devmode" className="text-base cursor-pointer">Developer Mode</Label>
                <p className="text-sm text-muted-foreground">Enable verbose logging</p>
              </div>
              <Checkbox id="devmode" onCheckedChange={()=>fire('Developer Mode')} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Label htmlFor="analytics" className="text-base cursor-pointer">Anonymous Analytics</Label>
                <p className="text-sm text-muted-foreground">Share usage data to improve quality</p>
              </div>
              <Checkbox id="analytics" onCheckedChange={()=>fire('Analytics Sharing')} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
