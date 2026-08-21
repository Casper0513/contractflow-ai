import type { JobCostCategory } from "@/lib/job-costs-api";

export const JOB_COST_CATEGORIES: Array<{
  value: JobCostCategory;
  label: string;
}> = [
  {
    value: "MATERIAL",
    label: "Materials",
  },
  {
    value: "LABOR",
    label: "Labor",
  },
  {
    value: "SUBCONTRACTOR",
    label: "Subcontractor",
  },
  {
    value: "EQUIPMENT",
    label: "Equipment",
  },
  {
    value: "PERMIT",
    label: "Permit",
  },
  {
    value: "TRAVEL",
    label: "Travel",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];
