"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Opportunity } from "@/lib/types";
import { createOpportunity, deleteOpportunity, listOpportunities, updateOpportunity } from "@/lib/api";
import { OpportunityForm, type OpportunityFormValues } from "@/components/admin/opportunity-form";

export default function OpportunitiesPage() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openAdd, setOpenAdd] = useState(false);
  const [editItem, setEditItem] = useState<Opportunity | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await listOpportunities({ page, pageSize, q });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleCreate(values: OpportunityFormValues) {
    try {
      const payload: Partial<Opportunity> = {
        ...values,
        tags: values.tags ? values.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      };
      await createOpportunity(payload);
      toast.success("Opportunity added");
      setOpenAdd(false);
      setPage(1);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add";
      toast.error(msg);
    }
  }

  async function handleUpdate(values: OpportunityFormValues) {
    if (!editItem) return;
    try {
      const payload: Partial<Opportunity> = {
        ...values,
        tags: values.tags ? values.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      };
      await updateOpportunity(editItem.id, payload);
      toast.success("Opportunity updated");
      setEditItem(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast.error(msg);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteOpportunity(id);
      toast.success("Opportunity deleted");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl font-semibold">Opportunities</div>
        <Button onClick={() => setOpenAdd(true)}><Plus className="size-4 mr-2" /> Add</Button>
      </div>

      <div className="flex items-center gap-2">
        <Input placeholder="Search..." value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} className="max-w-sm" />
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">Loading...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No opportunities</TableCell></TableRow>
            ) : (
              items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.title}</TableCell>
                  <TableCell>{o.organization}</TableCell>
                  <TableCell className="space-x-1">
                    {o.tags?.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary">{t}</Badge>
                    ))}
                  </TableCell>
                  <TableCell>{o.location}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditItem(o)} className="gap-2"><Pencil className="size-4" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(o.id)} className="gap-2 text-destructive"><Trash2 className="size-4" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }} />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Opportunity</DialogTitle>
          </DialogHeader>
          <OpportunityForm onSubmit={handleCreate} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(v) => !v && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Opportunity</DialogTitle>
          </DialogHeader>
          {editItem && (
            <OpportunityForm
              initial={{
                title: editItem.title,
                organization: editItem.organization,
                tags: editItem.tags?.join(", ") || "",
                location: editItem.location,
                url: editItem.url,
                description: editItem.description,
                timeSlot: editItem.timeSlot,
              }}
              onSubmit={handleUpdate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
