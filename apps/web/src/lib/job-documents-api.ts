import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobDocumentCategory =
  "CONTRACT" | "PERMIT" | "RECEIPT" | "WARRANTY" | "PLAN" | "OTHER";

export type JobDocumentUploader = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobDocument = {
  id: string;
  organizationId: string;
  jobId: string;
  uploadedByUserId: string | null;

  category: JobDocumentCategory;

  title: string | null;
  description: string | null;

  originalFileName: string;
  mimeType: string;
  sizeBytes: number;

  storageKey: string;

  createdAt: string;
  updatedAt: string;

  uploadedBy: JobDocumentUploader | null;

  url: string;
  urlExpiresInSeconds: number;
};

export type CreateJobDocumentUploadInput = {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type JobDocumentUpload = {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;

  requiredHeaders: {
    "Content-Type": string;
  };
};

export type CreateJobDocumentInput = {
  storageKey: string;

  originalFileName: string;
  mimeType: string;
  sizeBytes: number;

  category?: JobDocumentCategory;

  title?: string;
  description?: string;
};

export function getJobDocuments(jobId: string): Promise<JobDocument[]> {
  return authenticatedApiRequest<JobDocument[]>(`/jobs/${jobId}/documents`);
}

export function createJobDocumentUpload(
  jobId: string,
  input: CreateJobDocumentUploadInput,
): Promise<JobDocumentUpload> {
  return authenticatedApiRequest<JobDocumentUpload>(
    `/jobs/${jobId}/documents/upload-url`,
    {
      method: "POST",
      body: input,
    },
  );
}

export function createJobDocument(
  jobId: string,
  input: CreateJobDocumentInput,
): Promise<JobDocument> {
  return authenticatedApiRequest<JobDocument>(`/jobs/${jobId}/documents`, {
    method: "POST",
    body: input,
  });
}

export function deleteJobDocument(
  jobId: string,
  documentId: string,
): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{ success: boolean }>(
    `/jobs/${jobId}/documents/${documentId}`,
    {
      method: "DELETE",
    },
  );
}
