import { OpenAPIRoute } from "chanfana";
import type { AppContext, DirectLinkSettings } from "../../types";

const SETTINGS_KEY = "direct-link-settings";

const DEFAULT_SETTINGS: DirectLinkSettings = {
	enabled: false,
	baseUrl: "",
	singleBucketMode: false,
};

export class GetSettings extends OpenAPIRoute {
	schema = {
		operationId: "get-settings",
		tags: ["Settings"],
		summary: "Get global settings",
		responses: {
			"200": {
				description: "Settings retrieved successfully",
			},
		},
	};

	async handle(c: AppContext) {
		const kv = c.env.R2_EXPLORER_SETTINGS;

		if (!kv) {
			// KV not configured, return defaults
			return {
				settings: DEFAULT_SETTINGS,
				persisted: false,
			};
		}

		try {
			const stored = await kv.get(SETTINGS_KEY, "json");
			if (stored) {
				return {
					settings: stored as DirectLinkSettings,
					persisted: true,
				};
			}
		} catch (e) {
			console.error("Failed to load settings from KV:", e);
		}

		return {
			settings: DEFAULT_SETTINGS,
			persisted: true,
		};
	}
}
