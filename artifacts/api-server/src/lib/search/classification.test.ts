import { describe, it, expect } from "vitest";
import {
  SECTOR_LABELS,
  classificationFromTags,
  classifyJobForDisplay,
  classifyCandidateForDisplay,
} from "./classification";
import { FIN_SECTORS } from "./finTaxonomy";
import { DISPLAY_FAMILIES } from "../../config/curatedTitles/displayFamilies";

describe("SECTOR_LABELS", () => {
  it("covers every sector with a human-friendly label", () => {
    for (const sector of FIN_SECTORS) {
      const label = SECTOR_LABELS[sector];
      expect(label).toBeTruthy();
      // No raw internal keys leaking into the UI
      expect(label).not.toContain("_");
    }
    expect(SECTOR_LABELS.it_tech).toBe("IT & Tech");
    expect(SECTOR_LABELS.accountancy_finance).toBe("Accountancy & Finance");
  });
});

describe("classificationFromTags", () => {
  it("returns null when no sector is classified", () => {
    expect(classificationFromTags(null, "software_engineering", [])).toBeNull();
  });

  it("returns sector-only classification when no family matches", () => {
    // A sector with an fn that maps to no display family of that sector
    const cls = classificationFromTags("insurance", null, []);
    expect(cls).not.toBeNull();
    expect(cls?.sector).toBe("insurance");
    expect(cls?.sectorLabel).toBe("Insurance");
    expect(cls?.families).toEqual([]);
    expect(cls?.familyLabels).toEqual([]);
  });

  it("maps fn and curated tags to display families with aligned labels", () => {
    const cls = classificationFromTags("insurance", "claims", []);
    expect(cls?.families).toContain("claims");
    const idx = cls!.families.indexOf("claims");
    expect(cls!.familyLabels[idx]).toBe("Claims");
    expect(cls!.families.length).toBe(cls!.familyLabels.length);
  });

  it("only returns families belonging to the classified sector", () => {
    const cls = classificationFromTags("banking", null, ["investment_banking"]);
    const bankingKeys = DISPLAY_FAMILIES.banking.map((df) => df.key);
    for (const key of cls?.families ?? []) {
      expect(bankingKeys).toContain(key);
    }
    expect(cls?.families).toContain("investment_banking");
  });
});

describe("classifyJobForDisplay", () => {
  it("classifies a curated IT title with sector and family labels", () => {
    const cls = classifyJobForDisplay({ title: "Senior Software Engineer" });
    expect(cls?.sector).toBe("it_tech");
    expect(cls?.sectorLabel).toBe("IT & Tech");
    expect(cls?.families).toContain("software_engineering");
    expect(cls?.familyLabels).toContain("Software Engineering");
  });

  it("classifies an insurance role", () => {
    const cls = classifyJobForDisplay({ title: "Claims Handler" });
    expect(cls?.sector).toBe("insurance");
    expect(cls?.familyLabels).toContain("Claims");
  });

  it("returns null for generic non-FS roles rather than inventing labels", () => {
    expect(
      classifyJobForDisplay({ title: "Warehouse Supervisor" }),
    ).toBeNull();
    expect(classifyJobForDisplay({ title: "Business Analyst" })).toBeNull();
  });
});

describe("classifyCandidateForDisplay", () => {
  it("classifies a candidate from their current title", () => {
    const cls = classifyCandidateForDisplay({
      currentTitle: "Claims Handler",
      currentCompany: null,
      titles: [],
      skills: [],
      industries: ["insurance"],
    });
    expect(cls?.sector).toBe("insurance");
    expect(cls?.familyLabels).toContain("Claims");
  });

  it("returns null when the candidate has no classifiable background", () => {
    const cls = classifyCandidateForDisplay({
      currentTitle: "Store Manager",
      currentCompany: null,
      titles: [],
      skills: ["retail"],
      industries: ["retail"],
    });
    expect(cls).toBeNull();
  });
});
