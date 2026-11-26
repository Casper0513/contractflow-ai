import Image from "next/image";

type ContractFlowBrandProps = {
  compact?: boolean;
};

export function ContractFlowBrand({ compact = false }: ContractFlowBrandProps) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Image
        src="/contractflow-mark.svg"
        alt=""
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 shrink-0 object-contain"
      />

      <span className="flex min-w-0 flex-col">
        <span
          className={
            compact
              ? "truncate text-sm font-bold leading-tight tracking-tight"
              : "truncate text-base font-bold leading-tight tracking-tight"
          }
        >
          ContractFlow AI
        </span>

        <span
          className={
            compact
              ? "mt-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              : "mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          }
        >
          Business Management Software
        </span>
      </span>
    </span>
  );
}
