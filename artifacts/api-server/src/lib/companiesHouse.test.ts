import { describe, expect, it } from "vitest";
import {
  CompaniesHouseError,
  describeSicCode,
  normalizeCompanyNumber,
} from "./companiesHouse";

describe("describeSicCode", () => {
  it("uses curated recruiter-readable descriptions for common codes", () => {
    expect(describeSicCode("62012")).toBe("Business & domestic software development");
    expect(describeSicCode("78109")).toBe("Recruitment agency / employment placement");
    expect(describeSicCode("78200")).toBe("Temporary staffing agency");
    expect(describeSicCode("64191")).toBe("Banks");
  });

  it("falls back to division-level sector labels", () => {
    expect(describeSicCode("62050")).toBe("Software & IT services");
    expect(describeSicCode("47110")).toBe("Retail trade");
    expect(describeSicCode("86900")).toBe("Healthcare");
  });

  it("handles special and unknown codes", () => {
    expect(describeSicCode("99999")).toBe("Dormant company");
    expect(describeSicCode("74990")).toBe("Non-trading company");
    expect(describeSicCode("00000")).toBe("Unclassified");
    expect(describeSicCode("XYZ")).toBe("Unclassified");
  });

  it("trims whitespace", () => {
    expect(describeSicCode(" 62020 ")).toBe("IT consultancy");
  });
});

describe("normalizeCompanyNumber", () => {
  it("accepts and uppercases valid company numbers", () => {
    expect(normalizeCompanyNumber("12345678")).toBe("12345678");
    expect(normalizeCompanyNumber("sc123456")).toBe("SC123456");
    expect(normalizeCompanyNumber(" ni012345 ")).toBe("NI012345");
  });

  it("rejects malformed company numbers", () => {
    for (const bad of ["", "123", "1234567890123", "12 345678", "../etc", "12345/78"]) {
      expect(() => normalizeCompanyNumber(bad)).toThrowError(CompaniesHouseError);
    }
  });
});
