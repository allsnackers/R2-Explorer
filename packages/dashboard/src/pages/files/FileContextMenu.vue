<template>
  <q-list style="min-width: 100px">
    <q-item clickable v-close-popup @click="openObject" v-if="!isBulkOperation">
      <q-item-section>Open</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="downloadObject" v-if="!isBulkOperation && prop.row.type === 'file'">
      <q-item-section>Download</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="refreshCacheVersion" v-if="!isBulkOperation && prop.row.type === 'file'">
      <q-item-section>Refresh Cache Version</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="refreshCacheVersion" v-if="!isBulkOperation && prop.row.type === 'folder'">
      <q-item-section>Refresh Cache (Recursive)</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="replaceObject" v-if="!isBulkOperation && prop.row.type === 'file'">
      <q-item-section>Replace file...</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="renameObject" v-if="!isBulkOperation">
      <q-item-section>Rename</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="updateMetadataObject" v-if="!isBulkOperation && prop.row.type === 'file'">
      <q-item-section>Update Metadata</q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="shareObject" v-if="!isBulkOperation">
      <q-item-section>Get sharable link</q-item-section>
    </q-item>

    <q-separator v-if="isBulkOperation" />
    <q-item clickable v-close-popup @click="bulkMove" v-if="isBulkOperation">
      <q-item-section>
        <q-item-label>Move {{ bulkItemCount }} item{{ bulkItemCount > 1 ? 's' : '' }}...</q-item-label>
      </q-item-section>
    </q-item>
    <q-item clickable v-close-popup @click="bulkDelete" v-if="isBulkOperation">
      <q-item-section>
        <q-item-label>Delete {{ bulkItemCount }} item{{ bulkItemCount > 1 ? 's' : '' }}...</q-item-label>
      </q-item-section>
    </q-item>

    <q-separator v-if="!isBulkOperation" />
    <q-item clickable v-close-popup @click="deleteObject" v-if="!isBulkOperation">
      <q-item-section>Delete</q-item-section>
    </q-item>
  </q-list>
</template>
<script>
import { useQuasar } from "quasar";
import { buildFileAccessUrl, decode, encode, ROOT_FOLDER } from "src/appUtils";
import { useMainStore } from "stores/main-store";

export default {
	name: "FileContextMenu",
	props: {
		prop: {},
		selectedRows: {
			type: Array,
			default: () => [],
		},
	},
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		selectedFolder: function () {
			if (
				this.$route.params.folder &&
				this.$route.params.folder !== ROOT_FOLDER
			) {
				return decode(this.$route.params.folder);
			}
			return "";
		},
		isBulkOperation: function () {
			return this.selectedRows.length > 1;
		},
		bulkItemCount: function () {
			return this.selectedRows.length;
		},
	},
	methods: {
		renameObject: function () {
			this.$emit("renameObject", this.prop.row);
		},
		replaceObject: function () {
			this.$emit("replaceObject", this.prop.row);
		},
		updateMetadataObject: function () {
			this.$emit("updateMetadataObject", this.prop.row);
		},
		openObject: function () {
			this.$emit("openObject", this.prop.row);
		},
		deleteObject: function () {
			this.$emit("deleteObject", this.prop.row);
		},
		refreshCacheVersion: function () {
			this.$emit("refreshCacheVersion", this.prop.row);
		},
		shareObject: async function () {
			let url;

			if (
				this.mainStore.directLinkSettings.enabled &&
				this.mainStore.directLinkSettings.baseUrl &&
				this.prop.row.type === "file"
			) {
				url = buildFileAccessUrl(this.selectedBucket, this.prop.row.key);
			} else if (this.prop.row.type === "folder") {
				url =
					window.location.origin +
					this.$router.resolve({
						name: "files-folder",
						params: {
							bucket: this.selectedBucket,
							folder: encode(this.prop.row.key),
						},
					}).href;
			} else {
				url =
					window.location.origin +
					this.$router.resolve({
						name: "files-file",
						params: {
							bucket: this.selectedBucket,
							folder: this.selectedFolder
								? encode(this.selectedFolder)
								: ROOT_FOLDER,
							file: this.prop.row.nameHash,
						},
					}).href;
			}

			try {
				await navigator.clipboard.writeText(url);
				this.q.notify({
					message: "Link to file copied to clipboard!",
					timeout: 5000,
					type: "positive",
				});
			} catch (err) {
				this.q.notify({
					message: `Failed to copy: ${err}`,
					timeout: 5000,
					type: "negative",
				});
			}
		},
		downloadObject: function () {
			const link = document.createElement("a");
			link.download = this.prop.row.name;

			link.href = `${this.mainStore.serverUrl}/api/buckets/${this.selectedBucket}/${encode(this.prop.row.key)}`;

			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		},
		bulkMove: function () {
			this.$emit("bulkMove", this.selectedRows);
		},
		bulkDelete: function () {
			this.$emit("bulkDelete", this.selectedRows);
		},
	},
	setup() {
		return {
			mainStore: useMainStore(),
			q: useQuasar(),
		};
	},
};
</script>
