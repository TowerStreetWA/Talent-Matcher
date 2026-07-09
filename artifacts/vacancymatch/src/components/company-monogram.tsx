import { sectorChipClass } from "@/components/classification-tags";
import { cn } from "@/lib/utils";

function monogramFrom(name: string | null | undefined): string {
  if (!name) return "?";
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

interface CompanyMonogramProps {
  companyName: string | null | undefined;
  /** FinSector key — picks the sector tint pair; neutral when absent. */
  sector?: string | null;
  className?: string;
}

/** 40px rounded-square company monogram for job cards. */
export function CompanyMonogram({ companyName, sector, className }: CompanyMonogramProps) {
  const tint = sectorChipClass(sector);
  return (
    <div
      aria-hidden="true"
      className={cn(
        "w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-sm font-semibold border",
        tint ?? "bg-secondary text-secondary-foreground border-transparent",
        className,
      )}
      data-testid="company-monogram"
    >
      {monogramFrom(companyName)}
    </div>
  );
}
