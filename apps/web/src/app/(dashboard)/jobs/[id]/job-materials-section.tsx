import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Estimate } from "@/lib/estimates-api";
import type { Invoice } from "@/lib/invoices-api";
import type { JobMaterial } from "@/lib/job-materials-api";

import { JobMaterialEstimatePanel } from "./job-material-estimate-panel";
import { JobMaterialForm } from "./job-material-form";
import { JobMaterialInvoicePanel } from "./job-material-invoice-panel";
import { JobMaterialList } from "./job-material-list";

type JobMaterialsSectionProps = {
  jobId: string;
  archived: boolean;
  materials: JobMaterial[];
  estimates: Estimate[];
  invoices: Invoice[];
  currency: string;
};

export function JobMaterialsSection({
  jobId,
  archived,
  materials,
  estimates,
  invoices,
  currency,
}: JobMaterialsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Materials</CardTitle>

            <CardDescription className="mt-1">
              Track required materials, purchasing, receiving, suppliers, and material
              costs.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">
            {materials.length} material
            {materials.length === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!archived && <JobMaterialForm jobId={jobId} currency={currency} />}

        {!archived && (
          <JobMaterialEstimatePanel
            jobId={jobId}
            materials={materials}
            estimates={estimates}
            currency={currency}
          />
        )}

        {!archived && (
          <JobMaterialInvoicePanel
            jobId={jobId}
            materials={materials}
            invoices={invoices}
            currency={currency}
          />
        )}

        <JobMaterialList jobId={jobId} materials={materials} currency={currency} />
      </CardContent>
    </Card>
  );
}
