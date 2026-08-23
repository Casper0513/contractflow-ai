import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobNoteAuthor = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobNote = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;

  content: string;

  createdAt: string;
  updatedAt: string;

  createdBy: JobNoteAuthor | null;
};

export type CreateJobNoteInput = {
  content: string;
};

export type UpdateJobNoteInput = {
  content: string;
};

export function getJobNotes(jobId: string): Promise<JobNote[]> {
  return authenticatedApiRequest<JobNote[]>(`/jobs/${jobId}/notes`);
}

export function createJobNote(
  jobId: string,
  input: CreateJobNoteInput,
): Promise<JobNote> {
  return authenticatedApiRequest<JobNote>(`/jobs/${jobId}/notes`, {
    method: "POST",
    body: input,
  });
}

export function updateJobNote(
  jobId: string,
  noteId: string,
  input: UpdateJobNoteInput,
): Promise<JobNote> {
  return authenticatedApiRequest<JobNote>(`/jobs/${jobId}/notes/${noteId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteJobNote(
  jobId: string,
  noteId: string,
): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{ success: boolean }>(`/jobs/${jobId}/notes/${noteId}`, {
    method: "DELETE",
  });
}
