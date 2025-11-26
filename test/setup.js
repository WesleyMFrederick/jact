// Test setup file for Vitest
// This file runs before each test file

// Global test configuration
process.env.NODE_ENV = "test";

// Setup cleanup tracking for temporary directories
global.testCleanupCallbacks = [];

// Setup tracking for child processes spawned during tests
global.childProcesses = [];

// Cleanup function to kill child processes and run cleanup callbacks
const cleanup = () => {
	// Kill tracked child processes
	for (const child of global.childProcesses) {
		try {
			if (child && !child.killed) {
				child.kill("SIGTERM");
			}
		} catch (error) {
			// Process already dead, ignore
		}
	}

	// Run cleanup callbacks
	for (const callback of global.testCleanupCallbacks) {
		try {
			callback();
		} catch (error) {
			console.warn("Cleanup callback failed:", error.message);
		}
	}
};

// Register cleanup callback for process exit
process.on("exit", cleanup);

// Handle forced exits
process.on("SIGINT", () => {
	cleanup();
	process.exit(0);
});

process.on("SIGTERM", () => {
	cleanup();
	process.exit(0);
});
