"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/select";
import { api } from "@/lib/api";

export function AddTermDialog({ buttonClassName }: { buttonClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState("");
  const [definition, setDefinition] = useState("");
  const [sourceSlug, setSourceSlug] = useState("business");
  const [error, setError] = useState<string | null>(null);

  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: async () => {
      return api.createTerm({
        term: term.trim(),
        category: category.trim() || null,
        summary: summary.trim() || null,
        definition: definition.trim()
          ? { text: definition.trim(), source_slug: sourceSlug }
          : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      setOpen(false);
      setTerm("");
      setCategory("");
      setSummary("");
      setDefinition("");
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={buttonClassName}
        size="sm"
      >
        <Plus className="h-4 w-4" />
        Add term
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a business term</DialogTitle>
            <DialogDescription>
              Define your own in-house terminology. You can add external
              definitions later via Lookup.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!term.trim()) return;
              create.mutate();
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                Term
              </label>
              <Input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. Material Risk Event"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                  Category
                </label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Risk & Compliance"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                  Source
                </label>
                <Select
                  value={sourceSlug}
                  onChange={(e) => setSourceSlug(e.target.value)}
                >
                  <option value="business">Business Glossary</option>
                  <option value="pdf">PDF Import</option>
                  <option value="llm">AI Consolidated</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                Summary
              </label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="One-line summary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                Definition
              </label>
              <Textarea
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                placeholder="Full definition as your organisation uses it"
                rows={4}
              />
            </div>

            {error ? (
              <p className="text-sm text-[var(--color-destructive)]">{error}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={create.isPending || !term.trim()}
              >
                {create.isPending ? "Saving…" : "Create term"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
