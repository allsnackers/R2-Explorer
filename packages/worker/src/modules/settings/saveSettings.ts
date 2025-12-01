import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, DirectLinkSettings } from "../../types";

const SETTINGS_KEY = "direct-link-settings";

const DirectLinkSettingsSchema = z.object({
	enabled: z.boolean(),
	baseUrl: z.string(),
	singleBucketMode: z.boolean(),
});

export class SaveSettings extends OpenAPIRoute {
	schema = {
		operationId: "save-settings",
		tags: ["Settings"],
		summary: "Save global settings",
		request: {
			body: contentJson(DirectLinkSettingsSchema),
		},
		responses: {
			"200": {
				description: "Settings saved successfully",
			},
			"500": {
				description: "KV storage not configured",
			},
		},
	};

	async handle(c: AppContext) {
		const kv = c.env.R2_EXPLORER_SETTINGS;

		if (!kv) {
			return c.json(
				{
					success: false,
					error:
						"Settings storage not configured. Please add R2_EXPLORER_SETTINGS KV namespace binding to your wrangler.toml.",
				},
				500,
			);
		}

		const body = await this.getValidatedData<{
			body: DirectLinkSettings;
		}>();
		const settings = body.body;

		// Clean up the baseUrl (remove trailing slashes)
		settings.baseUrl = settings.baseUrl.replace(/\/+$/, "");
		settings.singleBucketMode = Boolean(settings.singleBucketMode);

		try {
			await kv.put(SETTINGS_KEY, JSON.stringify(settings));
			return {
				success: true,
				settings: settings,
			};
		} catch (e) {
			console.error("Failed to save settings to KV:", e);
			return c.json(
				{
					success: false,
					error: "Failed to save settings",
				},
				500,
			);
		}
	}
}
