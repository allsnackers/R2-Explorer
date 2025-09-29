// @ts-ignore
const fs = require("node:fs");
const path = require("node:path");

const WORKERS_CI = process.env.WORKERS_CI;
let R2EXPLORER_WORKER_NAME = process.env.R2EXPLORER_WORKER_NAME;
const R2EXPLORER_BUCKETS = process.env.R2EXPLORER_BUCKETS;
const R2EXPLORER_CONFIG = process.env.R2EXPLORER_CONFIG;
const R2EXPLORER_DOMAIN = process.env.R2EXPLORER_DOMAIN;
const CF_API_TOKEN = process.env.CF_API_TOKEN;

const actionDir = __dirname;
const repoRoot =
    WORKERS_CI === "1" && process.env.PWD
        ? process.env.PWD
        : path.resolve(actionDir, "..", "..");

if (WORKERS_CI === "1") {
    R2EXPLORER_WORKER_NAME = R2EXPLORER_WORKER_NAME || "r2-explorer";
} else if (!CF_API_TOKEN) {
    console.error("CF_API_TOKEN variable is required to continue!");
    process.exit(1);
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

for (const bucket of R2EXPLORER_BUCKETS.split("\n")) {
    const trimmed = bucket.trim();
    if (!trimmed) {
        continue;
    }

    const split = trimmed.split(":");
    if (split.length !== 2) {
        console.error("R2EXPLORER_BUCKETS is not set correctly!");
        console.error(
            `"${trimmed}" is not in the correct format => ALIAS:BUCKET_NAME`,
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
fs.writeFileSync(path.join(actionDir, "wrangler.toml"), wranglerConfig);

const srcDir = path.join(actionDir, "src");
if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
}

const relativeWorkerEntry = path.posix.join("..", "..", "worker", "dist", "index.mjs");
const indexContent = `
import { R2Explorer } from "${relativeWorkerEntry}";

export default R2Explorer(${R2EXPLORER_CONFIG});
`;

console.log("\nGenerated src/index.ts:");
console.log(indexContent);
fs.writeFileSync(path.join(srcDir, "index.ts"), indexContent);

const workerDistPath = path.join(repoRoot, "packages/worker/dist");
const dashboardDistPath = path.join(repoRoot, "packages/dashboard/dist/spa");

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
