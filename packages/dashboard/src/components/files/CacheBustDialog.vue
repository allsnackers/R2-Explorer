<template>
  <q-dialog v-model="isOpen" @hide="reset">
    <q-card style="min-width: 400px;">
      <q-card-section class="row column">
        <q-avatar
          class="q-mb-md"
          :icon="warningLevel === 'critical' ? 'warning' : 'refresh'"
          :color="warningLevel === 'critical' ? 'red' : 'orange'"
          text-color="white"
        />

        <div class="text-h6 q-mb-md">{{ title }}</div>

        <div v-if="warningLevel === 'critical'" class="q-mb-md bg-red-1 q-pa-md rounded">
          <div class="text-red text-weight-bold">⚠️ WARNING</div>
          <div class="q-mt-sm">
            This will update cache versions for <strong>{{ fileCount }}</strong> files.
            This operation will force all cached versions to be invalidated.
          </div>
        </div>

        <div v-else-if="warningLevel === 'high'" class="q-mb-md bg-orange-1 q-pa-md rounded">
          <div class="text-orange-9 text-weight-bold">⚠️ Notice</div>
          <div class="q-mt-sm">
            This will update cache versions for <strong>{{ fileCount }}</strong> files.
          </div>
        </div>

        <div v-else class="q-mb-md">
          <p v-if="isRecursive">
            This will recursively update cache versions for all files in the folder
            <code>{{ itemName }}</code> ({{ fileCount }} files).
          </p>
          <p v-else-if="fileCount > 1">
            This will update cache versions for {{ fileCount }} selected files.
          </p>
          <p v-else>
            This will update the cache version for <code>{{ itemName }}</code>.
          </p>
        </div>

        <div class="text-caption text-grey-7">
          Updating cache versions adds a version parameter to file URLs, ensuring browsers and CDNs fetch the latest version.
        </div>

        <q-linear-progress v-if="loading" :value="progress" class="q-mt-md" />
        <div v-if="loading" class="text-center q-mt-sm text-caption">
          {{ progressText }}
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup :disable="loading" />
        <q-btn
          flat
          :label="confirmLabel"
          :color="warningLevel === 'critical' ? 'red' : 'orange'"
          :loading="loading"
          @click="confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { useQuasar } from "quasar";
import { apiHandler } from "src/appUtils";
import { defineComponent } from "vue";

export default defineComponent({
	name: "CacheBustDialog",
	data: () => ({
		isOpen: false,
		loading: false,
		progress: 0,
		progressText: "",
		title: "",
		itemName: "",
		fileCount: 0,
		warningLevel: "normal",
		isRecursive: false,
		confirmLabel: "Refresh Cache",
		bucket: "",
		files: [],
		onComplete: null,
	}),
	methods: {
		open(options) {
			this.bucket = options.bucket;
			this.files = options.files || [];
			this.fileCount = options.fileCount || this.files.length;
			this.itemName = options.itemName || "";
			this.isRecursive = options.isRecursive || false;
			this.onComplete = options.onComplete || null;

			if (this.fileCount > 100 || options.isGlobal) {
				this.warningLevel = "critical";
				this.title = "Critical: Refresh Cache Versions?";
			} else if (this.fileCount >= 10) {
				this.warningLevel = "high";
				this.title = "Refresh Cache Versions?";
			} else {
				this.warningLevel = "normal";
				this.title = "Refresh Cache Version";
			}

			this.confirmLabel =
				this.fileCount === 1
					? "Refresh Cache"
					: `Refresh ${this.fileCount} Files`;

			this.isOpen = true;
		},
		async confirm() {
			this.loading = true;
			this.progress = 0;

			try {
				for (let i = 0; i < this.files.length; i++) {
					const file = this.files[i];
					this.progressText = `Updating ${i + 1} of ${this.files.length}...`;
					this.progress = (i + 1) / this.files.length;

					await apiHandler.refreshCacheVersion(this.bucket, file.key);
				}

				this.q.notify({
					type: "positive",
					message: `Successfully refreshed cache for ${this.files.length} file${this.files.length > 1 ? "s" : ""}!`,
					timeout: 3000,
				});

				if (this.onComplete) {
					this.onComplete();
				}

				this.isOpen = false;
			} catch (error) {
				console.error("Cache refresh error:", error);
				this.q.notify({
					type: "negative",
					message: `Failed to refresh cache: ${error.message}`,
					timeout: 5000,
				});
			} finally {
				this.loading = false;
			}
		},
		reset() {
			this.loading = false;
			this.progress = 0;
			this.progressText = "";
			this.title = "";
			this.itemName = "";
			this.fileCount = 0;
			this.warningLevel = "normal";
			this.isRecursive = false;
			this.confirmLabel = "Refresh Cache";
			this.bucket = "";
			this.files = [];
			this.onComplete = null;
		},
	},
	setup() {
		return {
			q: useQuasar(),
		};
	},
});
</script>

<style scoped>
code {
  background-color: #e9e9e9;
  padding: 0.25em;
  border-radius: 3px;
}

.rounded {
  border-radius: 4px;
}
</style>