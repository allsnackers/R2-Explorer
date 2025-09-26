import { api } from "boot/axios";
import { defineStore } from "pinia";

export const useMainStore = defineStore("main", {
	state: () => ({
		// Config
		apiReadonly: true,
		auth: {},
		config: {},
		version: "",
		showHiddenFiles: false,

		// Frontend data
		buckets: [],

		// Direct link settings
		directLinkSettings: {
			enabled: false,
			baseUrl: "",
		},
	}),
	getters: {
		serverUrl() {
			if (process.env.NODE_ENV === "development") {
				return process.env.VUE_APP_SERVER_URL || "http://localhost:8787";
			}
			return window.location.origin;
		},
	},
	actions: {
		loadDirectLinkSettings() {
			const stored = localStorage.getItem("r2explorer-direct-link-settings");
			if (stored) {
				try {
					this.directLinkSettings = JSON.parse(stored);
				} catch (e) {
					console.error("Failed to load direct link settings:", e);
				}
			}
		},
		async loadServerConfigs(router, q, handleError = false) {
			// This is the initial requests to server, that also checks if user needs auth

			try {
				const response = await api.get("/server/config", {
					validateStatus: (status) => status >= 200 && status < 300,
				});

				this.apiReadonly = response.data.config.readonly;
				this.config = response.data.config;
				this.auth = response.data.auth;
				this.version = response.data.version;
				this.showHiddenFiles = response.data.config.showHiddenFiles;
				this.buckets = response.data.buckets;

				this.loadDirectLinkSettings();

				const url = new URL(window.location.href);
				if (url.searchParams.get("next")) {
					await router.replace(url.searchParams.get("next"));
				} else if (url.pathname === "/" || url.pathname === "/auth/login") {
					await router.push({
						name: "files-home",
						params: { bucket: this.buckets[0].name },
					});
				}

				return true;
			} catch (error) {
				console.log(error);
				if (error.response.status === 302) {
					// Handle cloudflare access login page
					const nextUrl = error.response.headers.Location;
					if (nextUrl) {
						window.location.replace(nextUrl);
					}
				}

				if (handleError) {
					const respText = await error.response.data;
					if (respText === "Authentication error: Basic Auth required") {
						await router.push({
							name: "login",
							query: { next: router.currentRoute.value.fullPath },
						});
						return;
					}

					q.notify({
						type: "negative",
						message: respText,
						timeout: 10000, // we will timeout it in 10s
					});
				} else {
					throw error;
				}
			}

			return false;
		},
	},
});
