import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		testTimeout: 30000,
		exclude: [...configDefaults.exclude, ".claude/**", ".scratch/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			reportsDirectory: "./coverage",
			reportOnFailure: true,
			exclude: [
				"node_modules/**",
				"test/**",
				"coverage/**",
				"dist/**",
				"*.config.js",
			],
		},
	},
});
