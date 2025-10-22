import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownParser } from '../src/MarkdownParser.js';
import fs from 'node:fs';
import path from 'node:path';

describe('MarkdownParser - Extraction Markers', () => {
  let parser;

  beforeEach(() => {
    parser = new MarkdownParser(fs);
  });

  it('should detect %%force-extract%% marker after link', async () => {
    // Given: Static fixture with force-extract marker
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-force-extract.md');

    // When: Parser processes file
    const result = await parser.parseFile(fixturePath);

    // Then: LinkObject has extractionMarker property
    expect(result.links).toHaveLength(1);
    expect(result.links[0].extractionMarker).toEqual({
      fullMatch: '%%force-extract%%',
      innerText: 'force-extract'
    });
  });

  it('should detect %%stop-extract-link%% marker', async () => {
    // Given: Static fixture with stop marker
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-stop-extract.md');

    // When: Parser processes file
    const result = await parser.parseFile(fixturePath);

    // Then: Marker detected with correct innerText
    expect(result.links[0].extractionMarker).toEqual({
      fullMatch: '%%stop-extract-link%%',
      innerText: 'stop-extract-link'
    });
  });

  it('should detect HTML comment marker', async () => {
    // Given: Static fixture with HTML comment
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-html-comment.md');

    // When: Parser processes file
    const result = await parser.parseFile(fixturePath);

    // Then: HTML comment marker detected
    expect(result.links[0].extractionMarker).toEqual({
      fullMatch: '<!-- force-extract -->',
      innerText: 'force-extract'
    });
  });

  it('should return null when no marker is present', async () => {
    // Given: Static fixture without markers
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-no-marker.md');

    // When: Parser processes file
    const result = await parser.parseFile(fixturePath);

    // Then: extractionMarker is null
    expect(result.links[0].extractionMarker).toBeNull();
  });

  it('should detect marker with whitespace between link and marker', async () => {
    // Given: Static fixture with spaces before marker
    const fixturePath = path.join(__dirname, 'fixtures/us2.1/parser-markers-whitespace.md');

    // When: Parser processes file
    const result = await parser.parseFile(fixturePath);

    // Then: Marker detected despite whitespace
    expect(result.links[0].extractionMarker.innerText).toBe('force-extract');
  });
});
