import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobMaterialStatus = "REQUIRED" | "ORDERED" | "RECEIVED" | "CANCELLED";

export type JobMaterialUnit =
  | "EACH"
  | "FOOT"
  | "METER"
  | "SQUARE_FOOT"
  | "SQUARE_METER"
  | "CUBIC_FOOT"
  | "CUBIC_METER"
  | "POUND"
  | "KILOGRAM"
  | "LITER"
  | "GALLON"
  | "BOX"
  | "BAG"
  | "BUNDLE"
  | "ROLL"
  | "SHEET"
  | "OTHER";

export type JobMaterialCreatedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobMaterial = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;

  name: string;
  description: string | null;

  quantity: string;
  unit: JobMaterialUnit;

  supplier: string | null;
  sku: string | null;
  reference: string | null;
  notes: string | null;

  estimatedUnitCostCents: number | null;
  actualUnitCostCents: number | null;

  status: JobMaterialStatus;

  orderedAt: string | null;
  receivedAt: string | null;

  createdAt: string;
  updatedAt: string;

  createdBy: JobMaterialCreatedBy | null;
};

export type CreateJobMaterialInput = {
  name: string;
  description?: string;

  quantity: number;
  unit: JobMaterialUnit;

  supplier?: string;
  sku?: string;
  reference?: string;
  notes?: string;

  estimatedUnitCostCents?: number;
  actualUnitCostCents?: number;
};

export type UpdateJobMaterialInput = {
  name?: string;
  description?: string | null;

  quantity?: number;
  unit?: JobMaterialUnit;

  supplier?: string | null;
  sku?: string | null;
  reference?: string | null;
  notes?: string | null;

  estimatedUnitCostCents?: number | null;
  actualUnitCostCents?: number | null;
};

export function getJobMaterials(jobId: string): Promise<JobMaterial[]> {
  return authenticatedApiRequest<JobMaterial[]>(`/jobs/${jobId}/materials`);
}

export function getJobMaterial(jobId: string, materialId: string): Promise<JobMaterial> {
  return authenticatedApiRequest<JobMaterial>(`/jobs/${jobId}/materials/${materialId}`);
}

export function createJobMaterial(
  jobId: string,
  input: CreateJobMaterialInput,
): Promise<JobMaterial> {
  return authenticatedApiRequest<JobMaterial>(`/jobs/${jobId}/materials`, {
    method: "POST",
    body: input,
  });
}

export function updateJobMaterial(
  jobId: string,
  materialId: string,
  input: UpdateJobMaterialInput,
): Promise<JobMaterial> {
  return authenticatedApiRequest<JobMaterial>(`/jobs/${jobId}/materials/${materialId}`, {
    method: "PATCH",
    body: input,
  });
}

export function orderJobMaterial(
  jobId: string,
  materialId: string,
): Promise<JobMaterial> {
  return authenticatedApiRequest<JobMaterial>(
    `/jobs/${jobId}/materials/${materialId}/order`,
    {
      method: "PATCH",
    },
  );
}

export function receiveJobMaterial(
  jobId: string,
  materialId: string,
): Promise<JobMaterial> {
  return authenticatedApiRequest<JobMaterial>(
    `/jobs/${jobId}/materials/${materialId}/receive`,
    {
      method: "PATCH",
    },
  );
}

export function cancelJobMaterial(
  jobId: string,
  materialId: string,
): Promise<JobMaterial> {
  return authenticatedApiRequest<JobMaterial>(
    `/jobs/${jobId}/materials/${materialId}/cancel`,
    {
      method: "PATCH",
    },
  );
}

export function restoreJobMaterial(
  jobId: string,
  materialId: string,
): Promise<JobMaterial> {
  return authenticatedApiRequest<JobMaterial>(
    `/jobs/${jobId}/materials/${materialId}/restore`,
    {
      method: "PATCH",
    },
  );
}

export function deleteJobMaterial(
  jobId: string,
  materialId: string,
): Promise<{ success: true }> {
  return authenticatedApiRequest<{ success: true }>(
    `/jobs/${jobId}/materials/${materialId}`,
    {
      method: "DELETE",
    },
  );
}
