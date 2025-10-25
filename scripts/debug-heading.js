import { MarkdownParser } from '../src/MarkdownParser.js';
import fs from 'fs';

const filePath = '/Users/wesleyfrederick/Documents/ObsidianVault/0_SoftwareDevelopment/cc-workflows/design-docs/Psuedocode Style Guide.md';

const parser = new MarkdownParser(fs);
const result = await parser.parseFile(filePath);

// Find the MEDIUM-IMPLEMENTATION heading
const heading = result.headings.find(h => h.text && h.text.includes('MEDIUM-IMPLEMENTATION'));

console.log('Heading object:', JSON.stringify(heading, null, 2));
console.log('\nHeading properties:', Object.keys(heading));
console.log('\nHeading.text:', heading.text);
console.log('Has slug property?', 'slug' in heading);
