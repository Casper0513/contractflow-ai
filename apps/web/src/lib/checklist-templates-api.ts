import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type ChecklistTemplateItem = {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  position: number;
  required: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistTemplate = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  items: ChecklistTemplateItem[];
};

export type ChecklistTemplateItemInput = {
  title: string;
  description?: string;
  position?: number;
  required?: boolean;
};

export type CreateChecklistTemplateInput = {
  name: string;
  description?: string;
  active?: boolean;
  items?: ChecklistTemplateItemInput[];
};

export type UpdateChecklistTemplateInput = {
  name?: string;
  description?: string;
  active?: boolean;
  items?: ChecklistTemplateItemInput[];
};

export function getChecklistTemplates(): Promise<ChecklistTemplate[]> {
  return authenticatedApiRequest<ChecklistTemplate[]>("/checklist-templates");
}

export function getChecklistTemplate(templateId: string): Promise<ChecklistTemplate> {
  return authenticatedApiRequest<ChecklistTemplate>(`/checklist-templates/${templateId}`);
}

export function createChecklistTemplate(
  input: CreateChecklistTemplateInput,
): Promise<ChecklistTemplate> {
  return authenticatedApiRequest<ChecklistTemplate>("/checklist-templates", {
    method: "POST",
    body: input,
  });
}

export function updateChecklistTemplate(
  templateId: string,
  input: UpdateChecklistTemplateInput,
): Promise<ChecklistTemplate> {
  return authenticatedApiRequest<ChecklistTemplate>(
    `/checklist-templates/${templateId}`,
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function activateChecklistTemplate(
  templateId: string,
): Promise<ChecklistTemplate> {
  return authenticatedApiRequest<ChecklistTemplate>(
    `/checklist-templates/${templateId}/activate`,
    {
      method: "PATCH",
    },
  );
}

export function deactivateChecklistTemplate(
  templateId: string,
): Promise<ChecklistTemplate> {
  return authenticatedApiRequest<ChecklistTemplate>(
    `/checklist-templates/${templateId}/deactivate`,
    {
      method: "PATCH",
    },
  );
}

export function deleteChecklistTemplate(
  templateId: string,
): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{ success: boolean }>(
    `/checklist-templates/${templateId}`,
    {
      method: "DELETE",
    },
  );
}
