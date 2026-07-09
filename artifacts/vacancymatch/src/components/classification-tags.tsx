import { Badge } from "@/components/ui/badge";

const MAX_FAMILIES_SHOWN = 3;

/** Sector key → tinted chip utility class (defined in index.css). */
const SECTOR_CHIP_CLASSES: Record<string, string> = {
  insurance: "chip-sector-insurance",
  banking: "chip-sector-banking",
  pensions: "chip-sector-pensions",
  asset_management: "chip-sector-asset_management",
  accountancy_finance: "chip-sector-accountancy_finance",
  it_tech: "chip-sector-it_tech",
};

export function sectorChipClass(sector: string | null | undefined): string | null {
  if (!sector) return null;
  return SECTOR_CHIP_CLASSES[sector] ?? null;
}

interface ClassificationTagsProps {
  sectorLabel?: string | null;
  /** FinSector key (e.g. "insurance") — enables the per-sector tinted chip. */
  sector?: string | null;
  familyLabels?: string[] | null;
  /** Family keys aligned with familyLabels; required for clickable families. */
  familyKeys?: string[] | null;
  /** When provided, family tags become clickable (e.g. apply filter). */
  onFamilyClick?: (key: string, label: string) => void;
  className?: string;
}

/**
 * Sector + family classification tags for job/match cards.
 * Renders nothing when no classification is available — never invents labels.
 * Sector is more prominent (per-sector tinted pill); families are subtler;
 * max 3 families + "+N more".
 */
export function ClassificationTags({
  sectorLabel,
  sector,
  familyLabels,
  familyKeys,
  onFamilyClick,
  className,
}: ClassificationTagsProps) {
  if (!sectorLabel) return null;
  const labels = familyLabels ?? [];
  const shown = labels.slice(0, MAX_FAMILIES_SHOWN);
  const extra = labels.length - shown.length;
  const tint = sectorChipClass(sector);

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}
      data-testid="classification-tags"
    >
      <Badge
        variant="secondary"
        className={`text-xs font-medium ${tint ?? ""}`}
        data-testid="tag-sector"
      >
        {sectorLabel}
      </Badge>
      {shown.map((label, i) => {
        const key = familyKeys?.[i];
        const clickable = Boolean(onFamilyClick && key);
        return (
          <Badge
            key={key ?? label}
            variant="outline"
            data-testid={`tag-family-${key ?? label}`}
            className={`text-xs font-normal text-muted-foreground ${
              clickable ? "cursor-pointer hover:bg-accent hover:text-accent-foreground" : ""
            }`}
            onClick={
              clickable ? () => onFamilyClick!(key!, label) : undefined
            }
            role={clickable ? "button" : undefined}
          >
            {label}
          </Badge>
        );
      })}
      {extra > 0 && (
        <span className="text-xs text-muted-foreground" data-testid="tag-family-more">
          +{extra} more
        </span>
      )}
    </div>
  );
}
