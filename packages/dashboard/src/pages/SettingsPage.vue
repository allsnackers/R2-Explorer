<template>
  <q-page class="q-pa-md">
    <div class="container-md">
      <h4>Settings</h4>

      <q-card class="q-mb-lg">
        <q-card-section>
          <div class="text-h6">Direct Asset Links</div>
          <div class="text-caption text-grey-7">
            Configure how shareable links are generated for your files
          </div>
        </q-card-section>

        <q-card-section>
          <q-toggle
            v-model="settings.enabled"
            label="Use Direct Links"
            color="primary"
            @update:model-value="saveSettings"
          />

          <div class="q-mt-md text-caption text-grey-7">
            When enabled, shareable links will point directly to your assets instead of the preview interface.
          </div>
        </q-card-section>

        <q-card-section v-if="settings.enabled">
          <q-input
            v-model="settings.baseUrl"
            label="Base URL"
            placeholder="https://assets.example.com"
            outlined
            hint="The base URL for your direct asset links (without trailing slash)"
            @blur="saveSettings"
          >
            <template v-slot:prepend>
              <q-icon name="link" />
            </template>
          </q-input>

          <q-toggle
            v-model="settings.singleBucketMode"
            label="Single Bucket Mode"
            color="primary"
            class="q-mt-md"
            @update:model-value="saveSettings"
          />

          <div class="q-mt-xs text-caption text-grey-7">
            When enabled, generated direct links will omit the bucket name from the path.
          </div>

          <div v-if="settings.baseUrl" class="q-mt-md">
            <div class="text-caption text-grey-7">Preview Example:</div>
            <div class="q-mt-xs q-pa-sm bg-grey-2 rounded" style="word-break: break-all; font-family: monospace; font-size: 12px;">
              {{ settings.baseUrl }}/{{ directLinkPathExample }}
            </div>
          </div>
        </q-card-section>

        <q-card-section v-if="!settings.enabled">
          <div class="q-pa-md bg-blue-1 rounded">
            <div class="text-body2">
              <q-icon name="info" color="blue" />
              Current behavior: Shareable links will point to the R2-Explorer preview interface.
            </div>
          </div>
        </q-card-section>

        <q-card-section>
          <q-btn
            label="Save Settings"
            color="primary"
            @click="saveSettings"
            :disable="settings.enabled && !settings.baseUrl"
          />

          <q-btn
            label="Reset to Defaults"
            color="grey"
            flat
            class="q-ml-sm"
            @click="resetSettings"
          />
        </q-card-section>
      </q-card>

      <q-card class="q-mb-lg">
        <q-card-section>
          <div class="text-h6">Cache Management</div>
          <div class="text-caption text-grey-7">
            Manage cache versions for your files
          </div>
        </q-card-section>

        <q-card-section>
          <div class="q-pa-md bg-blue-1 rounded q-mb-md">
            <div class="text-body2">
              <q-icon name="info" color="blue" />
              Cache busting adds a version parameter (?v=timestamp) to file URLs, ensuring browsers and CDNs always fetch the latest version.
            </div>
          </div>

          <div class="text-subtitle2 q-mb-sm">Global Cache Refresh</div>
          <div class="text-caption text-grey-7 q-mb-md">
            Update cache versions for all files in a bucket. This is useful after bulk uploads or when you want to ensure all assets are fresh.
          </div>

          <q-select
            v-model="selectedBucketForRefresh"
            :options="bucketOptions"
            label="Select Bucket"
            outlined
            class="q-mb-md"
          />

          <div v-if="selectedBucketForRefresh" class="q-pa-md bg-orange-1 rounded q-mb-md">
            <div class="text-orange-9 text-weight-bold">⚠️ WARNING</div>
            <div class="q-mt-sm">
              This will update cache versions for ALL files in the <strong>{{ selectedBucketForRefresh }}</strong> bucket.
              This operation may take several minutes for large buckets.
            </div>
          </div>

          <q-btn
            label="Refresh All Cache Versions"
            color="red"
            :disable="!selectedBucketForRefresh || refreshing"
            :loading="refreshing"
            @click="handleGlobalRefresh"
          />
        </q-card-section>
      </q-card>

      <q-card>
        <q-card-section>
          <div class="text-h6">About Direct Links</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <p>
            Direct links allow you to share files as direct URLs to your R2 bucket's public domain.
            This is useful when you want to:
          </p>
          <ul>
            <li>Embed images or videos in external websites</li>
            <li>Share direct download links without the preview interface</li>
            <li>Use your custom domain for asset hosting</li>
          </ul>
          <p class="q-mb-none">
            <strong>Note:</strong> Make sure your R2 bucket is configured with a public custom domain
            that matches the base URL you enter above.
          </p>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script>
import { useQuasar } from "quasar";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";
export default defineComponent({
	name: "SettingsPage",
	data: () => ({
		settings: {
			enabled: false,
			baseUrl: "",
			singleBucketMode: false,
		},
		selectedBucketForRefresh: null,
		refreshing: false,
	}),
	computed: {
		exampleBucket() {
			return (
				this.$route.params.bucket ||
				this.mainStore.buckets[0]?.name ||
				"my-bucket"
			);
		},
		directLinkPathExample() {
			const segments = [];
			if (!this.settings.singleBucketMode) {
				segments.push(this.exampleBucket);
			}
			segments.push("path/to/file.png");
			return segments.join("/");
		},
		bucketOptions() {
			return this.mainStore.buckets.map((b) => b.name);
		},
	},
	methods: {
		loadSettings() {
			// Load from the store (which loads from API on app init)
			this.settings = {
				...this.settings,
				...this.mainStore.directLinkSettings,
				singleBucketMode: Boolean(
					this.mainStore.directLinkSettings?.singleBucketMode,
				),
			};
		},
		async saveSettings() {
			if (this.settings.enabled && !this.settings.baseUrl) {
				this.q.notify({
					type: "warning",
					message: "Please enter a base URL when direct links are enabled.",
				});
				return;
			}

			const cleanedBaseUrl = this.settings.baseUrl.replace(/\/+$/, "");
			this.settings.baseUrl = cleanedBaseUrl;
			this.settings.singleBucketMode = Boolean(this.settings.singleBucketMode);

			const result = await this.mainStore.saveDirectLinkSettings(this.settings);

			if (result.success) {
				this.q.notify({
					type: "positive",
					message: "Settings saved successfully!",
					timeout: 2000,
				});
			} else {
				this.q.notify({
					type: "negative",
					message:
						result.error ||
						"Failed to save settings. Please check that R2_EXPLORER_SETTINGS KV is configured.",
					timeout: 5000,
				});
			}
		},
		async resetSettings() {
			this.settings = {
				enabled: false,
				baseUrl: "",
				singleBucketMode: false,
			};
			await this.saveSettings();
		},
		async handleGlobalRefresh() {
			if (!this.selectedBucketForRefresh) return;

			this.q
				.dialog({
					title: "Confirm Global Cache Refresh",
					message: `Are you absolutely sure you want to refresh cache versions for ALL files in the ${this.selectedBucketForRefresh} bucket? This cannot be undone.`,
					cancel: true,
					persistent: true,
				})
				.onOk(async () => {
					this.refreshing = true;
					const apiHandler = (await import("src/appUtils")).apiHandler;

					try {
						const allFiles = await apiHandler.fetchFile(
							this.selectedBucketForRefresh,
							"",
							"",
						);
						const files = allFiles.filter((f) => f.type === "file");

						const notif = this.q.notify({
							type: "ongoing",
							message: `Refreshing cache for ${files.length} files...`,
							timeout: 0,
							spinner: true,
						});

						for (let i = 0; i < files.length; i++) {
							await apiHandler.refreshCacheVersion(
								this.selectedBucketForRefresh,
								files[i].key,
							);

							if (i % 10 === 0) {
								notif({
									message: `Refreshing cache: ${i + 1} / ${files.length}`,
								});
							}
						}

						notif({
							type: "positive",
							message: `Successfully refreshed cache for ${files.length} files!`,
							timeout: 5000,
							spinner: false,
							icon: "done",
						});
					} catch (error) {
						console.error("Global cache refresh error:", error);
						this.q.notify({
							type: "negative",
							message: `Failed to refresh cache: ${error.message}`,
							timeout: 5000,
						});
					} finally {
						this.refreshing = false;
					}
				});
		},
	},
	mounted() {
		this.loadSettings();
	},
	setup() {
		return {
			mainStore: useMainStore(),
			q: useQuasar(),
		};
	},
});
</script>
