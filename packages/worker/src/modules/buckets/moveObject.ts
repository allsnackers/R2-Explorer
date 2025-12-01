import { OpenAPIRoute } from "chanfana";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppContext } from "../../types";

export class MoveObject extends OpenAPIRoute {
	schema = {
		operationId: "post-bucket-move-object",
		tags: ["Buckets"],
		summary: "Move object",
		request: {
			params: z.object({
				bucket: z.string(),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							oldKey: z.string().describe("base64 encoded file key"),
							newKey: z.string().describe("base64 encoded file key"),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();

		const bucketName = data.params.bucket;
		const bucket = c.env[bucketName] as R2Bucket | undefined;

		if (!bucket) {
			throw new HTTPException(500, {
				message: `Bucket binding not found: ${bucketName}`,
			});
		}

		const oldKey = decodeURIComponent(escape(atob(data.body.oldKey)));
		const newKey = decodeURIComponent(escape(atob(data.body.newKey)));

		// Handle folder rename differently - folders end with /
		if (oldKey.endsWith("/")) {
			return await this.moveFolder(bucket, oldKey, newKey);
		}

		const object = await bucket.get(oldKey);

		if (object === null) {
			throw new HTTPException(404, {
				message: `Source object not found: ${oldKey}`,
			});
		}

		const resp = await bucket.put(newKey, object.body, {
			customMetadata: object.customMetadata,
			httpMetadata: object.httpMetadata,
		});

		await bucket.delete(oldKey);

		return resp;
	}

	private async moveFolder(bucket: R2Bucket, oldKey: string, newKey: string) {
		// List all objects with the old prefix
		const objects: R2Object[] = [];
		let cursor: string | undefined;

		do {
			const list = await bucket.list({
				prefix: oldKey,
				cursor,
			});
			objects.push(...list.objects);
			cursor = list.truncated ? list.cursor : undefined;
		} while (cursor);

		// Move each object to the new location
		for (const obj of objects) {
			const newObjKey = newKey + obj.key.slice(oldKey.length);
			const objData = await bucket.get(obj.key);

			if (objData) {
				await bucket.put(newObjKey, objData.body, {
					customMetadata: objData.customMetadata,
					httpMetadata: objData.httpMetadata,
				});
			} else {
				// Handle empty folder markers
				await bucket.put(newObjKey, "");
			}

			await bucket.delete(obj.key);
		}

		// If no objects existed (empty folder), create the new folder marker
		if (objects.length === 0) {
			await bucket.put(newKey, "");
			// Try to delete the old folder marker
			await bucket.delete(oldKey);
		}

		return { success: true, moved: objects.length };
	}
}
