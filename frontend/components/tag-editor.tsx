"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag as TagIcon, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Tag } from "@/lib/types";

export function TagEditor({ termId, tags }: { termId: number; tags: Tag[] }) {
  const [draft, setDraft] = useState("");
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: (names: string[]) => api.setTags(termId, names),
    onMutate: async (names) => {
      await qc.cancelQueries({ queryKey: ["term", termId] });
      const previous = qc.getQueryData<any>(["term", termId]);
      if (previous) {
        qc.setQueryData<any>(["term", termId], {
          ...previous,
          tags: names.map((n, i) => ({ id: -i, name: n, slug: n.toLowerCase() })),
        });
      }
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["term", termId], ctx.previous);
      toast.error(err.message || "Could not update tags");
    },
    onSuccess: () => {
      toast.success("Tags updated");
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["tag-counts"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["term", termId] });
    },
  });

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setDraft("");
      return;
    }
    save.mutate([...tags.map((t) => t.name), name]);
    setDraft("");
  };

  const remove = (name: string) => {
    save.mutate(tags.filter((t) => t.name !== name).map((t) => t.name));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.length === 0 ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            No tags yet.
          </span>
        ) : (
          tags.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-0.5 text-xs"
            >
              <TagIcon className="h-3 w-3 opacity-60" />
              {t.name}
              <button
                type="button"
                onClick={() => remove(t.name)}
                aria-label={`Remove tag ${t.name}`}
                className="rounded-full p-0.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input
          placeholder="Add tag…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 max-w-[12rem]"
        />
        <button
          type="submit"
          disabled={!draft.trim() || save.isPending}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] disabled:opacity-40"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </form>
    </div>
  );
}
