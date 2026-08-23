"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  Download,
  File,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobDocument, JobDocumentCategory } from "@/lib/job-documents-api";

import {
  createJobDocumentAction,
  createJobDocumentUploadAction,
  deleteJobDocumentAction,
} from "./job-document-actions";

const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CATEGORY_OPTIONS: {
  value: JobDocumentCategory;
  label: string;
}[] = [
  {
    value: "CONTRACT",
    label: "Contract",
  },
  {
    value: "PERMIT",
    label: "Permit",
  },
  {
    value: "RECEIPT",
    label: "Receipt",
  },
  {
    value: "WARRANTY",
    label: "Warranty",
  },
  {
    value: "PLAN",
    label: "Plan",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

export function JobDocumentWorkspace({
  jobId,
  documents,
  archived,
}: {
  jobId: string;
  documents: JobDocument[];
  archived: boolean;
}) {
  const [selectedCategory, setSelectedCategory] = useState<JobDocumentCategory | "ALL">(
    "ALL",
  );

  const filteredDocuments = useMemo(() => {
    if (selectedCategory === "ALL") {
      return documents;
    }

    return documents.filter((document) => document.category === selectedCategory);
  }, [documents, selectedCategory]);

  return (
    <div className="space-y-6">
      {!archived && <DocumentUploadForm jobId={jobId} />}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">Job documents</h3>

          <p className="text-sm text-muted-foreground">
            {documents.length} document
            {documents.length === 1 ? "" : "s"} on this job.
          </p>
        </div>

        <select
          value={selectedCategory}
          onChange={(event) =>
            setSelectedCategory(event.target.value as JobDocumentCategory | "ALL")
          }
          className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none"
        >
          <option value="ALL">All categories</option>

          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed">
          <div className="max-w-sm px-6 text-center">
            <FolderOpen className="mx-auto h-9 w-9 text-muted-foreground" />

            <p className="mt-3 font-medium">No documents yet</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Upload contracts, permits, receipts, warranties, plans, and other files
              related to this job.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((document) => (
            <DocumentCard
              key={document.id}
              jobId={jobId}
              document={document}
              archived={archived}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentUploadForm({ jobId }: { jobId: string }) {
  const [file, setFile] = useState<File | null>(null);

  const [category, setCategory] = useState<JobDocumentCategory>("OTHER");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(null);

    const selected = event.target.files?.[0] ?? null;

    if (!selected) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.has(selected.type)) {
      setFile(null);

      setError(
        "Unsupported file type. Use PDF, Word, Excel, text, CSV, JPEG, PNG, or WebP.",
      );

      event.target.value = "";

      return;
    }

    if (selected.size > MAX_DOCUMENT_SIZE_BYTES) {
      setFile(null);

      setError("Document must be 25 MB or smaller.");

      event.target.value = "";

      return;
    }

    if (selected.size <= 0) {
      setFile(null);

      setError("The selected document is empty.");

      event.target.value = "";

      return;
    }

    setFile(selected);

    if (!title.trim()) {
      setTitle(fileNameWithoutExtension(selected.name));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    setError(null);
    setSuccess(null);

    if (!file) {
      setError("Select a document first.");
      return;
    }

    setUploading(true);

    try {
      const uploadResult = await createJobDocumentUploadAction(jobId, {
        originalFileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      const uploadResponse = await fetch(uploadResult.data.uploadUrl, {
        method: "PUT",
        headers: uploadResult.data.requiredHeaders,
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Cloudflare R2 upload failed with status ${uploadResponse.status}.`,
        );
      }

      const createResult = await createJobDocumentAction(jobId, {
        storageKey: uploadResult.data.storageKey,

        originalFileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,

        category,

        ...(title.trim()
          ? {
              title: title.trim(),
            }
          : {}),

        ...(description.trim()
          ? {
              description: description.trim(),
            }
          : {}),
      });

      if (!createResult.success) {
        throw new Error(createResult.error);
      }

      setFile(null);
      setCategory("OTHER");
      setTitle("");
      setDescription("");

      const fileInput = form.elements.namedItem("document") as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      setSuccess("Document uploaded successfully.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Unable to upload document.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />

          <h3 className="font-semibold">Upload job document</h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          PDF, Word, Excel, text, CSV, JPEG, PNG, or WebP. Maximum file size 25 MB.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">Document</span>

          <Input
            name="document"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Category</span>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as JobDocumentCategory)}
            disabled={uploading}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Title</span>

          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={255}
            disabled={uploading}
            placeholder="Document title"
          />
        </label>

        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-sm font-medium">Description</span>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={4000}
            disabled={uploading}
            placeholder="Optional notes about this document..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
      </div>

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
          <div className="flex min-w-0 items-center gap-3">
            <DocumentTypeIcon mimeType={file.type} />

            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>

              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => setFile(null)}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {success && <p className="text-sm text-green-700">{success}</p>}

      <Button type="submit" disabled={uploading || !file}>
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload document
          </>
        )}
      </Button>
    </form>
  );
}

function DocumentCard({
  jobId,
  document,
  archived,
}: {
  jobId: string;
  document: JobDocument;
  archived: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const result = await deleteJobDocumentAction(jobId, document.id);

      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete document.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="rounded-xl border bg-background p-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
            <DocumentTypeIcon mimeType={document.mimeType} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{document.title || document.originalFileName}</p>

              <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium">
                {formatCategory(document.category)}
              </span>
            </div>

            {document.description && (
              <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>
            )}

            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <p className="truncate">{document.originalFileName}</p>

              <p>
                {formatFileSize(document.sizeBytes)} · {formatMimeType(document.mimeType)}
              </p>

              <p>Uploaded {formatDateTime(document.createdAt)}</p>

              {document.uploadedBy && <p>By {formatUploaderName(document.uploadedBy)}</p>}
            </div>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href={document.url} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4" />
                Open
              </a>
            }
          />

          {!archived && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function DocumentTypeIcon({ mimeType }: { mimeType: string }) {
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  ) {
    return <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />;
  }

  if (
    mimeType === "application/pdf" ||
    mimeType === "application/msword" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "text/plain"
  ) {
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  }

  return <File className="h-5 w-5 text-muted-foreground" />;
}

function fileNameWithoutExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");

  if (lastDot <= 0) {
    return fileName;
  }

  return fileName.slice(0, lastDot);
}

function formatUploaderName(uploader: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const name = [uploader.firstName, uploader.lastName].filter(Boolean).join(" ");

  return name || uploader.email;
}

function formatCategory(category: JobDocumentCategory) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMimeType(mimeType: string) {
  switch (mimeType) {
    case "application/pdf":
      return "PDF";

    case "application/msword":
      return "Word";

    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "Word";

    case "application/vnd.ms-excel":
      return "Excel";

    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return "Excel";

    case "text/csv":
      return "CSV";

    case "text/plain":
      return "Text";

    case "image/jpeg":
      return "JPEG";

    case "image/png":
      return "PNG";

    case "image/webp":
      return "WebP";

    default:
      return mimeType;
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
