import {
  Archive,
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  History,
  Pencil,
  Receipt,
  RotateCcw,
  Sparkles,
  UserPlus,
} from "lucide-react";

type ActivityIconProps = {
  type: string;
};

export function ActivityIcon({ type }: ActivityIconProps) {
  const visual = getVisual(type);

  const Icon = visual.icon;

  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full border ${visual.className}`}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

function getVisual(type: string) {
  switch (type) {
    case "CUSTOMER_CREATED":
      return {
        icon: UserPlus,
        className: "border-green-500/30 bg-green-500/10 text-green-600",
      };

    case "CUSTOMER_UPDATED":
      return {
        icon: Pencil,
        className: "border-blue-500/30 bg-blue-500/10 text-blue-600",
      };

    case "CUSTOMER_ARCHIVED":
      return {
        icon: Archive,
        className: "border-orange-500/30 bg-orange-500/10 text-orange-600",
      };

    case "CUSTOMER_RESTORED":
      return {
        icon: RotateCcw,
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
      };

    case "JOB_CREATED":
      return {
        icon: BriefcaseBusiness,
        className: "border-purple-500/30 bg-purple-500/10 text-purple-600",
      };

    case "ESTIMATE_CREATED":
      return {
        icon: FileText,
        className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
      };

    case "INVOICE_CREATED":
      return {
        icon: Receipt,
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600",
      };

    case "PAYMENT_RECEIVED":
      return {
        icon: CircleDollarSign,
        className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
      };

    case "AI_ACTIVITY":
      return {
        icon: Sparkles,
        className: "border-violet-500/30 bg-violet-500/10 text-violet-600",
      };

    default:
      return {
        icon: History,
        className: "border-muted bg-muted text-muted-foreground",
      };
  }
}
