// @ts-ignore
const fs = require("node:fs");
const path = require("node:path");

const WORKERS_CI = process.env.WORKERS_CI;
let R2EXPLORER_WORKER_NAME = process.env.R2EXPLORER_WORKER_NAME;
const R2EXPLORER_BUCKETS = process.env.R2EXPLORER_BUCKETS;
const R2EXPLORER_CONFIG = process.env.R2EXPLORER_CONFIG;
const R2EXPLORER_DOMAIN = process.env.R2EXPLORER_DOMAIN;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

let baseDir = __dirname;
if (WORKERS_CI === "1") {
	baseDir = process.env.PWD;
	R2EXPLORER_WORKER_NAME = R2EXPLORER_WORKER_NAME || "r2-explorer";
} else {
	if (!CF_API_TOKEN) {
		console.error("CF_API_TOKEN variable is required to continue!");
		process.exit(1);
	}
}

if (!R2EXPLORER_WORKER_NAME) {
	console.error("R2EXPLORER_WORKER_NAME variable is required to continue!");
	process.exit(1);
}

if (!R2EXPLORER_BUCKETS) {
	console.error("R2EXPLORER_BUCKETS variable is required to continue!");
	process.exit(1);
}

if (!R2EXPLORER_CONFIG) {
	console.error("R2EXPLORER_CONFIG variable is required to continue!");
	process.exit(1);
}

// Generate wrangler.toml configuration
let wranglerConfig = `
name = "${R2EXPLORER_WORKER_NAME}"
compatibility_date = "2024-11-06"
main = "src/index.ts"
assets = { directory = "../../packages/dashboard/dist/spa", binding = "ASSETS", html_handling = "auto-trailing-slash", not_found_handling = "single-page-application" }
`;

if (R2EXPLORER_DOMAIN) {
	wranglerConfig += `
workers_dev = false
routes = [
  { pattern = "${R2EXPLORER_DOMAIN}", custom_domain = true }
]
`;
} else {
	wranglerConfig += `
workers_dev = true
`;
}

// Add R2 bucket bindings
for (const bucket of R2EXPLORER_BUCKETS.split("\n")) {
	const split = bucket.trim().split(":");
	if (split.length !== 2) {
		console.error("R2EXPLORER_BUCKETS is not set correctly!");
		console.error(
			`"${split}" is not in the correct format => ALIAS:BUCKET_NAME`,
		);
		process.exit(1);
	}

	wranglerConfig += `
[[r2_buckets]]
binding = '${split[0]}'
bucket_name = '${split[1]}'
preview_bucket_name = '${split[1]}'
`;
}

console.log("Generated wrangler.toml:");
console.log(wranglerConfig);
fs.writeFileSync(`${baseDir}/wrangler.toml`, wranglerConfig);

// Create src directory if it doesn't exist
if (!fs.existsSync(`${baseDir}/src/`)) {
	fs.mkdirSync(`${baseDir}/src/`);
}

// Create index.ts that imports from the local build
const indexContent = `
import { R2Explorer } from "../../worker/dist/index.mjs";

export default R2Explorer(${R2EXPLORER_CONFIG});
`;

console.log("\nGenerated src/index.ts:");
console.log(indexContent);
fs.writeFileSync(`${baseDir}/src/index.ts`, indexContent);

// Copy necessary files from the built worker package
const workerDistPath = path.join(baseDir, "../../packages/worker/dist");
const dashboardDistPath = path.join(baseDir, "../../packages/dashboard/dist/spa");

// Verify that the build artifacts exist
if (!fs.existsSync(workerDistPath)) {
	console.error("Worker build artifacts not found! Please run 'pnpm build-worker' first.");
	process.exit(1);
}

if (!fs.existsSync(dashboardDistPath)) {
	console.error("Dashboard build artifacts not found! Please run 'pnpm build-dashboard' first.");
	process.exit(1);
}

console.log("\n✅ Deployment preparation complete!");
console.log("Worker dist path:", workerDistPath);
console.log("Dashboard dist path:", dashboardDistPath);