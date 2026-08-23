import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobPhotoCategory = "BEFORE" | "PROGRESS" | "AFTER" | "ISSUE" | "OTHER";

export type JobPhotoUploader = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobPhoto = {
  id: string;
  organizationId: string;
  jobId: string;
  uploadedByUserId: string | null;

  category: JobPhotoCategory;
  caption: string | null;

  originalFileName: string;
  mimeType: string;
  sizeBytes: number;

  storageKey: string;

  width: number | null;
  height: number | null;

  takenAt: string | null;

  createdAt: string;
  updatedAt: string;

  uploadedBy: JobPhotoUploader | null;

  url: string;
  urlExpiresInSeconds: number;
};

export type CreateJobPhotoUploadInput = {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type JobPhotoUpload = {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;

  requiredHeaders: {
    "Content-Type": string;
  };
};

export type CreateJobPhotoInput = {
  storageKey: string;

  originalFileName: string;
  mimeType: string;
  sizeBytes: number;

  category?: JobPhotoCategory;
  caption?: string;

  width?: number;
  height?: number;

  takenAt?: string;
};

export function getJobPhotos(jobId: string): Promise<JobPhoto[]> {
  return authenticatedApiRequest<JobPhoto[]>(`/jobs/${jobId}/photos`);
}

export function createJobPhotoUpload(
  jobId: string,
  input: CreateJobPhotoUploadInput,
): Promise<JobPhotoUpload> {
  return authenticatedApiRequest<JobPhotoUpload>(`/jobs/${jobId}/photos/upload-url`, {
    method: "POST",
    body: input,
  });
}

export function createJobPhoto(
  jobId: string,
  input: CreateJobPhotoInput,
): Promise<JobPhoto> {
  return authenticatedApiRequest<JobPhoto>(`/jobs/${jobId}/photos`, {
    method: "POST",
    body: input,
  });
}

export function deleteJobPhoto(
  jobId: string,
  photoId: string,
): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{ success: boolean }>(
    `/jobs/${jobId}/photos/${photoId}`,
    {
      method: "DELETE",
    },
  );
}
