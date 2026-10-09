import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolve } from "import-meta-resolve";
import type { ValidationPlugin } from "../../types/validationRuleTypes.js";

/** A loaded plugin and the resolved URL that identifies it. */
export interface LoadedPlugin {
	url: string;
	plugin: ValidationPlugin;
}

/** Runtime shape check for a plugin module's default export. */
function isValidationPlugin(value: unknown): value is ValidationPlugin {
	if (typeof value !== "object" || value === null || !("rules" in value)) {
		return false;
	}
	const { rules } = value;
	const presets = "presets" in value ? value.presets : undefined;
	return (
		Array.isArray(rules) &&
		rules.every(
			(rule: unknown) =>
				typeof rule === "object" &&
				rule !== null &&
				"id" in rule &&
				typeof rule.id === "string" &&
				"preset" in rule &&
				typeof rule.preset === "string" &&
				"check" in rule &&
				typeof rule.check === "function",
		) &&
		(presets === undefined ||
			(Array.isArray(presets) &&
				presets.every((preset: unknown) => typeof preset === "string")))
	);
}

/**
 * Import one plugin. `specifier` is a path (resolved from `baseDir`, the
 * config file's folder) or a package name. The module must default-export
 * `{ rules, presets? }`. Every failure throws an error naming the plugin.
 */
export async function loadPlugin(
	specifier: string,
	baseDir: string,
): Promise<LoadedPlugin> {
	let url: string;
	if (specifier.startsWith(".") || path.isAbsolute(specifier)) {
		const filePath = path.resolve(baseDir, specifier);
		if (!existsSync(filePath)) {
			throw new Error(`Plugin "${specifier}" not found: ${filePath}`);
		}
		url = pathToFileURL(filePath).href;
	} else {
		try {
			// ESM import conditions, as `import "<package>"` would resolve from the
			// config folder; `require.resolve` would reject import-only `exports`.
			url = resolve(
				specifier,
				pathToFileURL(path.join(baseDir, "jact-config.js")).href,
			);
		} catch {
			throw new Error(`Plugin "${specifier}" not found from ${baseDir}`);
		}
	}

	let module: unknown;
	try {
		// Plugin specifiers come from user config at runtime; Node caches by URL.
		module = await import(url);
	} catch (error) {
		throw new Error(
			`Plugin "${specifier}" failed to load: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const plugin =
		typeof module === "object" && module !== null && "default" in module
			? module.default
			: undefined;
	if (!isValidationPlugin(plugin)) {
		throw new Error(
			`Plugin "${specifier}" must default-export { rules: [{ id, preset, check }], presets?: string[] }`,
		);
	}
	return { url, plugin };
}
