import { Badge } from "@/components/ui/badge";

const MAX_FAMILIES_SHOWN = 3;

interface ClassificationTagsProps {
  sectorLabel?: string | null;
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
 * Sector is more prominent; families are subtler; max 3 families + "+N more".
 */
export function ClassificationTags({
  sectorLabel,
  familyLabels,
  familyKeys,
  onFamilyClick,
  className,
}: ClassificationTagsProps) {
  if (!sectorLabel) return null;
  const labels = familyLabels ?? [];
  const shown = labels.slice(0, MAX_FAMILIES_SHOWN);
  const extra = labels.length - shown.length;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}
      data-testid="classification-tags"
    >
      <Badge
        variant="secondary"
        className="text-xs font-medium"
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
