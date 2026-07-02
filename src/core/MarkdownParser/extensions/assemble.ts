/**
 * Purpose: Assemble jact's micromark syntax + mdast extension sets so the parser
 *   (and factory) inject one combined unit.
 * Responsibilities: Compose the Flavor Extension Collection (`flavors.ts`) into
 *   one syntax extension + one ordered mdast list. Adding a construct = register
 *   its triple in the right flavor group in `flavors.ts` — not here.
 * Boundary: No tokenization logic here — only composition.
 */

import type { Extension as MdastExtension } from "mdast-util-from-markdown";
import { combineExtensions } from "micromark-util-combine-extensions";
import type { Extension } from "micromark-util-types";
import { allFlavors } from "./flavors.js";

/** Combined micromark syntax extension across all jact flavor groups. */
export function jactSyntaxExtension(): Extension {
	return combineExtensions(allFlavors.flatMap((flavor) => flavor.syntax));
}

/** fromMarkdown extensions across all jact flavor groups (order-aligned). */
export function jactMdastExtensions(): MdastExtension[] {
	return allFlavors.flatMap((flavor) => flavor.fromMarkdown);
}
