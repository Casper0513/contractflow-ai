import type { JobMaterialStatus, JobMaterialUnit } from "@/lib/job-materials-api";

export const JOB_MATERIAL_UNITS: Array<{
  value: JobMaterialUnit;
  label: string;
}> = [
  { value: "EACH", label: "Each" },
  { value: "FOOT", label: "Foot" },
  { value: "METER", label: "Meter" },
  { value: "SQUARE_FOOT", label: "Square foot" },
  { value: "SQUARE_METER", label: "Square meter" },
  { value: "CUBIC_FOOT", label: "Cubic foot" },
  { value: "CUBIC_METER", label: "Cubic meter" },
  { value: "POUND", label: "Pound" },
  { value: "KILOGRAM", label: "Kilogram" },
  { value: "LITER", label: "Liter" },
  { value: "GALLON", label: "Gallon" },
  { value: "BOX", label: "Box" },
  { value: "BAG", label: "Bag" },
  { value: "BUNDLE", label: "Bundle" },
  { value: "ROLL", label: "Roll" },
  { value: "SHEET", label: "Sheet" },
  { value: "OTHER", label: "Other" },
];

export const JOB_MATERIAL_STATUSES: Array<{
  value: JobMaterialStatus;
  label: string;
}> = [
  { value: "REQUIRED", label: "Required" },
  { value: "ORDERED", label: "Ordered" },
  { value: "RECEIVED", label: "Received" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function getJobMaterialUnitLabel(unit: JobMaterialUnit) {
  return JOB_MATERIAL_UNITS.find((item) => item.value === unit)?.label ?? unit;
}

export function getJobMaterialStatusLabel(status: JobMaterialStatus) {
  return JOB_MATERIAL_STATUSES.find((item) => item.value === status)?.label ?? status;
}
