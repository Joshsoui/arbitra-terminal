import { describe, expect, it } from "vitest";
import { matchCandidateToClusters, normalizeProductTerm, qualifyTrendCandidate, suggestCanonicalName, type ProductCluster } from "./product-identity";

describe("qualifyTrendCandidate", () => {
  it("recognizes a known multilingual product synonym with high confidence", () => {
    const result = qualifyTrendCandidate({ term: "Zwart Ijsbad", market: "NL", source: "google" });
    expect(result.label).toBe("PRODUCT");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.normalizedTerm).toBe("cold plunge");
  });

  it("rejects a trending term that is clearly not a product", () => {
    const result = qualifyTrendCandidate({ term: "US election results", market: "US", source: "google" });
    expect(result.label).toBe("NON_PRODUCT");
  });

  it("classifies an unfamiliar term as a product when it contains a known product noun", () => {
    const result = qualifyTrendCandidate({ term: "bluetooth speaker", market: "US", source: "google" });
    expect(result.label).toBe("PRODUCT");
    expect(result.reasons[0]).toMatch(/speaker/);
  });

  it("marks an ambiguous multi-word phrase with no strong hints for manual review", () => {
    const result = qualifyTrendCandidate({ term: "quick brown fox", market: "US", source: "google" });
    expect(result.label).toBe("REVIEW");
  });

  it("marks a single unrecognized token as low-confidence review rather than guessing", () => {
    const result = qualifyTrendCandidate({ term: "xyzzy", market: "US", source: "google" });
    expect(result.label).toBe("REVIEW");
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe("normalizeProductTerm", () => {
  it("strips color words and resolves the result to its canonical synonym", () => {
    expect(normalizeProductTerm("Zwart Ijsbad")).toEqual({ normalizedTerm: "cold plunge", canonicalTokens: ["cold", "plunge"] });
  });
});

describe("suggestCanonicalName", () => {
  it("title-cases the normalized/canonical form of a term", () => {
    expect(suggestCanonicalName("zwart ijsbad")).toBe("Cold Plunge");
  });
});

describe("matchCandidateToClusters", () => {
  const clusters: ProductCluster[] = [{ id: "c1", canonicalName: "Alpha Beta Gamma Delta", aliases: [], category: "Test" }];

  it("returns NO_MATCH when there are no clusters to compare against", () => {
    expect(matchCandidateToClusters({ term: "anything", market: "US", source: "google" }, [])).toMatchObject({
      decision: "NO_MATCH",
      clusterId: null,
    });
  });

  it("matches an identical term with a perfect score", () => {
    const result = matchCandidateToClusters({ term: "Alpha Beta Gamma Delta", market: "US", source: "google" }, clusters);
    expect(result.decision).toBe("MATCH");
    expect(result.score).toBe(1);
  });

  it("flags a partially overlapping term for manual review instead of auto-matching or discarding it", () => {
    // Shares 3 of 4 tokens with the cluster, in different order, with no substring
    // relationship — high but not certain similarity should land in REVIEW.
    const result = matchCandidateToClusters({ term: "Alpha Beta Gamma Epsilon", market: "US", source: "google" }, clusters);
    expect(result.decision).toBe("REVIEW");
    expect(result.score).toBeGreaterThanOrEqual(0.62);
    expect(result.score).toBeLessThan(0.86);
  });

  it("rejects a completely unrelated term", () => {
    const result = matchCandidateToClusters({ term: "Zzz Qqq Www Rrr", market: "US", source: "google" }, clusters);
    expect(result.decision).toBe("NO_MATCH");
  });
});
