"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Upload } from "lucide-react";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { ImportResult, PDFExtraction } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "csv" | "json" | "pdf";

export default function ImportPage() {
  const [mode, setMode] = useState<Mode>("csv");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Bring in terms from a CSV, JSON export, or extract defined terms
          straight from a PDF.
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            { k: "csv", label: "CSV" },
            { k: "json", label: "JSON" },
            { k: "pdf", label: "PDF" },
          ] as Array<{ k: Mode; label: string }>
        ).map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              mode === k
                ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "csv" ? <CSVImport /> : null}
      {mode === "json" ? <JSONImport /> : null}
      {mode === "pdf" ? <PDFImport /> : null}
    </div>
  );
}

function CSVImport() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState({
    term_column: "term",
    category_column: "category",
    summary_column: "summary",
    definition_column: "definition",
    source_slug: "business",
  });
  const qc = useQueryClient();

  const handleFile = (f: File | null) => {
    setFile(f);
    if (!f) {
      setHeaders([]);
      setPreview([]);
      return;
    }
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      preview: 5,
      complete: (res) => {
        setHeaders(res.meta.fields || []);
        setPreview(res.data);
        // auto-map
        const fields = res.meta.fields || [];
        const match = (keys: string[]) =>
          fields.find((f) => keys.some((k) => f.toLowerCase() === k)) ||
          fields[0] ||
          "";
        setMapping((m) => ({
          ...m,
          term_column: match(["term", "name"]) || m.term_column,
          category_column:
            fields.find((f) => f.toLowerCase() === "category") ||
            m.category_column,
          summary_column:
            fields.find((f) => f.toLowerCase() === "summary") ||
            m.summary_column,
          definition_column:
            fields.find((f) =>
              ["definition", "description"].includes(f.toLowerCase())
            ) || m.definition_column,
        }));
      },
      error: (err) => toast.error(`CSV parse error: ${err.message}`),
    });
  };

  const submit = useMutation({
    mutationFn: () => api.importCsv(file!, mapping),
    onSuccess: (r: ImportResult) => {
      toast.success(
        `Imported ${r.terms_added} term${
          r.terms_added === 1 ? "" : "s"
        } + ${r.definitions_added} definition${
          r.definitions_added === 1 ? "" : "s"
        }`
      );
      qc.invalidateQueries();
      setFile(null);
      setHeaders([]);
      setPreview([]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dropzone
          accept=".csv,text/csv"
          file={file}
          onFile={handleFile}
          hint="Drop a CSV or click to pick. Columns can be mapped below."
        />

        {headers.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
              <MappingSelect
                label="Term column (required)"
                value={mapping.term_column}
                options={headers}
                onChange={(v) =>
                  setMapping((m) => ({ ...m, term_column: v }))
                }
              />
              <MappingSelect
                label="Category"
                value={mapping.category_column}
                options={["", ...headers]}
                onChange={(v) =>
                  setMapping((m) => ({ ...m, category_column: v }))
                }
              />
              <MappingSelect
                label="Summary"
                value={mapping.summary_column}
                options={["", ...headers]}
                onChange={(v) =>
                  setMapping((m) => ({ ...m, summary_column: v }))
                }
              />
              <MappingSelect
                label="Definition"
                value={mapping.definition_column}
                options={["", ...headers]}
                onChange={(v) =>
                  setMapping((m) => ({ ...m, definition_column: v }))
                }
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
                  Source
                </label>
                <Select
                  value={mapping.source_slug}
                  onChange={(e) =>
                    setMapping((m) => ({ ...m, source_slug: e.target.value }))
                  }
                >
                  <option value="business">Business Glossary</option>
                  <option value="pdf">PDF Import</option>
                  <option value="standards">Standards</option>
                  <option value="free-dictionary">Free Dictionary</option>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t">
                      {headers.map((h) => (
                        <td
                          key={h}
                          className="px-3 py-2 text-[var(--color-muted-foreground)]"
                        >
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => submit.mutate()}
                disabled={!file || submit.isPending}
              >
                {submit.isPending ? "Importing…" : "Import CSV"}
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function JSONImport() {
  const [file, setFile] = useState<File | null>(null);
  const qc = useQueryClient();

  const submit = useMutation({
    mutationFn: () => api.importJson(file!),
    onSuccess: (r) => {
      toast.success(
        `Imported ${r.terms_added} term${r.terms_added === 1 ? "" : "s"}`
      );
      qc.invalidateQueries();
      setFile(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>JSON import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Dropzone
          accept=".json,application/json"
          file={file}
          onFile={setFile}
          hint="Accepts the same shape as the JSON export — or a bare array of terms."
        />
        <div className="flex justify-end">
          <Button
            onClick={() => submit.mutate()}
            disabled={!file || submit.isPending}
          >
            {submit.isPending ? "Importing…" : "Import JSON"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PDFImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PDFExtraction | null>(null);
  const qc = useQueryClient();

  const previewMut = useMutation({
    mutationFn: () => api.previewPdf(file!),
    onSuccess: (p) => {
      setPreview(p);
      if (p.extracted_terms === 0) {
        toast.info(
          "No defined terms detected. The heuristic looks for 'Term means ...' and similar patterns."
        );
      } else {
        toast.success(
          `Found ${p.extracted_terms} candidate term${
            p.extracted_terms === 1 ? "" : "s"
          }.`
        );
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const importMut = useMutation({
    mutationFn: () => api.importPdf(file!),
    onSuccess: (r) => {
      toast.success(
        `Imported ${r.terms_added} term${r.terms_added === 1 ? "" : "s"}`
      );
      qc.invalidateQueries();
      setFile(null);
      setPreview(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>PDF import</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Drop in a policy or standard. We'll extract glossary-style definitions
          via PyMuPDF4LLM + regex heuristics, then let you confirm before
          importing.
        </p>
        <Dropzone
          accept=".pdf,application/pdf"
          file={file}
          onFile={(f) => {
            setFile(f);
            setPreview(null);
          }}
          hint="PDFs up to 10 MiB. Scanned / image-only PDFs won't extract."
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => previewMut.mutate()}
            disabled={!file || previewMut.isPending}
          >
            {previewMut.isPending ? "Scanning…" : "Preview extraction"}
          </Button>
          <Button
            onClick={() => importMut.mutate()}
            disabled={!file || importMut.isPending}
          >
            {importMut.isPending ? "Importing…" : "Import all"}
          </Button>
        </div>

        {preview ? (
          <div className="rounded-lg border">
            <div className="border-b bg-[var(--color-muted)] px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
              {preview.filename} · {preview.total_pages} page
              {preview.total_pages === 1 ? "" : "s"} · {preview.extracted_terms}{" "}
              candidate{preview.extracted_terms === 1 ? "" : "s"} · via {" "}
              <span className="font-medium text-[var(--color-foreground)]">
                {preview.extractor}
              </span>
            </div>
            <ul className="divide-y">
              {preview.preview.map((r, i) => (
                <li key={i} className="px-3 py-2 text-sm">
                  <div className="font-medium">{r.term}</div>
                  <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                    {r.definition}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MappingSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[var(--color-muted-foreground)]">
        {label}
      </label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "— ignore —"}
          </option>
        ))}
      </Select>
    </div>
  );
}

function Dropzone({
  accept,
  file,
  onFile,
  hint,
}: {
  accept: string;
  file: File | null;
  onFile: (f: File | null) => void;
  hint: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors",
        dragOver
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
          : "border-[var(--color-border)] hover:bg-[var(--color-muted)]/40"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      <div className="flex flex-col items-center gap-1">
        {file ? (
          <>
            <FileText className="h-5 w-5 text-[var(--color-primary)]" />
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {(file.size / 1024).toFixed(1)} KB
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFile(null);
              }}
              className="mt-2 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"
            >
              Clear
            </button>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5 text-[var(--color-muted-foreground)]" />
            <p className="text-sm font-medium">Drop a file here</p>
            <p className="max-w-sm text-xs text-[var(--color-muted-foreground)]">
              {hint}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

