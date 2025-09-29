<template>
  <q-page class="">
    <div class="q-pa-md">
      <q-breadcrumbs>
        <q-breadcrumbs-el style="cursor: pointer" v-for="obj in breadcrumbs" :key="obj.name" :label="obj.name" @click="breadcrumbsClick(obj)" />
      </q-breadcrumbs>

      <drag-and-drop ref="uploader">

        <q-table
          ref="table"
          :rows="rows"
          :columns="columns"
          row-key="key"
          :loading="loading"
          :hide-pagination="true"
          :rows-per-page-options="[0]"
          column-sort-order="da"
          :flat="true"
          table-class="file-list"
          selection="multiple"
          v-model:selected="selectedRows"
          @row-dblclick="handleRowDoubleClick"
          @row-click="handleRowClick"
          @keydown="handleKeyDown"
          tabindex="0"
        >

          <template v-slot:loading>
              <div class="full-width q-my-lg">
                  <h6 class="flex items-center justify-center">
                      <q-spinner
                              color="primary"
                              size="xl"
                      />
                  </h6>
              </div>
          </template>

          <template v-slot:no-data>
            <div class="full-width q-my-lg" v-if="!loading">
              <h6 class="flex items-center justify-center"><q-icon name="folder" color="orange" size="lg" />This folder is empty</h6>
            </div>
          </template>

          <template v-slot:body-cell-thumbnail="prop">
            <td class="thumbnail-cell">
              <div
                v-if="prop.row.type === 'file' && isMediaFile(prop.row.name)"
                class="file-thumbnail"
                @click.stop="openGallery(prop.row)"
              >
                <img
                  :src="getThumbnailUrl(prop.row, selectedBucket)"
                  :alt="prop.row.name"
                  class="thumbnail-image"
                />
              </div>
            </td>
          </template>

          <template v-slot:body-cell-name="prop">
            <td
              class="name-cell row items-center"
              :draggable="!mainStore.apiReadonly"
              @dragstart="handleDragStart($event, prop.row)"
              @dragover="handleDragOver($event, prop.row)"
              @dragleave="handleDragLeave($event, prop.row)"
              @drop="handleDrop($event, prop.row)"
              :class="{
                'drop-target': dropTarget && dropTarget.key === prop.row.key,
                'keyboard-focused': focusedRowIndex === prop.rowIndex
              }"
            >
              <q-icon :name="prop.row.icon" size="sm" :color="prop.row.color" class="q-mr-xs" />
              {{prop.row.name}}
            </td>
          </template>

          <template v-slot:body-cell="prop">
            <q-td :props="prop">
              {{prop.value}}
            </q-td>
            <q-menu
              touch-position
              context-menu
            >
              <FileContextMenu :prop="prop" :selectedRows="selectedRows" @openObject="openObject" @deleteObject="$refs.options.deleteObject" @renameObject="$refs.options.renameObject" @updateMetadataObject="$refs.options.updateMetadataObject" @refreshCacheVersion="handleRefreshCache" @bulkMove="handleBulkMove" @bulkDelete="handleBulkDelete" />
            </q-menu>
          </template>

          <template v-slot:body-cell-options="prop">
            <td class="text-right">
              <q-btn round flat icon="more_vert" size="sm">
                <q-menu>
                  <FileContextMenu :prop="prop" :selectedRows="selectedRows" @openObject="openObject" @deleteObject="$refs.options.deleteObject" @renameObject="$refs.options.renameObject" @updateMetadataObject="$refs.options.updateMetadataObject" @refreshCacheVersion="handleRefreshCache" @bulkMove="handleBulkMove" @bulkDelete="handleBulkDelete" />
                </q-menu>
              </q-btn>
            </td>
          </template>
        </q-table>

      </drag-and-drop>

      <div v-if="selectedRows.length > 0" class="bulk-action-toolbar">
        <div class="bulk-action-content">
          <q-checkbox
            v-model="allSelected"
            @update:model-value="toggleSelectAll"
            class="q-mr-sm"
          />
          <span class="bulk-action-text">{{ selectedRows.length }} item{{ selectedRows.length > 1 ? 's' : '' }} selected</span>
          <q-space />
          <q-btn
            flat
            dense
            label="Refresh Cache"
            icon="refresh"
            color="orange"
            @click="handleBulkRefreshCache"
            class="q-mr-sm"
          />
          <q-btn
            flat
            dense
            label="Delete"
            icon="delete"
            color="red"
            @click="handleBulkDelete"
            class="q-mr-sm"
          />
          <q-btn
            flat
            dense
            label="Cancel"
            @click="clearSelection"
          />
        </div>
      </div>

    </div>
  </q-page>

  <file-preview ref="preview"/>
  <file-options ref="options" />
  <media-gallery ref="gallery" :mediaFiles="mediaFiles" :bucket="selectedBucket" />
  <cache-bust-dialog ref="cacheDialog" />
  <move-folder-picker-dialog ref="moveDialog" @move="handleMoveComplete" />
</template>

<script>
import CacheBustDialog from "components/files/CacheBustDialog.vue";
import FileOptions from "components/files/FileOptions.vue";
import MoveFolderPickerDialog from "components/files/MoveFolderPickerDialog.vue";
import FilePreview from "components/preview/FilePreview.vue";
import MediaGallery from "components/preview/MediaGallery.vue";
import DragAndDrop from "components/utils/DragAndDrop.vue";
import FileContextMenu from "pages/files/FileContextMenu.vue";
import { useQuasar } from "quasar";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";
import {
	apiHandler,
	decode,
	encode,
	getThumbnailUrl,
	isMediaFile,
	ROOT_FOLDER,
} from "../../appUtils";

export default defineComponent({
	name: "FilesIndexPage",
	components: {
		CacheBustDialog,
		FileContextMenu,
		FileOptions,
		DragAndDrop,
		FilePreview,
		MediaGallery,
		MoveFolderPickerDialog,
	},
	data: () => ({
		loading: false,
		rows: [],
		selectedRows: [],
		draggedItems: [],
		dropTarget: null,
		focusedRowIndex: -1,
		columns: [
			{
				name: "thumbnail",
				label: "",
				align: "center",
				field: "thumbnail",
				sortable: false,
				style: "width: 60px",
			},
			{
				name: "name",
				required: true,
				label: "Name",
				align: "left",
				field: "name",
				sortable: true,
				sort: (a, b, rowA, rowB) => {
					if (rowA.type === "folder") {
						if (rowB.type === "folder") {
							// both are folders
							return a.localeCompare(b);
						}
						// only first is folder
						return 1;
					}
					if (rowB.type === "folder") {
						// only second is folder
						return -1;
					}
					// none is folder
					return a.localeCompare(b);
				},
			},
			{
				name: "lastModified",
				required: true,
				label: "Last Modified",
				align: "left",
				field: "lastModified",
				sortable: true,
				sort: (_a, _b, rowA, rowB) => {
					return rowA.timestamp - rowB.timestamp;
				},
			},
			{
				name: "size",
				required: true,
				label: "Size",
				align: "left",
				field: "size",
				sortable: true,
				sort: (_a, _b, rowA, rowB) => {
					return rowA.sizeRaw - rowB.sizeRaw;
				},
			},
			{
				name: "options",
				label: "",
				sortable: false,
			},
		],
	}),
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		mediaFiles: function () {
			return this.rows.filter(
				(row) => row.type === "file" && isMediaFile(row.name),
			);
		},
		allSelected: {
			get() {
				return (
					this.selectedRows.length > 0 &&
					this.selectedRows.length === this.rows.length
				);
			},
			set(val) {
				if (val) {
					this.selectedRows = [...this.rows];
				} else {
					this.selectedRows = [];
				}
			},
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
		breadcrumbs: function () {
			if (this.selectedFolder) {
				return [
					{
						name: this.selectedBucket,
						path: "/",
					},
					...this.selectedFolder
						.split("/")
						.filter((obj) => obj !== "")
						.map((item, index, arr) => {
							return {
								name: item,
								path: `${arr
									.slice(0, index + 1)
									.join("/")
									.replace("Home/", "")}/`,
							};
						}),
				];
			}
			return [
				{
					name: this.selectedBucket,
					path: "/",
				},
			];
		},
	},
	watch: {
		selectedBucket(_newVal) {
			this.fetchFiles();
		},
		selectedFolder(_newVal) {
			this.fetchFiles();
		},
	},
	methods: {
		handleRowClick: function (event, row, index) {
			this.focusedRowIndex = index;

			const interactiveSelectors = [
				".file-thumbnail",
				".q-btn",
				".q-menu",
				".q-checkbox",
				".q-toggle",
			];
			const clickedInteractive = interactiveSelectors.some((selector) =>
				event.target.closest(selector),
			);
			if (clickedInteractive) {
				return;
			}

			const hasModifier =
				event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
			if (row.type === "folder" && !hasModifier) {
				this.clearSelection();
				this.openObject(row);
			}
		},
		handleRowDoubleClick: function (event, row, index) {
			event.preventDefault();
			this.focusedRowIndex = index;
			this.openObject(row);
		},
		breadcrumbsClick: function (obj) {
			this.$router.push({
				name: "files-folder",
				params: { bucket: this.selectedBucket, folder: encode(obj.path) },
			});
		},
		openObject: function (row) {
			if (row.type === "folder") {
				this.$router.push({
					name: "files-folder",
					params: { bucket: this.selectedBucket, folder: encode(row.key) },
				});
			} else {
				// console.log(row)
				this.$refs.preview.openFile(row);
			}
		},
		renameObject: function (row) {
			if (row.type === "folder") {
				this.$router.push({
					name: "files-folder",
					params: { bucket: this.selectedBucket, folder: encode(row.key) },
				});
			} else {
				// console.log(row)
				this.$refs.preview.openFile(row);
			}
		},
		fetchFiles: async function () {
			this.loading = true;

			this.rows = await apiHandler.fetchFile(
				this.selectedBucket,
				this.selectedFolder,
				"/",
			);
			this.loading = false;
		},
		openPreviewFromKey: async function () {
			let key = `${decode(this.$route.params.file)}`;
			if (this.selectedFolder && this.selectedFolder !== ROOT_FOLDER) {
				key = `${this.selectedFolder}${decode(this.$route.params.file)}`;
			}

			const file = await apiHandler.headFile(this.selectedBucket, key);
			this.$refs.preview.openFile(file);
		},
		openGallery: function (file) {
			const mediaIndex = this.mediaFiles.findIndex((f) => f.key === file.key);
			if (mediaIndex !== -1) {
				this.$refs.gallery.open(mediaIndex);
			}
		},
		handleRefreshCache: async function (row) {
			const isFolder = row.type === "folder";
			let filesToRefresh = [];

			if (isFolder) {
				const folderContents = await apiHandler.fetchFile(
					this.selectedBucket,
					row.key,
					"",
				);
				filesToRefresh = folderContents.filter((f) => f.type === "file");
			} else {
				filesToRefresh = [row];
			}

			this.$refs.cacheDialog.open({
				bucket: this.selectedBucket,
				files: filesToRefresh,
				fileCount: filesToRefresh.length,
				itemName: row.name,
				isRecursive: isFolder,
				onComplete: () => {
					this.fetchFiles();
				},
			});
		},
		handleBulkRefreshCache: async function () {
			const filesToRefresh = [];

			for (const row of this.selectedRows) {
				if (row.type === "folder") {
					const folderContents = await apiHandler.fetchFile(
						this.selectedBucket,
						row.key,
						"",
					);
					filesToRefresh.push(
						...folderContents.filter((f) => f.type === "file"),
					);
				} else {
					filesToRefresh.push(row);
				}
			}

			this.$refs.cacheDialog.open({
				bucket: this.selectedBucket,
				files: filesToRefresh,
				fileCount: filesToRefresh.length,
				itemName: `${this.selectedRows.length} items`,
				isRecursive: false,
				onComplete: () => {
					this.fetchFiles();
					this.clearSelection();
				},
			});
		},
		handleBulkDelete: function () {
			if (this.selectedRows.length === 1) {
				this.$refs.options.deleteObject(this.selectedRows[0]);
			} else {
				this.$refs.options.bulkDeleteObjects(this.selectedRows);
			}
		},
		handleBulkMove: function (items) {
			this.$refs.moveDialog.open(items || this.selectedRows);
		},
		handleMoveComplete: function () {
			this.clearSelection();
			this.fetchFiles();
		},
		toggleSelectAll: function (val) {
			this.allSelected = val;
		},
		clearSelection: function () {
			this.selectedRows = [];
		},
		handleDragStart: function (event, row) {
			if (this.mainStore.apiReadonly) {
				event.preventDefault();
				return;
			}

			if (this.selectedRows.length > 0 && this.selectedRows.includes(row)) {
				this.draggedItems = [...this.selectedRows];
			} else {
				this.draggedItems = [row];
			}

			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData(
				"text/plain",
				JSON.stringify(this.draggedItems.map((item) => item.key)),
			);

			const dragImage = document.createElement("div");
			dragImage.textContent =
				this.draggedItems.length === 1
					? this.draggedItems[0].name
					: `${this.draggedItems.length} items`;
			dragImage.style.cssText =
				"position: absolute; top: -1000px; padding: 8px; background: #1976d2; color: white; border-radius: 4px; font-size: 14px;";
			document.body.appendChild(dragImage);
			event.dataTransfer.setDragImage(dragImage, 0, 0);
			setTimeout(() => document.body.removeChild(dragImage), 0);
		},
		handleDragOver: function (event, row) {
			if (this.mainStore.apiReadonly || row.type !== "folder") {
				return;
			}

			const draggedKeys = this.draggedItems.map((item) => item.key);
			if (draggedKeys.includes(row.key)) {
				return;
			}

			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			this.dropTarget = row;
		},
		handleDragLeave: function (_event, row) {
			if (this.dropTarget && this.dropTarget.key === row.key) {
				this.dropTarget = null;
			}
		},
		handleDrop: async function (event, targetRow) {
			event.preventDefault();
			this.dropTarget = null;

			if (
				this.mainStore.apiReadonly ||
				targetRow.type !== "folder" ||
				this.draggedItems.length === 0
			) {
				return;
			}

			const destinationFolder = targetRow.key;

			const notif = this.q.notify({
				group: false,
				spinner: true,
				message: `Moving ${this.draggedItems.length} item${this.draggedItems.length > 1 ? "s" : ""}...`,
				caption: "0%",
				timeout: 0,
			});

			try {
				for (let i = 0; i < this.draggedItems.length; i++) {
					const item = this.draggedItems[i];
					const fileName = item.key.split("/").pop();
					const newKey = `${destinationFolder}${fileName}`;

					await apiHandler.renameObject(this.selectedBucket, item.key, newKey);

					notif({
						caption: `${Math.round(((i + 1) * 100) / this.draggedItems.length)}%`,
					});
				}

				notif({
					icon: "done",
					spinner: false,
					caption: "100%",
					message: "Items moved successfully!",
					timeout: 2500,
				});

				this.draggedItems = [];
				this.clearSelection();
				this.fetchFiles();
			} catch (error) {
				notif({
					icon: "error",
					spinner: false,
					message: `Failed to move items: ${error.message}`,
					color: "negative",
					timeout: 5000,
				});
				this.draggedItems = [];
			}
		},
		handleKeyDown: function (event) {
			if (this.rows.length === 0) return;

			switch (event.key) {
				case "ArrowDown":
					event.preventDefault();
					if (this.focusedRowIndex < this.rows.length - 1) {
						this.focusedRowIndex++;
					}
					break;
				case "ArrowUp":
					event.preventDefault();
					if (this.focusedRowIndex > 0) {
						this.focusedRowIndex--;
					} else if (this.focusedRowIndex === -1 && this.rows.length > 0) {
						this.focusedRowIndex = 0;
					}
					break;
				case "Enter":
					event.preventDefault();
					if (
						this.focusedRowIndex >= 0 &&
						this.focusedRowIndex < this.rows.length
					) {
						this.openObject(this.rows[this.focusedRowIndex]);
					}
					break;
				case " ":
					event.preventDefault();
					if (
						this.focusedRowIndex >= 0 &&
						this.focusedRowIndex < this.rows.length
					) {
						const row = this.rows[this.focusedRowIndex];
						const index = this.selectedRows.findIndex((r) => r.key === row.key);
						if (index >= 0) {
							this.selectedRows.splice(index, 1);
						} else {
							this.selectedRows.push(row);
						}
					}
					break;
				case "Delete":
				case "Backspace":
					event.preventDefault();
					if (this.selectedRows.length > 0) {
						this.handleBulkDelete();
					} else if (
						this.focusedRowIndex >= 0 &&
						this.focusedRowIndex < this.rows.length
					) {
						this.$refs.options.deleteObject(this.rows[this.focusedRowIndex]);
					}
					break;
				case "Escape":
					event.preventDefault();
					this.clearSelection();
					this.focusedRowIndex = -1;
					break;
				case "a":
				case "A":
					if (event.metaKey || event.ctrlKey) {
						event.preventDefault();
						this.selectedRows = [...this.rows];
					}
					break;
			}
		},
		isMediaFile,
		getThumbnailUrl,
	},
	created() {
		this.fetchFiles();
	},
	mounted() {
		this.$refs.table.sort("name");

		this.$bus.on("fetchFiles", this.fetchFiles);

		if (this.$route.params.file) {
			this.openPreviewFromKey();
		}

		this.$nextTick(() => {
			if (this.$refs.table?.$el) {
				this.$refs.table.$el.focus();
			}
		});
	},
	beforeUnmount() {
		this.$bus.off("fetchFiles");
	},
	setup() {
		return {
			mainStore: useMainStore(),
			q: useQuasar(),
		};
	},
});
</script>

<style>
.file-list table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.file-list thead tr,
.file-list tbody tr {
  display: table-row;
}

.file-list tbody tr {
  transition: background-color 0.15s ease;
}

.file-list tbody tr:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.file-list td,
.file-list th {
  vertical-align: middle;
}

.file-list td:first-of-type,
.file-list th:first-of-type {
  width: 48px;
}

.file-list td.thumbnail-cell {
  width: 72px;
  text-align: center;
}

.file-list td[draggable="true"] {
  cursor: move;
}

.file-list td.drop-target {
  background-color: rgba(25, 118, 210, 0.08);
  box-shadow: inset 0 0 0 2px #1976d2;
  border-radius: 4px;
}

.file-list tr:has(td.keyboard-focused) {
  outline: 2px solid #1976d2;
  outline-offset: -1px;
}

.file-list table:focus {
  outline: none;
}

.name-cell {
  gap: 8px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.name-cell .q-icon {
  flex-shrink: 0;
}
</style>
