"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Plus, RefreshCcw, Search, Users, Shield, User, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState, useMemo } from "react";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious
} from "@/components/ui/pagination";

const users = [
  { name: "Admin User", email: "admin@example.com", role: "admin" },
  { name: "Jane Doe", email: "jane@example.com", role: "user" },
  { name: "John Smith", email: "john@example.com", role: "user" },
];

export default function UsersPage() {
  const [search, setSearch] = useState("");

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const searchLower = search.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.role.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const adminCount = users.filter(u => u.role === "admin").length;
  const userCount = users.filter(u => u.role === "user").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Users</h1>
          <p className="text-xs text-muted-foreground">Manage and curate users</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <RefreshCcw className="mr-1.5 size-3.5" />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="mr-1.5 size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative p-4 shadow-sm border-muted/30">
          <div className="absolute right-3 top-3 text-muted-foreground/40"><Users className="size-5" /></div>
          <div className="text-2xl font-semibold tracking-tight">{users.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Total</div>
        </Card>
        <Card className="relative p-4 shadow-sm border-muted/30">
          <div className="absolute right-3 top-3 text-muted-foreground/40"><Shield className="size-5" /></div>
          <div className="text-2xl font-semibold tracking-tight">{adminCount}</div>
          <div className="text-sm text-muted-foreground mt-1">Admins</div>
        </Card>
        <Card className="relative p-4 shadow-sm border-muted/30">
          <div className="absolute right-3 top-3 text-muted-foreground/40"><User className="size-5" /></div>
          <div className="text-2xl font-semibold tracking-tight">{userCount}</div>
          <div className="text-sm text-muted-foreground mt-1">Users</div>
        </Card>
        <Card className="relative p-4 shadow-sm border-muted/30">
          <div className="absolute right-3 top-3 text-muted-foreground/40"><Search className="size-5" /></div>
          <div className="text-2xl font-semibold tracking-tight">{filteredUsers.length}</div>
          <div className="text-sm text-muted-foreground mt-1">Showing</div>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, role..."
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
        <div className="text-xs text-muted-foreground min-h-[1.25rem]">
          {filteredUsers.length > 0 && (
            <>Showing <span className="font-medium">{filteredUsers.length}</span> of <span className="font-medium">{users.length}</span></>
          )}
        </div>
      </div>

      <Card className="overflow-hidden border-muted/40">
        <CardContent className="p-0">
          <div className="relative">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-[70px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                        <div className="rounded-full bg-muted p-4 text-muted-foreground">
                          <Users className="size-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">No users found</p>
                          <p className="text-sm text-muted-foreground max-w-sm mx-auto">Try adjusting your search or add a new user.</p>
                        </div>
                        <Button size="sm">
                          <Plus className="size-4 mr-2" /> New User
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((u) => (
                    <TableRow key={u.email} className="hover:bg-muted/50 transition-colors animate-[fadeIn_0.25s_ease-out]">
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="capitalize">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2">
                              <User className="size-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-destructive">
                              <X className="size-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
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
                  <PaginationPrevious href="#"/>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext href="#" />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
    </div>
  );
}