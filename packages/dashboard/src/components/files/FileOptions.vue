<template>
  <q-dialog v-model="deleteModal" @hide="reset">
    <q-card>
      <q-card-section class="row column" v-if="row || rows.length > 0">
        <q-avatar class="q-mb-md" icon="delete" color="red" text-color="white" />
        <span v-if="rows.length > 1" class="q-ml-sm">Are you sure you want to delete <code>{{rows.length}}</code> items?</span>
        <span v-else-if="row && row.type === 'folder'" class="q-ml-sm">Are you sure you want to delete the folder <code>{{row.name}}</code>, and
          <code v-if="deleteFolderInnerFilesCount !== null">{{deleteFolderInnerFilesCount}}</code>
          <code v-else><q-spinner color="primary"/></code>
          files inside?</span>
        <span v-else-if="row" class="q-ml-sm">Are you sure you want to delete the file <code>{{row.name}}</code>?</span>
      </q-card-section>

      <q-card-section>
        <q-checkbox v-model="permanentDelete" label="Permanently delete (cannot be undone)" />
        <div class="text-caption text-grey-7 q-mt-sm">
          <template v-if="permanentDelete">
            Items will be permanently deleted from the bucket.
          </template>
          <template v-else>
            Items will be moved to .trash/ folder and can be restored later.
          </template>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup />
        <q-btn flat label="Delete" color="red" :loading="loading" @click="deleteConfirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>

	<q-dialog v-model="renameModal" @hide="reset">
		<q-card style="min-width: 320px;">
			<q-card-section class="row column" v-if="row">
				<q-avatar class="q-mb-md" icon="edit" color="orange" text-color="white" />
				<q-input
					v-model="renameInput"
					label="New name"
					dense
					autofocus
					:error="Boolean(renameError)"
					:error-message="renameError"
					@keyup.enter="renameConfirm"
				/>
			</q-card-section>

			<q-card-actions align="right">
				<q-btn flat label="Cancel" color="primary" v-close-popup />
				<q-btn
					flat
					label="Rename"
					color="orange"
					:loading="loading"
					:disable="renameDisabled"
					@click="renameConfirm"
				/>
			</q-card-actions>
		</q-card>
	</q-dialog>

  <q-dialog v-model="updateMetadataModal" @hide="reset">
    <q-card style="min-width: 300px;">
      <q-card-section class="row column" v-if="row">
        <h6 class="q-mt-none q-mb-sm flex">HTTP Metadata <q-btn class="q-mr-none q-ml-auto" round size="sm" color="primary" icon="add" @click="updateHttpMetadata.push({key: '', value: ''})" /></h6>
        <div class="flex row" v-for="(val, index) in updateHttpMetadata" :key="index">
          <div>
            <q-input v-model="updateHttpMetadata[index].key" label="Key" />
          </div>
          <div>
            <q-input v-model="updateHttpMetadata[index].value" label="Value" />
          </div>
          <div class="flex">
            <q-btn class="q-my-auto" round size="sm" color="orange" icon="remove" @click="updateHttpMetadata.splice(index, 1)" />
          </div>
        </div>

        <h6 class="q-mt-xl q-mb-sm flex">Custom Metadata <q-btn class="q-mr-none q-ml-auto" round size="sm" color="primary" icon="add" @click="updateCustomMetadata.push({key: '', value: ''})" /></h6>
        <div class="flex row" v-for="(val, index) in updateCustomMetadata" :key="index">
          <div>
            <q-input v-model="updateCustomMetadata[index].key" label="Key" />
          </div>
          <div>
            <q-input v-model="updateCustomMetadata[index].value" label="Value" />
          </div>
          <div class="flex">
            <q-btn class="q-my-auto" round size="sm" color="orange" icon="remove" @click="updateCustomMetadata.splice(index, 1)" />
          </div>
        </div>

      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup />
        <q-btn flat label="Update Metadata" color="orange" :loading="loading" @click="updateConfirm" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { useQuasar } from "quasar";
import { apiHandler, decode, ROOT_FOLDER } from "src/appUtils";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "FileOptions",
	data: () => ({
		row: null,
		rows: [],
		deleteFolderContents: [],
		deleteModal: false,
		renameModal: false,
		updateMetadataModal: false,
		deleteFolderInnerFilesCount: null,
		newFolderName: "",
		renameInput: "",
		existingItems: [],
		renameServerError: "",
		updateCustomMetadata: [],
		updateHttpMetadata: [],
		loading: false,
		permanentDelete: false,
	}),
	watch: {
		renameInput() {
			if (this.renameServerError) {
				this.renameServerError = "";
			}
		},
	},
	methods: {
		getComparableName(item) {
			if (!item) {
				return "";
			}
			const rawName = (item.name || "").trim();
			if (item.type === "folder") {
				return rawName.replace(/\/+$/, "");
			}
			return rawName;
		},
		getParentKey(item) {
			if (!item?.key) {
				return "";
			}
			if (item.type === "folder") {
				const trimmedKey = item.key.endsWith("/")
					? item.key.slice(0, -1)
					: item.key;
				const lastSlash = trimmedKey.lastIndexOf("/");
				if (lastSlash === -1) {
					return "";
				}
				return `${trimmedKey.slice(0, lastSlash + 1)}`;
			}
			const lastSlash = item.key.lastIndexOf("/");
			if (lastSlash === -1) {
				return "";
			}
			return item.key.slice(0, lastSlash + 1);
		},
		deleteObject: async function (row) {
			this.deleteModal = true;
			this.row = row;
			this.rows = [];
			this.permanentDelete = row.key?.startsWith(".trash/");
			if (row.type === "folder") {
				this.deleteFolderContents = await apiHandler.fetchFile(
					this.selectedBucket,
					row.key,
					"",
				);
				this.deleteFolderInnerFilesCount = this.deleteFolderContents.length;
			}
		},
		bulkDeleteObjects: async function (rows) {
			this.deleteModal = true;
			this.rows = rows;
			this.row = null;
			this.permanentDelete = rows.some((r) => r.key?.startsWith(".trash/"));
		},
		renameObject: async function (row, availableItems = []) {
			this.renameModal = true;
			this.row = row;
			this.renameInput = this.getComparableName(row);
			this.existingItems = availableItems;
			this.renameServerError = "";
		},
		updateMetadataObject: async function (row) {
			this.updateMetadataModal = true;
			this.row = row;
			if (row.httpMetadata) {
				this.updateHttpMetadata = Object.entries(row.httpMetadata).map(
					([key, value]) => {
						return { key: key, value: value };
					},
				);
			}
			if (row.customMetadata) {
				this.updateCustomMetadata = Object.entries(row.customMetadata).map(
					([key, value]) => {
						return { key: key, value: value };
					},
				);
			}
		},
		renameConfirm: async function () {
			const trimmedName = this.renameInput.trim();
			this.renameInput = trimmedName;
			if (!trimmedName || this.renameError) {
				return;
			}
			const currentName = this.getComparableName(this.row) || "";
			if (trimmedName === currentName) {
				this.reset();
				return;
			}

			const isFolder = this.row?.type === "folder";
			const parentKey = this.getParentKey(this.row);
			const newKey = `${parentKey}${trimmedName}${isFolder ? "/" : ""}`;

			this.loading = true;
			this.renameServerError = "";

			try {
				await apiHandler.renameObject(
					this.selectedBucket,
					this.row.key,
					newKey,
				);

				this.$bus.emit("fetchFiles");
				this.q.notify({
					group: false,
					icon: "done",
					spinner: false,
					message: "File renamed!",
					timeout: 2500,
				});
				this.reset();
			} catch (error) {
				const message =
					error?.response?.data?.error ||
					error?.response?.data?.message ||
					error?.response?.data ||
					error?.message ||
					"Unable to rename file";
				this.renameServerError = message;
				this.q.notify({
					group: false,
					icon: "error",
					spinner: false,
					message: `Failed to rename: ${message}`,
					type: "negative",
					timeout: 5000,
				});
			} finally {
				this.loading = false;
			}
		},
		updateConfirm: async function () {
			this.loading = true;
			await apiHandler.updateMetadata(
				this.selectedBucket,
				this.row.key,
				this.updateCustomMetadata.reduce(
					(a, v) => ({ ...a, [v.key]: v.value }),
					{},
				),
				this.updateHttpMetadata.reduce(
					(a, v) => ({ ...a, [v.key]: v.value }),
					{},
				),
			);
			this.$bus.emit("fetchFiles");
			this.reset();
			this.q.notify({
				group: false,
				icon: "done", // we add an icon
				spinner: false, // we reset the spinner setting so the icon can be displayed
				message: "File Updated!",
				timeout: 2500, // we will timeout it in 2.5s
			});
		},
		deleteConfirm: async function () {
			if (this.rows.length > 1) {
				await this.bulkDeleteConfirm();
				return;
			}

			if (this.row.type === "folder") {
				// When deleting folders, first must copy the objects, because the popup close forces a reset on properties
				const originalFolder = { ...this.row };
				const folderContents = [...this.deleteFolderContents];
				const folderContentsCount = this.deleteFolderInnerFilesCount;

				this.deleteModal = false;

				const notif = this.q.notify({
					group: false,
					spinner: true,
					message: "Deleting files...",
					caption: "0%",
					timeout: 0,
				});

				for (const [i, innerFile] of folderContents.entries()) {
					if (innerFile.key) {
						await apiHandler.deleteObject(innerFile.key, this.selectedBucket);
					}
					notif({
						caption: `${Number.parseInt((i * 100) / (folderContentsCount + 1), 10)}%`, // +1 because still needs to delete the folder
					});
				}

				await apiHandler.deleteObject(originalFolder.key, this.selectedBucket);

				notif({
					icon: "done", // we add an icon
					spinner: false, // we reset the spinner setting so the icon can be displayed
					caption: "100%",
					message: "Folder deleted!",
					timeout: 2500, // we will timeout it in 2.5s
				});
			} else {
				this.deleteModal = false;

				if (this.permanentDelete) {
					await apiHandler.deleteObject(this.row.key, this.selectedBucket);
					this.q.notify({
						group: false,
						icon: "done",
						spinner: false,
						message: "File permanently deleted!",
						timeout: 2500,
					});
				} else {
					const timestamp = Date.now();
					const trashKey = `.trash/${timestamp}/${this.row.key}`;
					await apiHandler.renameObject(
						this.selectedBucket,
						this.row.key,
						trashKey,
					);
					this.q.notify({
						group: false,
						icon: "done",
						spinner: false,
						message: "File moved to trash!",
						timeout: 2500,
					});
				}
			}

			this.$bus.emit("fetchFiles");
			this.reset();
		},
		bulkDeleteConfirm: async function () {
			this.deleteModal = false;

			const notif = this.q.notify({
				group: false,
				spinner: true,
				message: "Deleting items...",
				caption: "0%",
				timeout: 0,
			});

			const timestamp = Date.now();

			try {
				for (let i = 0; i < this.rows.length; i++) {
					const item = this.rows[i];

					if (this.permanentDelete) {
						if (item.type === "folder") {
							const folderContents = await apiHandler.fetchFile(
								this.selectedBucket,
								item.key,
								"",
							);
							for (const innerFile of folderContents) {
								if (innerFile.key) {
									await apiHandler.deleteObject(
										innerFile.key,
										this.selectedBucket,
									);
								}
							}
						}
						await apiHandler.deleteObject(item.key, this.selectedBucket);
					} else {
						const trashKey = `.trash/${timestamp}/${item.key}`;
						await apiHandler.renameObject(
							this.selectedBucket,
							item.key,
							trashKey,
						);
					}

					notif({
						caption: `${Math.round(((i + 1) * 100) / this.rows.length)}%`,
					});
				}

				notif({
					icon: "done",
					spinner: false,
					caption: "100%",
					message: this.permanentDelete
						? `${this.rows.length} items permanently deleted!`
						: `${this.rows.length} items moved to trash!`,
					timeout: 2500,
				});
			} catch (error) {
				notif({
					icon: "error",
					spinner: false,
					message: `Failed to delete items: ${error.message}`,
					color: "negative",
					timeout: 5000,
				});
			}

			this.$bus.emit("fetchFiles");
			this.reset();
		},
		reset: function () {
			this.loading = false;
			this.deleteModal = false;
			this.renameModal = false;
			this.updateMetadataModal = false;
			this.renameInput = "";
			this.existingItems = [];
			this.renameServerError = "";
			this.updateCustomMetadata = [];
			this.updateHttpMetadata = [];
			this.row = null;
			this.rows = [];
			this.deleteFolderInnerFilesCount = null;
			this.deleteFolderContents = [];
			this.permanentDelete = false;
		},
		onSubmit: async function () {
			await apiHandler.createFolder(
				`${this.selectedFolder + this.newFolderName}/`,
				this.selectedBucket,
			);
			this.$bus.emit("fetchFiles");
			this.modal = false;
		},
		open: function () {
			this.modal = true;
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
		renameError: function () {
			if (!this.renameModal || !this.row) {
				return "";
			}

			const value = this.renameInput.trim();

			if (!value) {
				return "Name can't be empty";
			}

			if (/[\\:*?"<>|]/.test(value)) {
				return "Name can't include \\ : * ? \" < > |";
			}

			if (value.includes("/")) {
				return "Name can't contain /";
			}

			if (this.mainStore.noSpacesInNames && value.includes(" ")) {
				return "Spaces are not allowed in names";
			}

			const duplicate = this.existingItems.some((item) => {
				if (!item || item.key === this.row.key) {
					return false;
				}
				return (
					this.getComparableName(item).toLowerCase() === value.toLowerCase()
				);
			});

			if (duplicate) {
				return "An item with this name already exists";
			}

			return this.renameServerError;
		},
		renameDisabled: function () {
			if (!this.row) {
				return true;
			}

			if (this.loading) {
				return true;
			}

			const value = this.renameInput.trim();
			if (!value) {
				return true;
			}

			if (value === this.getComparableName(this.row)) {
				return true;
			}

			return Boolean(this.renameError);
		},
	},
	setup() {
		return {
			mainStore: useMainStore(),
			q: useQuasar(),
		};
	},
});
</script>

<style scoped>
code {
  background-color: #e9e9e9;
  padding: 0.25em;
}
</style>
