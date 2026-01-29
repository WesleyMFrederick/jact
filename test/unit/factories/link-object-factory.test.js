import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { LinkObjectFactory } from "../../../src/factories/LinkObjectFactory.js";

describe("LinkObjectFactory - Header Link Creation", () => {
	it("should create header link with required LinkObject properties", () => {
		// Given: Target file path and header name from CLI input
		const targetPath = "/absolute/path/to/target.md";
		const headerName = "Section Header";

		// When: Create synthetic header link
		const factory = new LinkObjectFactory();
		const link = factory.createHeaderLink(targetPath, headerName);

		// Then: Link has required LinkObject structure
		// Verification: Matches parser output contract for header links
		expect(link.linkType).toBe("markdown");
		expect(link.scope).toBe("cross-document");
		expect(link.anchorType).toBe("header");
		expect(link.target.anchor).toBe(headerName);
		expect(link).not.toHaveProperty("validation"); // Omitted by factory
	});
});

describe("LinkObjectFactory - Path Resolution", () => {
	it("should resolve absolute path for target file in header links", () => {
		// Given: Relative target file path
		const relativePath = "./docs/target.md";
		const headerName = "Section";

		// When: Create header link
		const factory = new LinkObjectFactory();
		const link = factory.createHeaderLink(relativePath, headerName);

		// Then: Target path resolved to absolute
		// Verification: Path resolution enables validator file lookup
		expect(link.target.path.absolute).toBeTruthy();
		expect(link.target.path.absolute).toContain("docs/target.md");
		expect(link.target.path.raw).toBe(relativePath);
	});
});

describe("LinkObjectFactory - File Link Creation", () => {
	it("should create file link with anchorType null for full-file extraction", () => {
		// Given: Target file path (no anchor)
		const targetPath = "/absolute/path/to/file.md";

		// When: Create synthetic file link
		const factory = new LinkObjectFactory();
		const link = factory.createFileLink(targetPath);

		// Then: Link has full-file structure (no anchor)
		// Verification: anchorType: null signals full-file extraction
		expect(link.linkType).toBe("markdown");
		expect(link.scope).toBe("cross-document");
		expect(link.anchorType).toBeNull(); // Full-file indicator
		expect(link.target.anchor).toBeNull();
		expect(link).not.toHaveProperty("validation"); // Omitted by factory
	});
});

describe("LinkObjectFactory - File Link Path Resolution", () => {
	it("should resolve absolute path for target file in file links", () => {
		// Given: Relative target file path
		const relativePath = "./docs/complete-file.md";

		// When: Create file link
		const factory = new LinkObjectFactory();
		const link = factory.createFileLink(relativePath);

		// Then: Target path resolved to absolute
		expect(link.target.path.absolute).toBeTruthy();
		expect(link.target.path.absolute).toContain("docs/complete-file.md");
		expect(link.target.path.raw).toBe(relativePath);
	});
});
