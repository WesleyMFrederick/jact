import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Use Node.js environment for file system testing
		environment: "node",

		// Test file patterns
		include: ["test/**/*.test.{js,ts}"],
		exclude: ["node_modules/**", "dist/**"],

		// Use forks for better CommonJS isolation
		pool: "forks",

		// Pool configuration for memory management (Vitest 4+ top-level options)
		maxForks: 4, // Controlled parallelism
		minForks: 1,

		// Force exit after tests complete to prevent hanging worker processes
		forceExit: true,

		// Timeout settings for file system operations
		testTimeout: 10000,
		hookTimeout: 10000,

		// Disable globals to ensure explicit imports
		globals: false,

		// Coverage configuration
		coverage: {
			provider: "c8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/**",
				"test/**",
				"coverage/**",
				"dist/**",
				"*.config.js",
			],
		},

		// Setup files for test utilities
		setupFiles: ["./test/setup.js"],

		// Reporter configuration
		reporter: ["default"],

		// Bail on first failure for CI
		bail: process.env.CI ? 1 : 0,
	},
});
