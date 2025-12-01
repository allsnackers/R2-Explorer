import type { CloudflareAccessVariables } from "@hono/cloudflare-access";
import type { Context } from "hono";

export type BasicAuthType = {
	username: string;
	password: string;
};

export type R2ExplorerConfig = {
	readonly?: boolean;
	cors?: boolean;
	cfAccessTeamName?: string;
	dashboardUrl?: string;
	emailRouting?:
		| {
				targetBucket: string;
		  }
		| false;
	showHiddenFiles?: boolean;
	basicAuth?: BasicAuth | BasicAuth[];
};

export type AppEnv = {
	ASSETS: Fetcher;
	R2_EXPLORER_SETTINGS?: KVNamespace;
	[key: string]: R2Bucket | Fetcher | KVNamespace | undefined;
};

export type DirectLinkSettings = {
	enabled: boolean;
	baseUrl: string;
	singleBucketMode: boolean;
};
export type AppVariables = {
	config: R2ExplorerConfig;
	authentication_type?: string;
	authentication_username?: string;
} & CloudflareAccessVariables;
export type AppContext = Context<{ Bindings: AppEnv; Variables: AppVariables }>;
