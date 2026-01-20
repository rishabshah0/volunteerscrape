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
import { useState, useEffect } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";
import type { User as UserType } from "@/lib/types";
import { listUsers, deleteUser, createUser, updateUser } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

export default function UsersPage() {
  // mounted state for hydration fix
  const [mounted, setMounted] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [users, setUsers] = useState<UserType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState<null | UserType>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "user">("user");
  const [submitting, setSubmitting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load users from API
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers({ page, pageSize, q: debouncedSearch, role: roleFilter || undefined });
      setUsers(result.items);
      setTotal(result.total);
      // If current page becomes empty due to deletion, go back one page (unless page=1)
      // Only go back if there are still items in total (prevents infinite loop)
      if (result.items.length === 0 && page > 1 && result.total > 0) {
        setPage(p => Math.max(1, p - 1));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load users";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, debouncedSearch, roleFilter]);

  const adminCount = users.filter(u => u.role === "admin").length;
  const userCount = users.filter(u => u.role === "user").length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleDelete(userId: string, userName: string) {
    if (!window.confirm(`Delete user "${userName}"? This cannot be undone.`)) return;
    try {
      await deleteUser(userId);
      toast.success("User deleted");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast.error(msg);
    }
  }

  const formatDate = (isoString: string) => {
    // Always return consistent value for SSR/hydration
    if (!mounted) {
      // Return a simple formatted date for SSR
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }

    // Client-side only: calculate relative time
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  // Mount effect for hydration fix
  useEffect(() => {
    setMounted(true);
  }, []);

  function openAddDialog() {
    setFormName("");
    setFormEmail("");
    setFormRole("user");
    setOpenAdd(true);
  }
  function openEditDialog(user: UserType) {
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role);
    setOpenEdit(user);
  }
  function resetDialogs() {
    setOpenAdd(false);
    setOpenEdit(null);
    setSubmitting(false);
  }
  async function handleCreate() {
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Name and Email required");
      return;
    }
    try {
      setSubmitting(true);
      await createUser({ name: formName.trim(), email: formEmail.trim(), role: formRole });
      toast.success("User created");
      resetDialogs();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }
  async function handleUpdate() {
    if (!openEdit) return;
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Name and Email required");
      return;
    }
    try {
      setSubmitting(true);
      await updateUser(openEdit.id, { name: formName.trim(), email: formEmail.trim(), role: formRole });
      toast.success("User updated");
      resetDialogs();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground">Manage user accounts and permissions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCcw className="mr-1.5 size-3.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="mr-1.5 size-3.5" />
              Add User
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="relative p-4 shadow-sm border-muted/30">
            <div className="absolute right-3 top-3 text-muted-foreground/40">
              <Users className="size-5" />
            </div>
            <div className="text-2xl font-semibold tracking-tight">{total}</div>
            <div className="text-sm text-muted-foreground mt-1">Total Users</div>
          </Card>
          <Card className="relative p-4 shadow-sm border-muted/30">
            <div className="absolute right-3 top-3 text-muted-foreground/40">
              <Shield className="size-5" />
            </div>
            <div className="text-2xl font-semibold tracking-tight">{adminCount}</div>
            <div className="text-sm text-muted-foreground mt-1">Admins</div>
          </Card>
          <Card className="relative p-4 shadow-sm border-muted/30">
            <div className="absolute right-3 top-3 text-muted-foreground/40">
              <User className="size-5" />
            </div>
            <div className="text-2xl font-semibold tracking-tight">{userCount}</div>
            <div className="text-sm text-muted-foreground mt-1">Regular Users</div>
          </Card>
          <Card className="relative p-4 shadow-sm border-muted/30">
            <div className="absolute right-3 top-3 text-muted-foreground/40">
              <Search className="size-5" />
            </div>
            <div className="text-2xl font-semibold tracking-tight">{users.length}</div>
            <div className="text-sm text-muted-foreground mt-1">On Page</div>
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
          <div className="flex flex-wrap gap-2 items-center">
            <div className="text-xs text-muted-foreground min-h-[1.25rem]">
              {users.length > 0 && (
                <>Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(page * pageSize, total)}</span> of{" "}
                  <span className="font-medium">{total}</span></>
              )}
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8" onClick={openAddDialog}>
              <Plus className="size-3.5 mr-1" /> New
            </Button>
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-muted/40">
          <CardContent className="p-0">
            <div className="relative">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="p-4">Name</TableHead>
                    <TableHead className="p-4">Email</TableHead>
                    <TableHead className="p-4">Role</TableHead>
                    <TableHead className="p-4">Joined</TableHead>
                    <TableHead className="p-4 w-[70px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    // Loading skeleton
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="p-4">
                          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell className="p-4">
                          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell className="p-4">
                          <div className="h-5 w-16 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell className="p-4">
                          <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                        </TableCell>
                        <TableCell className="p-4">
                          <div className="h-8 w-8 bg-muted animate-pulse rounded" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                          <div className="rounded-full bg-muted p-4 text-muted-foreground">
                            <Users className="size-6" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium">No users found</p>
                            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                              Try adjusting your search or add a new user.
                            </p>
                          </div>
                          <Button size="sm">
                            <Plus className="size-4 mr-2" /> New User
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => (
                      <TableRow
                        key={u.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="p-4 font-medium">{u.name}</TableCell>
                        <TableCell className="p-4">{u.email}</TableCell>
                        <TableCell className="p-4">
                          <Badge
                            variant={u.role === "admin" ? "default" : "secondary"}
                            className="capitalize"
                          >
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="p-4 text-muted-foreground text-sm">
                          {formatDate(u.createdAt)}
                        </TableCell>
                        <TableCell className="p-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="gap-2" onClick={() => openEditDialog(u)}>
                                <User className="size-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive"
                                onClick={() => handleDelete(u.id, u.name)}
                              >
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

        {/* Error Banner */}
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage(page - 1);
                  }}
                  className={page === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-4 text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < totalPages) setPage(page + 1);
                  }}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={openAdd} onOpenChange={(v) => !v && resetDialogs()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="new-name">Name</Label>
              <Input id="new-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as "admin" | "user")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={resetDialogs} disabled={submitting}>Cancel</Button>
            <Button onClick={handleCreate} disabled={submitting}>{submitting ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!openEdit} onOpenChange={(v) => !v && resetDialogs()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as "admin" | "user")}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={resetDialogs} disabled={submitting}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
