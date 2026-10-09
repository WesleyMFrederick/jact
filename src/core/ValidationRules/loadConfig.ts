/**
 * Validation config: a user file (`$XDG_CONFIG_HOME/jact/config.json`, else
 * `~/.config/jact/config.json`) overridden by the nearest `.jact/config.json`
 * walking up from each checked file. Only the user file may list plugins:
 * a project config can arrive in a downloaded repo, and plugins run code.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type {
	RuleSet,
	RuleSetResolver,
} from "../../types/validationRuleTypes.js";
import { loadPlugin } from "./loadPlugins.js";
import { DEFAULT_PRESET, RuleRegistry, type RuleSetting } from "./presets.js";

/** Project config inside the per-folder `.jact/` directory jact already uses for its cache. */
export const PROJECT_CONFIG_PATH = path.join(".jact", "config.json");

interface JactConfig {
	preset?: string;
	rules: Record<string, RuleSetting>;
	plugins: string[];
}

interface ConfigLayer {
	path: string;
	config: JactConfig;
}

/** The user config path: `$XDG_CONFIG_HOME/jact/config.json`, else `~/.config/jact/config.json`. */
export function defaultUserConfigPath(): string {
	const configHome =
		// biome-ignore lint/complexity/useLiteralKeys: tsconfig noPropertyAccessFromIndexSignature
		process.env["XDG_CONFIG_HOME"] || path.join(homedir(), ".config");
	return path.join(configHome, "jact", "config.json");
}

/** Read and check one config file; null when it does not exist. */
function readConfigFile(filePath: string): ConfigLayer | null {
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(filePath, "utf8"));
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return null;
		}
		throw new Error(
			`Invalid config ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
	const bad = (key: string, expected: string) =>
		new Error(`Invalid config ${filePath}: "${key}" must be ${expected}`);
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
		throw new Error(`Invalid config ${filePath}: expected a JSON object`);
	}

	const config: JactConfig = { rules: {}, plugins: [] };
	for (const [key, value] of Object.entries(raw)) {
		if (key === "preset") {
			if (typeof value !== "string") throw bad(key, "a string");
			config.preset = value;
		} else if (key === "rules") {
			if (typeof value !== "object" || value === null || Array.isArray(value)) {
				throw bad(key, 'an object of rule IDs to "off" or "error"');
			}
			for (const [ruleId, setting] of Object.entries(value)) {
				if (setting !== "off" && setting !== "error") {
					throw bad(`rules.${ruleId}`, '"off" or "error"');
				}
				config.rules[ruleId] = setting;
			}
		} else if (key === "plugins") {
			if (
				!Array.isArray(value) ||
				!value.every((plugin: unknown) => typeof plugin === "string")
			) {
				throw bad(key, "an array of module paths or package names");
			}
			config.plugins = value;
		} else {
			throw new Error(`Invalid config ${filePath}: unknown key "${key}"`);
		}
	}
	return { path: filePath, config };
}

/** The nearest `.jact/config.json` in the file's folder or an ancestor, or null. */
function findProjectConfig(filePath: string): string | null {
	let dir = path.dirname(path.resolve(filePath));
	for (;;) {
		const candidate = path.join(dir, PROJECT_CONFIG_PATH);
		if (existsSync(candidate)) return candidate;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/** Build the enabled rule set from the user layer and an optional project layer. */
async function buildRuleSet(layers: ConfigLayer[]): Promise<RuleSet> {
	const registry = new RuleRegistry();
	const registered = new Set<string>();
	for (const layer of layers) {
		for (const specifier of layer.config.plugins) {
			const { url, plugin } = await loadPlugin(
				specifier,
				path.dirname(layer.path),
			);
			// The same plugin listed in both files registers once.
			if (registered.has(url)) continue;
			registered.add(url);
			registry.register(plugin, `Plugin "${specifier}"`);
		}
	}

	for (const layer of layers) {
		const { preset, rules } = layer.config;
		if (preset !== undefined && !registry.presets.has(preset)) {
			throw new Error(
				`Invalid config ${layer.path}: unknown preset "${preset}" (known: ${[...registry.presets].join(", ")})`,
			);
		}
		for (const ruleId of Object.keys(rules)) {
			if (!registry.rules.has(ruleId)) {
				throw new Error(
					`Invalid config ${layer.path}: unknown rule "${ruleId}" in "rules"`,
				);
			}
		}
	}

	// Later layers (project) override earlier ones (user).
	let preset = DEFAULT_PRESET;
	let settings: Record<string, RuleSetting> = {};
	for (const layer of layers) {
		preset = layer.config.preset ?? preset;
		settings = { ...settings, ...layer.config.rules };
	}
	return registry.resolve(preset, settings);
}

/**
 * Create a per-file rule set lookup. The user config is read once; each
 * distinct nearest `.jact/config.json` builds its rule set once. Bad config or
 * plugins reject with an error naming the file or plugin.
 */
export function createRuleSetResolver(
	options: { userConfigPath?: string } = {},
): RuleSetResolver {
	const userConfigPath = options.userConfigPath ?? defaultUserConfigPath();
	let userLayer: ConfigLayer | null | undefined;
	const byProjectConfig = new Map<string, Promise<RuleSet>>();

	return async (filePath) => {
		userLayer ??= readConfigFile(userConfigPath);
		const projectConfigPath = findProjectConfig(filePath) ?? "";
		let ruleSet = byProjectConfig.get(projectConfigPath);
		if (ruleSet === undefined) {
			const projectLayer =
				projectConfigPath === "" ? null : readConfigFile(projectConfigPath);
			if (projectLayer && projectLayer.config.plugins.length > 0) {
				throw new Error(
					`Invalid config ${projectConfigPath}: a project config cannot list "plugins" because plugins run code; add them to your personal config (${userConfigPath})`,
				);
			}
			ruleSet = buildRuleSet(
				[userLayer, projectLayer].filter((layer) => layer !== null),
			);
			byProjectConfig.set(projectConfigPath, ruleSet);
		}
		return ruleSet;
	};
}
