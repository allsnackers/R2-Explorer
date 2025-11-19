import { OpenAPIRoute } from "chanfana";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AppContext } from "../../types";

const MIME_TYPE_MAP: Record<string, string> = {
	svg: "image/svg+xml",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	avif: "image/avif",
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	ogg: "application/ogg",
	wav: "audio/wav",
	json: "application/json",
	pdf: "application/pdf",
	csv: "text/csv",
	html: "text/html",
	txt: "text/plain",
	md: "text/markdown",
	log: "text/plain",
};

const DOUBLE_EXTENSIONS: Record<string, string> = {
	"log.gz": "application/gzip",
};

const inferContentType = (key: string): string | undefined => {
	const lower = key.toLowerCase();
	for (const [suffix, mime] of Object.entries(DOUBLE_EXTENSIONS)) {
		if (lower.endsWith(suffix)) {
			return mime;
		}
	}

	const parts = lower.split(".");
	if (parts.length <= 1) {
		return undefined;
	}

	const ext = parts.pop();
	return ext ? MIME_TYPE_MAP[ext] : undefined;
};

export class GetObject extends OpenAPIRoute {
	schema = {
		operationId: "get-bucket-object",
		tags: ["Buckets"],
		summary: "Get Object",
		request: {
			params: z.object({
				bucket: z.string(),
				key: z.string().describe("base64 encoded file key"),
			}),
		},
		responses: {
			"200": {
				description: "File binary",
				schema: z.string().openapi({ format: "binary" }),
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

		let filePath;
		try {
			filePath = decodeURIComponent(escape(atob(data.params.key)));
		} catch (_e) {
			filePath = decodeURIComponent(
				escape(atob(decodeURIComponent(data.params.key))),
			);
		}

		const object = await bucket.get(filePath);

		if (object === null) {
			return Response.json({ msg: "Object Not Found" }, { status: 404 });
		}

		const requestUrl = new URL(c.req.url);
		const requestedDisposition = requestUrl.searchParams.get("disposition");

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("etag", object.httpEtag);

		if (!headers.get("content-type")) {
			const inferred = inferContentType(filePath);
			if (inferred) {
				headers.set("content-type", inferred);
			}
		}

		const filename = filePath.split("/").pop() || "file";
		const safeFilename = filename.replace(/"/g, '\\"') || "file";
		const disposition =
			requestedDisposition === "inline" ? "inline" : "attachment";
		headers.set(
			"Content-Disposition",
			`${disposition}; filename="${safeFilename}"`,
		);

		return new Response(object.body, {
			headers,
		});
	}
}
