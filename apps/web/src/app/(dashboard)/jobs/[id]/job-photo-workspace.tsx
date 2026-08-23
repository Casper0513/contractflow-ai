"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobPhoto, JobPhotoCategory } from "@/lib/job-photos-api";

import {
  createJobPhotoAction,
  createJobPhotoUploadAction,
  deleteJobPhotoAction,
} from "./job-photo-actions";

const MAX_PHOTO_SIZE_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const CATEGORY_OPTIONS: {
  value: JobPhotoCategory;
  label: string;
}[] = [
  {
    value: "BEFORE",
    label: "Before",
  },
  {
    value: "PROGRESS",
    label: "Progress",
  },
  {
    value: "AFTER",
    label: "After",
  },
  {
    value: "ISSUE",
    label: "Issue",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

export function JobPhotoWorkspace({
  jobId,
  photos,
  archived,
}: {
  jobId: string;
  photos: JobPhoto[];
  archived: boolean;
}) {
  const [selectedCategory, setSelectedCategory] = useState<JobPhotoCategory | "ALL">(
    "ALL",
  );

  const filteredPhotos = useMemo(() => {
    if (selectedCategory === "ALL") {
      return photos;
    }

    return photos.filter((photo) => photo.category === selectedCategory);
  }, [photos, selectedCategory]);

  return (
    <div className="space-y-6">
      {!archived && <PhotoUploadForm jobId={jobId} />}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">Photo gallery</h3>

          <p className="text-sm text-muted-foreground">
            {photos.length} photo
            {photos.length === 1 ? "" : "s"} on this job.
          </p>
        </div>

        <select
          value={selectedCategory}
          onChange={(event) =>
            setSelectedCategory(event.target.value as JobPhotoCategory | "ALL")
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

      {filteredPhotos.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed">
          <div className="max-w-sm px-6 text-center">
            <ImageIcon className="mx-auto h-9 w-9 text-muted-foreground" />

            <p className="mt-3 font-medium">No photos yet</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Upload job-site photos to document progress, issues, before/after work, and
              completed results.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredPhotos.map((photo) => (
            <PhotoCard key={photo.id} jobId={jobId} photo={photo} archived={archived} />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoUploadForm({ jobId }: { jobId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [category, setCategory] = useState<JobPhotoCategory>("PROGRESS");

  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");

  const [uploading, setUploading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setSuccess(null);

    const selected = event.target.files?.[0] ?? null;

    if (!selected) {
      clearSelectedFile();
      return;
    }

    if (!ALLOWED_TYPES.has(selected.type)) {
      clearSelectedFile();

      setError("Only JPEG, PNG, and WebP photos are supported.");

      return;
    }

    if (selected.size > MAX_PHOTO_SIZE_BYTES) {
      clearSelectedFile();

      setError("Photo must be 15 MB or smaller.");

      return;
    }

    if (selected.size <= 0) {
      clearSelectedFile();

      setError("The selected photo is empty.");

      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreview = URL.createObjectURL(selected);

    setFile(selected);
    setPreviewUrl(nextPreview);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(null);

    if (!file) {
      setError("Select a photo first.");
      return;
    }

    setUploading(true);

    try {
      const dimensions = await readImageDimensions(file);

      const uploadResult = await createJobPhotoUploadAction(jobId, {
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

      const createResult = await createJobPhotoAction(jobId, {
        storageKey: uploadResult.data.storageKey,

        originalFileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,

        category,

        ...(caption.trim()
          ? {
              caption: caption.trim(),
            }
          : {}),

        ...(dimensions.width
          ? {
              width: dimensions.width,
            }
          : {}),

        ...(dimensions.height
          ? {
              height: dimensions.height,
            }
          : {}),

        ...(takenAt
          ? {
              takenAt: new Date(takenAt).toISOString(),
            }
          : {}),
      });

      if (!createResult.success) {
        throw new Error(createResult.error);
      }

      clearSelectedFile();

      setCategory("PROGRESS");
      setCaption("");
      setTakenAt("");

      setSuccess("Photo uploaded successfully.");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Unable to upload photo.",
      );
    } finally {
      setUploading(false);
    }
  }

  function clearSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(null);
    setPreviewUrl(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-muted-foreground" />

          <h3 className="font-semibold">Upload job photo</h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          JPEG, PNG, or WebP. Maximum file size 15 MB.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Photo</span>

            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Category</span>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as JobPhotoCategory)}
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
            <span className="text-sm font-medium">Caption</span>

            <textarea
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={3}
              maxLength={2000}
              disabled={uploading}
              placeholder="Describe this photo..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Taken at</span>

            <Input
              type="datetime-local"
              value={takenAt}
              onChange={(event) => setTakenAt(event.target.value)}
              disabled={uploading}
            />

            <span className="block text-xs text-muted-foreground">
              Optional. Leave blank to use the upload timestamp only.
            </span>
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border bg-background">
          {previewUrl ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Selected upload preview"
                className="aspect-square w-full object-cover"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={clearSelectedFile}
                className="absolute right-2 top-2"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center p-6 text-center">
              <div>
                <ImageIcon className="mx-auto h-9 w-9 text-muted-foreground" />

                <p className="mt-3 text-sm text-muted-foreground">
                  Preview will appear here.
                </p>
              </div>
            </div>
          )}

          {file && (
            <div className="border-t p-3">
              <p className="truncate text-sm font-medium">{file.name}</p>

              <p className="mt-1 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
          )}
        </div>
      </div>

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
            Upload photo
          </>
        )}
      </Button>
    </form>
  );
}

function PhotoCard({
  jobId,
  photo,
  archived,
}: {
  jobId: string;
  photo: JobPhoto;
  archived: boolean;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      const result = await deleteJobPhotoAction(jobId, photo.id);

      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete photo.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-xl border bg-background">
      <a href={photo.url} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption ?? photo.originalFileName}
          className="aspect-[4/3] w-full object-cover transition-transform hover:scale-[1.01]"
        />
      </a>

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium">
              {formatCategory(photo.category)}
            </span>

            {photo.caption && <p className="mt-2 text-sm">{photo.caption}</p>}
          </div>

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

        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="truncate">{photo.originalFileName}</p>

          <p>{formatFileSize(photo.sizeBytes)}</p>

          <p>Uploaded {formatDateTime(photo.createdAt)}</p>

          {photo.takenAt && <p>Taken {formatDateTime(photo.takenAt)}</p>}

          {photo.uploadedBy && <p>By {formatUploaderName(photo.uploadedBy)}</p>}

          {photo.width && photo.height && (
            <p>
              {photo.width} × {photo.height}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </article>
  );
}

function readImageDimensions(file: File): Promise<{
  width: number | null;
  height: number | null;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);

    const image = new Image();

    image.onload = () => {
      const result = {
        width:
          Number.isFinite(image.naturalWidth) && image.naturalWidth > 0
            ? image.naturalWidth
            : null,

        height:
          Number.isFinite(image.naturalHeight) && image.naturalHeight > 0
            ? image.naturalHeight
            : null,
      };

      URL.revokeObjectURL(url);

      resolve(result);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);

      resolve({
        width: null,
        height: null,
      });
    };

    image.src = url;
  });
}

function formatUploaderName(uploader: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const name = [uploader.firstName, uploader.lastName].filter(Boolean).join(" ");

  return name || uploader.email;
}

function formatCategory(category: JobPhotoCategory) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
