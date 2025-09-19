"use client";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const schema = z.object({
  title: z.string().min(1, "Required"),
  organization: z.string().min(1, "Required"),
  tags: z.string().optional(), // comma-separated
  location: z.string().optional(),
  url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  description: z.string().optional(),
  timeSlot: z.string().optional(),
});

export type OpportunityFormValues = z.infer<typeof schema>;

export function OpportunityForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: Partial<OpportunityFormValues>;
  onSubmit: (values: OpportunityFormValues) => Promise<void> | void;
  submitting?: boolean;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<OpportunityFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title || "",
      organization: initial?.organization || "",
      tags: initial?.tags || "",
      location: initial?.location || "",
      url: initial?.url || "",
      description: initial?.description || "",
      timeSlot: initial?.timeSlot || "",
    }
  });

  return (
    <form className="space-y-3" onSubmit={handleSubmit(async (v) => { await onSubmit(v); })}>
      <div>
        <label className="text-sm">Title</label>
        <Input {...register("title")} />
        {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
      </div>
      <div>
        <label className="text-sm">Organization</label>
        <Input {...register("organization")} />
        {errors.organization && <p className="text-xs text-destructive mt-1">{errors.organization.message}</p>}
      </div>
      <div>
        <label className="text-sm">Tags (comma-separated)</label>
        <Input placeholder="community, kids" {...register("tags")} />
      </div>
      <div>
        <label className="text-sm">Location</label>
        <Input {...register("location")} />
      </div>
      <div>
        <label className="text-sm">URL</label>
        <Input {...register("url")} />
        {errors.url && <p className="text-xs text-destructive mt-1">{errors.url.message}</p>}
      </div>
      <div>
        <label className="text-sm">Description</label>
        <Textarea rows={4} {...register("description")} />
      </div>
      <div>
        <label className="text-sm">Time Slot</label>
        <Input {...register("timeSlot")} />
      </div>
      <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : "Save"}</Button>
    </form>
  );
}

