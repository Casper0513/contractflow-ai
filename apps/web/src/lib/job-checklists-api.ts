import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobChecklistUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobChecklistItem = {
  id: string;
  organizationId: string;
  checklistId: string;

  title: string;
  description: string | null;

  position: number;
  required: boolean;

  completedAt: string | null;
  completedByUserId: string | null;

  createdAt: string;
  updatedAt: string;

  completedBy: JobChecklistUser | null;
};

export type JobChecklist = {
  id: string;
  organizationId: string;
  jobId: string;

  sourceTemplateId: string | null;
  createdByUserId: string | null;

  name: string;
  description: string | null;

  createdAt: string;
  updatedAt: string;

  createdBy: JobChecklistUser | null;
  items: JobChecklistItem[];
};

export type ApplyChecklistTemplateInput = {
  templateId: string;
};

export type UpdateJobChecklistInput = {
  name?: string;
  description?: string;
};

export function getJobChecklists(jobId: string): Promise<JobChecklist[]> {
  return authenticatedApiRequest<JobChecklist[]>(`/jobs/${jobId}/checklists`);
}

export function applyChecklistTemplate(
  jobId: string,
  input: ApplyChecklistTemplateInput,
): Promise<JobChecklist> {
  return authenticatedApiRequest<JobChecklist>(`/jobs/${jobId}/checklists`, {
    method: "POST",
    body: input,
  });
}

export function updateJobChecklist(
  jobId: string,
  checklistId: string,
  input: UpdateJobChecklistInput,
): Promise<JobChecklist> {
  return authenticatedApiRequest<JobChecklist>(
    `/jobs/${jobId}/checklists/${checklistId}`,
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function completeJobChecklistItem(
  jobId: string,
  checklistId: string,
  itemId: string,
): Promise<JobChecklistItem> {
  return authenticatedApiRequest<JobChecklistItem>(
    `/jobs/${jobId}/checklists/${checklistId}/items/${itemId}/complete`,
    {
      method: "PATCH",
    },
  );
}

export function reopenJobChecklistItem(
  jobId: string,
  checklistId: string,
  itemId: string,
): Promise<JobChecklistItem> {
  return authenticatedApiRequest<JobChecklistItem>(
    `/jobs/${jobId}/checklists/${checklistId}/items/${itemId}/reopen`,
    {
      method: "PATCH",
    },
  );
}

export function deleteJobChecklist(
  jobId: string,
  checklistId: string,
): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{ success: boolean }>(
    `/jobs/${jobId}/checklists/${checklistId}`,
    {
      method: "DELETE",
    },
  );
}
