import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMarkdownParser } from '../src/factories/componentFactory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('MarkdownParser Output Contract', () => {
	it('should return complete Parser Output Contract with all fields', async () => {
		// Given: Factory-created parser with test fixture
		const parser = createMarkdownParser();
		const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

		// When: Parsing file
		const result = await parser.parseFile(testFile);

		// Then: All contract fields present with correct types
		expect(result).toHaveProperty('filePath');
		expect(result).toHaveProperty('content');
		expect(result).toHaveProperty('tokens');
		expect(result).toHaveProperty('links');
		expect(result).toHaveProperty('headings');
		expect(result).toHaveProperty('anchors');

		expect(typeof result.filePath).toBe('string');
		expect(typeof result.content).toBe('string');
		expect(Array.isArray(result.tokens)).toBe(true);
		expect(Array.isArray(result.links)).toBe(true);
		expect(Array.isArray(result.headings)).toBe(true);
		expect(Array.isArray(result.anchors)).toBe(true);
	});

	it('should populate headings array with level, text, raw properties', async () => {
		// Given: Parser with fixture containing headings
		const parser = createMarkdownParser();
		const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

		// When: Parse file
		const result = await parser.parseFile(testFile);

		// Then: Headings have required structure
		expect(result.headings.length).toBeGreaterThan(0);

		const heading = result.headings[0];
		expect(heading).toHaveProperty('level');
		expect(heading).toHaveProperty('text');
		expect(heading).toHaveProperty('raw');

		expect(typeof heading.level).toBe('number');
		expect(typeof heading.text).toBe('string');
		expect(typeof heading.raw).toBe('string');
		expect(heading.level).toBeGreaterThanOrEqual(1);
		expect(heading.level).toBeLessThanOrEqual(6);
	});

	it('should populate anchors array with type, anchor, text, line properties', async () => {
		// Given: Parser with fixture containing caret anchors
		const parser = createMarkdownParser();
		const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

		// When: Parse file
		const result = await parser.parseFile(testFile);

		// Then: Anchors have required structure
		expect(result.anchors.length).toBeGreaterThan(0);

		// Find a caret anchor (like ^FR1)
		const caretAnchor = result.anchors.find(a => a.type === 'caret' || a.type === 'obsidian-block-ref');
		expect(caretAnchor).toBeDefined();
		expect(caretAnchor).toHaveProperty('type');
		expect(caretAnchor).toHaveProperty('anchor');
		expect(caretAnchor).toHaveProperty('line');

		expect(typeof caretAnchor.type).toBe('string');
		expect(typeof caretAnchor.anchor).toBe('string');
		expect(typeof caretAnchor.line).toBe('number');
		expect(caretAnchor.line).toBeGreaterThan(0);
	});

	it('should populate links array with type, text, file, anchor, fullMatch, line properties', async () => {
		// Given: Parser with fixture containing cross-document links
		const parser = createMarkdownParser();
		const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

		// When: Parse file
		const result = await parser.parseFile(testFile);

		// Then: Links have required structure
		expect(result.links.length).toBeGreaterThan(0);

		const link = result.links[0];
		expect(link).toHaveProperty('type');
		expect(link).toHaveProperty('text');
		expect(link).toHaveProperty('file');
		expect(link).toHaveProperty('fullMatch');
		expect(link).toHaveProperty('line');

		expect(typeof link.type).toBe('string');
		expect(typeof link.fullMatch).toBe('string');
		expect(typeof link.line).toBe('number');
		expect(link.line).toBeGreaterThan(0);

		// text and file can be string or null depending on link type
		if (link.text !== null) {
			expect(typeof link.text).toBe('string');
		}
		if (link.file !== null) {
			expect(typeof link.file).toBe('string');
		}
	});

	it('should validate headings extracted from complex header fixture', async () => {
		// Given: Parser with complex headers fixture
		const parser = createMarkdownParser();
		const testFile = join(__dirname, 'fixtures', 'complex-headers.md');

		// When: Parse file
		const result = await parser.parseFile(testFile);

		// Then: All headings properly extracted with correct levels
		expect(result.headings.length).toBeGreaterThan(0);

		// Verify at least one heading has expected structure
		const h1Heading = result.headings.find(h => h.level === 1);
		if (h1Heading) {
			expect(h1Heading.level).toBe(1);
			expect(h1Heading.text).toBeTruthy();
			expect(h1Heading.raw).toContain('#');
		}

		// Verify heading levels are valid (1-6)
		result.headings.forEach(heading => {
			expect(heading.level).toBeGreaterThanOrEqual(1);
			expect(heading.level).toBeLessThanOrEqual(6);
		});
	});

	it('should validate parser output matches documented contract schema', async () => {
		// Given: Parser with any valid fixture
		const parser = createMarkdownParser();
		const testFile = join(__dirname, 'fixtures', 'valid-citations.md');

		// When: Parse file
		const result = await parser.parseFile(testFile);

		// Then: Output matches the documented Parser Output Contract
		// Required top-level fields per contract
		const requiredFields = ['filePath', 'content', 'tokens', 'links', 'headings', 'anchors'];
		requiredFields.forEach(field => {
			expect(result).toHaveProperty(field);
		});

		// Verify no unexpected additional fields at top level
		const actualFields = Object.keys(result);
		expect(actualFields.sort()).toEqual(requiredFields.sort());

		// Verify filePath is absolute
		expect(result.filePath).toContain(__dirname);

		// Verify content is non-empty string
		expect(result.content.length).toBeGreaterThan(0);
	});
});
