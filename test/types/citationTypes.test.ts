// test/types/citationTypes.test.ts
import { describe, it, expect } from "vitest";
import type { LinkObject, ValidationMetadata, LinkScope, ValidationStatus } from "../../src/types/citationTypes";

describe("citationTypes", () => {
  it("should export LinkObject interface", () => {
    // Given: Type definitions imported
    // When: Create LinkObject instance
    const link: LinkObject = {
      rawSourceLink: "[test](file.md)",
      linkType: "markdown",
      scope: "internal",
      target: {
        path: { raw: "file.md", absolute: "/abs/file.md", relative: null },
        anchor: null
      },
      text: "test",
      fullMatch: "[test](file.md)",
      line: 1,
      column: 0
    };

    // Then: Object matches LinkObject contract
    // Verification: TypeScript compiles without errors
    expect(link).toBeDefined();
    expect(link.linkType).toBe("markdown");
  });

  it("should export LinkScope and ValidationStatus type aliases", () => {
    // Given: Type aliases imported
    // When: Assign to typed variables
    const scope: LinkScope = "internal";
    const status: ValidationStatus = "valid";

    // Then: TypeScript allows valid values
    expect(scope).toBe("internal");
    expect(status).toBe("valid");
  });
});
