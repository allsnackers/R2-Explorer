<template>
  <div class="file-browser" :class="{ 'mobile-view': $q.platform.is.mobile }">
    <!-- Header with view toggle -->
    <div class="file-browser-header">
      <q-breadcrumbs class="file-browser-breadcrumbs">
        <q-breadcrumbs-el
          v-for="crumb in breadcrumbs"
          :key="crumb.path"
          :label="crumb.name"
          @click="onBreadcrumbClick(crumb)"
          class="cursor-pointer"
        />
      </q-breadcrumbs>

      <q-space />

      <!-- View Toggle -->
      <q-btn-toggle
        v-model="viewMode"
        toggle-color="primary"
        :options="[
          { label: '', value: 'grid', icon: 'grid_view', tooltip: 'Grid View' },
          { label: '', value: 'list', icon: 'view_list', tooltip: 'List View' }
        ]"
        flat
        dense
        class="view-toggle"
      >
        <template v-slot:option="scope">
          <q-tooltip>{{ scope.opt.tooltip }}</q-tooltip>
          <q-icon :name="scope.opt.icon" />
        </template>
      </q-btn-toggle>
    </div>

    <!-- Main content area with drag and drop -->
    <drag-and-drop ref="uploader">
      <div class="file-browser-content" @click="handleContentClick">
        <!-- Loading state -->
        <div v-if="loading" class="loading-container">
          <q-spinner color="primary" size="xl" />
          <p class="q-mt-md text-grey-7">Loading files...</p>
        </div>

        <!-- Empty state -->
        <div v-else-if="!loading && items.length === 0" class="empty-container">
          <q-icon name="folder_open" size="64px" color="grey-5" />
          <p class="q-mt-md text-h6 text-grey-7">This folder is empty</p>
          <p class="text-grey-6">Drop files here or use the upload button</p>
        </div>

        <!-- Grid View -->
        <div v-else-if="viewMode === 'grid'" class="grid-view">
          <transition-group name="grid-item" tag="div" class="file-grid">
            <div
              v-for="(item, index) in sortedItems"
              :key="item.key"
              class="file-card"
              :class="{
                'selected': isSelected(item),
                'drop-target': dropTarget === item.key && item.type === 'folder',
                'focused': focusedIndex === index
              }"
              @click="handleItemClick($event, item, index)"
              @dblclick="handleItemDoubleClick($event, item)"
              @contextmenu="handleContextMenu($event, item)"
              @touchstart="handleTouchStart($event, item, index)"
              @touchend="handleTouchEnd"
              @touchmove="handleTouchMove"
              :draggable="!mainStore.apiReadonly && !$q.platform.is.mobile"
              @dragstart="handleDragStart($event, item)"
              @dragover="handleDragOver($event, item)"
              @dragleave="handleDragLeave($event)"
              @drop="handleDrop($event, item)"
            >
              <!-- Selection checkbox -->
              <q-checkbox
                v-if="selectionMode || isSelected(item)"
                v-model="selectedItems"
                :val="item"
                class="file-card-checkbox"
                @click.stop
              />

              <!-- Thumbnail or icon -->
              <div class="file-card-preview">
                <img
                  v-if="item.type === 'file' && isMediaFile(item.name)"
                  :src="getThumbnailUrl(item, bucket)"
                  :alt="item.name"
                  class="file-thumbnail-img"
                  loading="lazy"
                  @error="handleImageError($event, item)"
                  @load="handleImageLoad($event, item)"
                />
                <q-icon
                  v-else
                  :name="item.icon"
                  :color="item.color"
                  size="48px"
                />
              </div>

              <!-- File info -->
              <div class="file-card-info">
                <div class="file-card-name">{{ item.name }}</div>
                <div class="file-card-meta">
                  <span v-if="item.type === 'file'">{{ item.size }}</span>
                  <span v-else>{{ getItemCount(item) }}</span>
                </div>
              </div>

              <!-- Quick actions -->
              <q-btn
                v-if="!$q.platform.is.mobile"
                round
                flat
                dense
                icon="more_vert"
                size="sm"
                class="file-card-actions"
                @click.stop="showContextMenu($event, item)"
              >
                <q-menu>
                  <file-context-menu
                    :prop="{ row: item }"
                    :selectedRows="selectedItems"
                    @openObject="openItem"
                    @deleteObject="handleDelete"
                    @renameObject="handleRename"
                    @updateMetadataObject="handleUpdateMetadata"
                    @refreshCacheVersion="handleRefreshCache"
                    @bulkMove="handleBulkMove"
                    @bulkDelete="handleBulkDelete"
                  />
                </q-menu>
              </q-btn>
            </div>
          </transition-group>
        </div>

        <!-- List View -->
        <div v-else-if="viewMode === 'list'" class="list-view">
          <div class="file-list">
            <!-- List header -->
            <div class="file-list-header">
              <div class="file-list-cell file-list-select">
                <q-checkbox
                  v-model="selectAll"
                  @update:model-value="handleSelectAll"
                  :indeterminate="selectedItems.length > 0 && selectedItems.length < items.length"
                />
              </div>
              <div class="file-list-cell file-list-name">Name</div>
              <div class="file-list-cell file-list-modified">Modified</div>
              <div class="file-list-cell file-list-size">Size</div>
              <div class="file-list-cell file-list-actions"></div>
            </div>

            <!-- List items -->
            <transition-group name="list-item" tag="div" class="file-list-body">
              <div
                v-for="(item, index) in sortedItems"
                :key="item.key"
                class="file-list-row"
                :class="{
                  'selected': isSelected(item),
                  'drop-target': dropTarget === item.key && item.type === 'folder',
                  'focused': focusedIndex === index
                }"
                @click="handleItemClick($event, item, index)"
                @dblclick="handleItemDoubleClick($event, item)"
                @contextmenu="handleContextMenu($event, item)"
                @touchstart="handleTouchStart($event, item, index)"
                @touchend="handleTouchEnd"
                @touchmove="handleTouchMove"
                :draggable="!mainStore.apiReadonly && !$q.platform.is.mobile"
                @dragstart="handleDragStart($event, item)"
                @dragover="handleDragOver($event, item)"
                @dragleave="handleDragLeave($event)"
                @drop="handleDrop($event, item)"
              >
                <div class="file-list-cell file-list-select">
                  <q-checkbox
                    v-model="selectedItems"
                    :val="item"
                    @click.stop
                  />
                </div>

                <div class="file-list-cell file-list-name">
                  <div class="file-list-name-content">
                    <img
                      v-if="item.type === 'file' && isMediaFile(item.name) && showThumbnailsInList"
                      :src="getThumbnailUrl(item, bucket)"
                      :alt="item.name"
                      class="file-list-thumbnail"
                      loading="lazy"
                      @error="handleImageError($event, item)"
                      @load="handleImageLoad($event, item)"
                    />
                    <q-icon
                      v-else
                      :name="item.icon"
                      :color="item.color"
                      size="24px"
                      class="q-mr-sm"
                    />
                    <span class="file-list-name-text">{{ item.name }}</span>
                  </div>
                </div>

                <div class="file-list-cell file-list-modified">
                  {{ item.lastModified }}
                </div>

                <div class="file-list-cell file-list-size">
                  {{ item.type === 'file' ? item.size : '--' }}
                </div>

                <div class="file-list-cell file-list-actions">
                  <q-btn
                    round
                    flat
                    dense
                    icon="more_vert"
                    size="sm"
                    @click.stop="showContextMenu($event, item)"
                  >
                    <q-menu>
                      <file-context-menu
                        :prop="{ row: item }"
                        :selectedRows="selectedItems"
                        @openObject="openItem"
                        @deleteObject="handleDelete"
                        @renameObject="handleRename"
                        @updateMetadataObject="handleUpdateMetadata"
                        @refreshCacheVersion="handleRefreshCache"
                        @bulkMove="handleBulkMove"
                        @bulkDelete="handleBulkDelete"
                      />
                    </q-menu>
                  </q-btn>
                </div>
              </div>
            </transition-group>
          </div>
        </div>
      </div>
    </drag-and-drop>

    <!-- Mobile action sheet -->
    <q-dialog v-model="showMobileActions" position="bottom">
      <q-card class="mobile-action-sheet">
        <q-list>
          <q-item clickable v-close-popup @click="openItem(currentItem)">
            <q-item-section avatar>
              <q-icon name="folder_open" />
            </q-item-section>
            <q-item-section>Open</q-item-section>
          </q-item>

          <q-item v-if="currentItem?.type === 'file'" clickable v-close-popup @click="downloadItem(currentItem)">
            <q-item-section avatar>
              <q-icon name="download" />
            </q-item-section>
            <q-item-section>Download</q-item-section>
          </q-item>

          <q-item clickable v-close-popup @click="handleRename(currentItem)">
            <q-item-section avatar>
              <q-icon name="edit" />
            </q-item-section>
            <q-item-section>Rename</q-item-section>
          </q-item>

          <q-item clickable v-close-popup @click="handleShare(currentItem)">
            <q-item-section avatar>
              <q-icon name="share" />
            </q-item-section>
            <q-item-section>Share</q-item-section>
          </q-item>

          <q-separator />

          <q-item clickable v-close-popup @click="handleDelete(currentItem)">
            <q-item-section avatar>
              <q-icon name="delete" color="red" />
            </q-item-section>
            <q-item-section>Delete</q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>

    <!-- Bulk actions toolbar -->
    <transition name="slide-up">
      <div v-if="selectedItems.length > 0" class="bulk-actions-bar">
        <div class="bulk-actions-content">
          <div class="bulk-actions-info">
            <q-checkbox
              v-model="selectAll"
              @update:model-value="handleSelectAll"
              :indeterminate="selectedItems.length > 0 && selectedItems.length < items.length"
            />
            <span class="bulk-actions-count">
              {{ selectedItems.length }} {{ selectedItems.length === 1 ? 'item' : 'items' }} selected
            </span>
          </div>

          <q-space />

          <div class="bulk-actions-buttons">
            <q-btn
              flat
              dense
              icon="drive_file_move"
              label="Move"
              @click="handleBulkMove(selectedItems)"
              class="q-mr-sm"
            />
            <q-btn
              flat
              dense
              icon="refresh"
              label="Refresh Cache"
              color="orange"
              @click="handleBulkRefreshCache"
              class="q-mr-sm"
            />
            <q-btn
              flat
              dense
              icon="delete"
              label="Delete"
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
    </transition>
  </div>

  <!-- Child component dialogs -->
  <file-preview ref="preview" />
  <file-options ref="options" />
  <media-gallery ref="gallery" :mediaFiles="mediaFiles" :bucket="bucket" />
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
import {
	computed,
	defineComponent,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	apiHandler,
	buildFileAccessUrl,
	decode,
	encode,
	getThumbnailUrl,
	isMediaFile,
	ROOT_FOLDER,
} from "../../appUtils";

export default defineComponent({
	name: "FileBrowser",
	components: {
		DragAndDrop,
		FileContextMenu,
		FileOptions,
		FilePreview,
		MediaGallery,
		CacheBustDialog,
		MoveFolderPickerDialog,
	},
	props: {
		bucket: {
			type: String,
			required: true,
		},
		folder: {
			type: String,
			default: "",
		},
	},
	setup(props) {
		const $q = useQuasar();
		const route = useRoute();
		const router = useRouter();
		const mainStore = useMainStore();

		// Refs
		const preview = ref(null);
		const options = ref(null);
		const gallery = ref(null);
		const cacheDialog = ref(null);
		const moveDialog = ref(null);
		const uploader = ref(null);

		// State
		const loading = ref(false);
		const items = ref([]);
		const selectedItems = ref([]);
		const focusedIndex = ref(-1);
		const viewMode = ref(localStorage.getItem("fileBrowserView") || "grid");
		const selectionMode = ref(false);
		const dropTarget = ref(null);
		const draggedItems = ref([]);
		const showMobileActions = ref(false);
		const currentItem = ref(null);
		const showThumbnailsInList = ref(true);
		const touchTimer = ref(null);
		const touchStartTime = ref(0);
		const selectAll = ref(false);

		// Computed
		const selectedFolder = computed(() => {
			if (props.folder && props.folder !== ROOT_FOLDER) {
				return decode(props.folder);
			}
			return "";
		});

		const breadcrumbs = computed(() => {
			if (selectedFolder.value) {
				return [
					{
						name: props.bucket,
						path: "/",
					},
					...selectedFolder.value
						.split("/")
						.filter((obj) => obj !== "")
						.map((item, index, arr) => ({
							name: item,
							path: `${arr
								.slice(0, index + 1)
								.join("/")
								.replace("Home/", "")}/`,
						})),
				];
			}
			return [
				{
					name: props.bucket,
					path: "/",
				},
			];
		});

		const sortedItems = computed(() => {
			return [...items.value].sort((a, b) => {
				// Folders first
				if (a.type === "folder" && b.type !== "folder") return -1;
				if (a.type !== "folder" && b.type === "folder") return 1;
				// Then alphabetical
				return a.name.localeCompare(b.name);
			});
		});

		const mediaFiles = computed(() => {
			return items.value.filter(
				(item) => item.type === "file" && isMediaFile(item.name),
			);
		});

		// Methods
		const fetchFiles = async () => {
			loading.value = true;
			try {
				items.value = await apiHandler.fetchFile(
					props.bucket,
					selectedFolder.value,
					"/",
				);
			} catch (error) {
				console.error("Failed to fetch files:", error);
				$q.notify({
					type: "negative",
					message: "Failed to load files",
				});
			} finally {
				loading.value = false;
			}
		};

		const isSelected = (item) => {
			return selectedItems.value.some((selected) => selected.key === item.key);
		};

		const clearSelection = () => {
			selectedItems.value = [];
			selectionMode.value = false;
			selectAll.value = false;
		};

		const handleSelectAll = (value) => {
			if (value) {
				selectedItems.value = [...items.value];
			} else {
				selectedItems.value = [];
			}
		};

		const handleItemClick = (event, item, index) => {
			focusedIndex.value = index;

			if (event.ctrlKey || event.metaKey) {
				// Multi-select with Ctrl/Cmd
				const idx = selectedItems.value.findIndex((i) => i.key === item.key);
				if (idx >= 0) {
					selectedItems.value.splice(idx, 1);
				} else {
					selectedItems.value.push(item);
				}
			} else if (event.shiftKey && selectedItems.value.length > 0) {
				// Range selection
				const lastSelected =
					selectedItems.value[selectedItems.value.length - 1];
				const lastIndex = sortedItems.value.findIndex(
					(i) => i.key === lastSelected.key,
				);
				const start = Math.min(lastIndex, index);
				const end = Math.max(lastIndex, index);
				for (let i = start; i <= end; i++) {
					const item = sortedItems.value[i];
					if (!isSelected(item)) {
						selectedItems.value.push(item);
					}
				}
			} else if (selectionMode.value) {
				// In selection mode, toggle selection
				const idx = selectedItems.value.findIndex((i) => i.key === item.key);
				if (idx >= 0) {
					selectedItems.value.splice(idx, 1);
				} else {
					selectedItems.value.push(item);
				}
			} else if (selectedItems.value.length > 0) {
				// If items are selected, clear selection and open item
				clearSelection();
				openItem(item);
			} else {
				// Normal click - open item (folder or file)
				openItem(item);
			}
		};

		const handleItemDoubleClick = (event, item) => {
			event.preventDefault();
			clearSelection();
			openItem(item);
		};

		const handleContextMenu = (event, item) => {
			event.preventDefault();
			if (!isSelected(item)) {
				selectedItems.value = [item];
			}
			currentItem.value = item;

			if ($q.platform.is.mobile) {
				showMobileActions.value = true;
			}
		};

		const handleTouchStart = (_event, item, index) => {
			touchStartTime.value = Date.now();
			currentItem.value = item;
			focusedIndex.value = index;

			// Long press detection for selection mode
			touchTimer.value = setTimeout(() => {
				if (!selectionMode.value) {
					selectionMode.value = true;
					selectedItems.value = [item];
					if (navigator.vibrate) {
						navigator.vibrate(50);
					}
				}
			}, 500);
		};

		const handleTouchEnd = (_event) => {
			if (touchTimer.value) {
				clearTimeout(touchTimer.value);
				touchTimer.value = null;
			}

			const touchDuration = Date.now() - touchStartTime.value;
			if (touchDuration < 500 && !selectionMode.value) {
				// Short tap - open item
				if (currentItem.value?.type === "folder") {
					openItem(currentItem.value);
				}
			}
		};

		const handleTouchMove = () => {
			if (touchTimer.value) {
				clearTimeout(touchTimer.value);
				touchTimer.value = null;
			}
		};

		const handleContentClick = (event) => {
			// Clear selection if clicking on empty space
			if (
				event.target.classList.contains("file-browser-content") ||
				event.target.classList.contains("file-grid") ||
				event.target.classList.contains("file-list-body")
			) {
				clearSelection();
			}
		};

		const openItem = (item) => {
			if (item.type === "folder") {
				router.push({
					name: "files-folder",
					params: {
						bucket: props.bucket,
						folder: encode(item.key),
					},
				});
			} else {
				preview.value?.openFile(item);
			}
		};

		const downloadItem = (item) => {
			const link = document.createElement("a");
			link.download = item.name;
			link.href = buildFileAccessUrl(props.bucket, item.key);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		};

		const onBreadcrumbClick = (crumb) => {
			router.push({
				name: "files-folder",
				params: {
					bucket: props.bucket,
					folder: encode(crumb.path),
				},
			});
		};

		const handleImageError = (event, item) => {
			// Log detailed error information
			console.group('🖼️ Failed to load thumbnail');
			console.warn('File:', item.name);
			console.warn('URL:', event.target.src);
			console.warn('Item key:', item.key);
			console.warn('Bucket:', props.bucket);
			
			// Check for network or CORS issues
			if (event.target.complete === false) {
				console.warn('Image failed to complete loading - possible network or CORS issue');
			}
			
			console.groupEnd();
			
			// Hide the broken image
			event.target.style.display = "none";
			
			// Check if we already added a fallback icon to avoid duplicates
			const parent = event.target.parentElement;
			if (parent.querySelector('.fallback-icon')) {
				return;
			}
			
			// Create a fallback icon element
			const iconWrapper = document.createElement("div");
			iconWrapper.className = "fallback-icon";
			iconWrapper.style.cssText = "display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;";
			
			const icon = document.createElement("i");
			icon.className = `q-icon notranslate material-icons text-${item.color}`;
			icon.style.fontSize = "48px";
			icon.setAttribute("aria-hidden", "true");
			icon.setAttribute("role", "img");
			icon.textContent = item.icon;
			
			iconWrapper.appendChild(icon);
			parent.appendChild(iconWrapper);
		};

		const handleImageLoad = (_event, item) => {
			// Log successful loads for debugging
			if (import.meta.env.DEV) {
				console.log('Successfully loaded thumbnail for:', item.name);
			}
		};

		const getItemCount = (_folder) => {
			// This would need to be implemented with API support
			return "Folder";
		};

		const showContextMenu = (_event, item) => {
			currentItem.value = item;
			if (!isSelected(item)) {
				selectedItems.value = [item];
			}
		};

		// Drag and drop
		const handleDragStart = (event, item) => {
			if (mainStore.apiReadonly) {
				event.preventDefault();
				return;
			}

			if (selectedItems.value.length > 0 && isSelected(item)) {
				draggedItems.value = [...selectedItems.value];
			} else {
				draggedItems.value = [item];
			}

			event.dataTransfer.effectAllowed = "move";
			event.dataTransfer.setData(
				"text/plain",
				JSON.stringify(draggedItems.value.map((item) => item.key)),
			);
		};

		const handleDragOver = (event, item) => {
			if (mainStore.apiReadonly || item.type !== "folder") {
				return;
			}

			const draggedKeys = draggedItems.value.map((item) => item.key);
			if (draggedKeys.includes(item.key)) {
				return;
			}

			event.preventDefault();
			event.dataTransfer.dropEffect = "move";
			dropTarget.value = item.key;
		};

		const handleDragLeave = (_event) => {
			dropTarget.value = null;
		};

		const handleDrop = async (event, targetItem) => {
			event.preventDefault();
			dropTarget.value = null;

			if (
				mainStore.apiReadonly ||
				targetItem.type !== "folder" ||
				draggedItems.value.length === 0
			) {
				return;
			}

			const destinationFolder = targetItem.key;
			const notif = $q.notify({
				group: false,
				spinner: true,
				message: `Moving ${draggedItems.value.length} item${draggedItems.value.length > 1 ? "s" : ""}...`,
				caption: "0%",
				timeout: 0,
			});

			try {
				for (let i = 0; i < draggedItems.value.length; i++) {
					const item = draggedItems.value[i];
					const fileName = item.key.split("/").pop();
					const newKey = `${destinationFolder}${fileName}`;

					await apiHandler.renameObject(props.bucket, item.key, newKey);

					notif({
						caption: `${Math.round(((i + 1) * 100) / draggedItems.value.length)}%`,
					});
				}

				notif({
					icon: "done",
					spinner: false,
					caption: "100%",
					message: "Items moved successfully!",
					timeout: 2500,
				});

				draggedItems.value = [];
				clearSelection();
				fetchFiles();
			} catch (error) {
				notif({
					icon: "error",
					spinner: false,
					message: `Failed to move items: ${error.message}`,
					color: "negative",
					timeout: 5000,
				});
				draggedItems.value = [];
			}
		};

		// File operations
		const handleDelete = (item) => {
			options.value?.deleteObject(item || currentItem.value);
		};

		const handleRename = (item) => {
			options.value?.renameObject(item || currentItem.value);
		};

		const handleUpdateMetadata = (item) => {
			options.value?.updateMetadataObject(item || currentItem.value);
		};

		const handleShare = async (item) => {
			const target = item || currentItem.value;
			let url;

			if (target.type === "folder") {
				url =
					window.location.origin +
					router.resolve({
						name: "files-folder",
						params: {
							bucket: props.bucket,
							folder: encode(target.key),
						},
					}).href;
			} else {
				url = buildFileAccessUrl(props.bucket, target.key);
			}

			try {
				await navigator.clipboard.writeText(url);
				$q.notify({
					message: "Link copied to clipboard!",
					timeout: 2500,
					type: "positive",
				});
			} catch (err) {
				$q.notify({
					message: `Failed to copy: ${err}`,
					timeout: 5000,
					type: "negative",
				});
			}
		};

		const handleRefreshCache = async (item) => {
			const target = item || currentItem.value;
			const isFolder = target.type === "folder";
			let filesToRefresh = [];

			if (isFolder) {
				const folderContents = await apiHandler.fetchFile(
					props.bucket,
					target.key,
					"",
				);
				filesToRefresh = folderContents.filter((f) => f.type === "file");
			} else {
				filesToRefresh = [target];
			}

			cacheDialog.value?.open({
				bucket: props.bucket,
				files: filesToRefresh,
				fileCount: filesToRefresh.length,
				itemName: target.name,
				isRecursive: isFolder,
				onComplete: () => {
					fetchFiles();
				},
			});
		};

		const handleBulkMove = (items) => {
			moveDialog.value?.open(items || selectedItems.value);
		};

		const handleBulkDelete = () => {
			if (selectedItems.value.length === 1) {
				options.value?.deleteObject(selectedItems.value[0]);
			} else {
				options.value?.bulkDeleteObjects(selectedItems.value);
			}
		};

		const handleBulkRefreshCache = async () => {
			const filesToRefresh = [];

			for (const item of selectedItems.value) {
				if (item.type === "folder") {
					const folderContents = await apiHandler.fetchFile(
						props.bucket,
						item.key,
						"",
					);
					filesToRefresh.push(
						...folderContents.filter((f) => f.type === "file"),
					);
				} else {
					filesToRefresh.push(item);
				}
			}

			cacheDialog.value?.open({
				bucket: props.bucket,
				files: filesToRefresh,
				fileCount: filesToRefresh.length,
				itemName: `${selectedItems.value.length} items`,
				isRecursive: false,
				onComplete: () => {
					fetchFiles();
					clearSelection();
				},
			});
		};

		const handleMoveComplete = () => {
			clearSelection();
			fetchFiles();
		};

		const openGallery = (file) => {
			const mediaIndex = mediaFiles.value.findIndex((f) => f.key === file.key);
			if (mediaIndex !== -1) {
				gallery.value?.open(mediaIndex);
			}
		};

		// Keyboard navigation
		const handleKeyDown = (event) => {
			if (items.value.length === 0) return;

			switch (event.key) {
				case "ArrowDown":
					event.preventDefault();
					if (focusedIndex.value < sortedItems.value.length - 1) {
						focusedIndex.value++;
					}
					break;
				case "ArrowUp":
					event.preventDefault();
					if (focusedIndex.value > 0) {
						focusedIndex.value--;
					}
					break;
				case "Enter":
					event.preventDefault();
					if (
						focusedIndex.value >= 0 &&
						focusedIndex.value < sortedItems.value.length
					) {
						openItem(sortedItems.value[focusedIndex.value]);
					}
					break;
				case " ":
					event.preventDefault();
					if (
						focusedIndex.value >= 0 &&
						focusedIndex.value < sortedItems.value.length
					) {
						const item = sortedItems.value[focusedIndex.value];
						const idx = selectedItems.value.findIndex(
							(i) => i.key === item.key,
						);
						if (idx >= 0) {
							selectedItems.value.splice(idx, 1);
						} else {
							selectedItems.value.push(item);
						}
					}
					break;
				case "Delete":
				case "Backspace":
					event.preventDefault();
					if (selectedItems.value.length > 0) {
						handleBulkDelete();
					} else if (focusedIndex.value >= 0) {
						options.value?.deleteObject(sortedItems.value[focusedIndex.value]);
					}
					break;
				case "Escape":
					event.preventDefault();
					clearSelection();
					focusedIndex.value = -1;
					break;
				case "a":
				case "A":
					if (event.metaKey || event.ctrlKey) {
						event.preventDefault();
						selectedItems.value = [...items.value];
					}
					break;
			}
		};

		// Watch view mode changes
		watch(viewMode, (newMode) => {
			localStorage.setItem("fileBrowserView", newMode);
		});

		// Lifecycle
		onMounted(() => {
			fetchFiles();
			document.addEventListener("keydown", handleKeyDown);

			// Handle file preview from route
			if (route.params.file) {
				nextTick(async () => {
					let key = decode(route.params.file);
					if (selectedFolder.value && selectedFolder.value !== ROOT_FOLDER) {
						key = `${selectedFolder.value}${decode(route.params.file)}`;
					}
					const file = await apiHandler.headFile(props.bucket, key);
					preview.value?.openFile(file);
				});
			}
		});

		onBeforeUnmount(() => {
			document.removeEventListener("keydown", handleKeyDown);
		});

		// Watch for folder changes
		watch(() => props.folder, fetchFiles);
		watch(() => props.bucket, fetchFiles);

		return {
			// Refs
			preview,
			options,
			gallery,
			cacheDialog,
			moveDialog,
			uploader,

			// State
			loading,
			items,
			selectedItems,
			focusedIndex,
			viewMode,
			selectionMode,
			dropTarget,
			draggedItems,
			showMobileActions,
			currentItem,
			showThumbnailsInList,
			selectAll,

			// Computed
			selectedFolder,
			breadcrumbs,
			sortedItems,
			mediaFiles,

			// Methods
			fetchFiles,
			isSelected,
			clearSelection,
			handleSelectAll,
			handleItemClick,
			handleItemDoubleClick,
			handleContextMenu,
			handleTouchStart,
			handleTouchEnd,
			handleTouchMove,
			handleContentClick,
			openItem,
			downloadItem,
			onBreadcrumbClick,
			handleImageError,
			handleImageLoad,
			getItemCount,
			showContextMenu,
			handleDragStart,
			handleDragOver,
			handleDragLeave,
			handleDrop,
			handleDelete,
			handleRename,
			handleUpdateMetadata,
			handleShare,
			handleRefreshCache,
			handleBulkMove,
			handleBulkDelete,
			handleBulkRefreshCache,
			handleMoveComplete,
			openGallery,

			// Utils
			isMediaFile,
			getThumbnailUrl,

			// Store
			mainStore,
			$q,
		};
	},
});
</script>

<style lang="scss" scoped>
.file-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;

  &.mobile-view {
    .file-browser-header {
      padding: 8px 12px;
    }

    .file-grid {
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 8px;
      padding: 8px;
    }

    .file-card {
      padding: 8px;

      .file-card-name {
        font-size: 12px;
      }

      .file-card-meta {
        font-size: 10px;
      }
    }
  }
}

.file-browser-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  gap: 16px;
  flex-wrap: wrap;

  @media (max-width: 599px) {
    padding: 8px 12px;
  }
}

.file-browser-breadcrumbs {
  flex: 1;
  min-width: 0;

  .cursor-pointer {
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}

.view-toggle {
  flex-shrink: 0;
}

.file-browser-content {
  flex: 1;
  overflow: auto;
  background: #f5f5f5;
  position: relative;
}

// Loading and empty states
.loading-container,
.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
}

// Grid View
.grid-view {
  padding: 16px;

  @media (max-width: 599px) {
    padding: 8px;
  }
}

.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;

  @media (max-width: 599px) {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }

  @media (min-width: 1280px) {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
}

.file-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  border: 2px solid transparent;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

    .file-card-actions {
      opacity: 1;
    }
  }

  &.selected {
    border-color: var(--q-primary);
    background: rgba(33, 150, 243, 0.05);

    .file-card-checkbox {
      opacity: 1;
    }
  }

  &.drop-target {
    border-color: var(--q-primary);
    background: rgba(33, 150, 243, 0.1);
    transform: scale(1.02);
  }

  &.focused {
    outline: 2px solid var(--q-primary);
    outline-offset: -2px;
  }
}

.file-card-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s;

  .file-card:hover & {
    opacity: 1;
  }
}

.file-card-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  margin-bottom: 8px;

  @media (max-width: 599px) {
    height: 60px;
  }
}

.file-thumbnail-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
}

.file-card-info {
  text-align: center;
}

.file-card-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.2;
  min-height: 2.4em;
  word-break: break-word;
}

.file-card-meta {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.file-card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

// List View
.list-view {
  background: white;
  margin: 16px;
  border-radius: 8px;
  overflow: hidden;

  @media (max-width: 599px) {
    margin: 8px;
    border-radius: 4px;
  }
}

.file-list {
  display: flex;
  flex-direction: column;
}

.file-list-header {
  display: flex;
  align-items: center;
  padding: 0;
  background: #fafafa;
  border-bottom: 2px solid #e0e0e0;
  font-weight: 600;
  font-size: 14px;
  color: #666;
  position: sticky;
  top: 0;
  z-index: 10;
}

.file-list-body {
  flex: 1;
}

.file-list-row {
  display: flex;
  align-items: center;
  min-height: 56px;
  border-bottom: 1px solid #e0e0e0;
  cursor: pointer;
  transition: background 0.2s;

  @media (max-width: 599px) {
    min-height: 48px;
  }

  &:hover {
    background: #f5f5f5;
  }

  &.selected {
    background: rgba(33, 150, 243, 0.08);
  }

  &.drop-target {
    background: rgba(33, 150, 243, 0.15);
    box-shadow: inset 0 0 0 2px var(--q-primary);
  }

  &.focused {
    outline: 2px solid var(--q-primary);
    outline-offset: -2px;
  }
}

.file-list-cell {
  padding: 8px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  @media (max-width: 599px) {
    padding: 6px 8px;
    font-size: 14px;
  }
}

.file-list-select {
  width: 48px;
  flex-shrink: 0;
}

.file-list-name {
  flex: 1;
  min-width: 0;
}

.file-list-name-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-list-name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-list-thumbnail {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 4px;
  flex-shrink: 0;
}

.file-list-modified {
  width: 150px;
  flex-shrink: 0;

  @media (max-width: 768px) {
    display: none;
  }
}

.file-list-size {
  width: 100px;
  flex-shrink: 0;

  @media (max-width: 599px) {
    display: none;
  }
}

.file-list-actions {
  width: 48px;
  flex-shrink: 0;
}

// Mobile action sheet
.mobile-action-sheet {
  width: 100%;
  max-width: 100%;
}

// Bulk actions bar
.bulk-actions-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  max-width: 90%;
  width: auto;
  min-width: 400px;

  @media (max-width: 599px) {
    bottom: 16px;
    left: 16px;
    right: 16px;
    transform: none;
    min-width: auto;
    width: auto;
    border-radius: 4px;
  }
}

.bulk-actions-content {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  gap: 16px;

  @media (max-width: 599px) {
    flex-direction: column;
    align-items: stretch;
    padding: 12px;
    gap: 8px;
  }
}

.bulk-actions-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bulk-actions-count {
  font-weight: 500;
  color: #333;
}

.bulk-actions-buttons {
  display: flex;
  align-items: center;
  gap: 8px;

  @media (max-width: 599px) {
    justify-content: space-between;
    flex-wrap: wrap;

    .q-btn {
      flex: 1;
      min-width: 0;
    }
  }
}

// Animations
.grid-item-enter-active,
.grid-item-leave-active,
.list-item-enter-active,
.list-item-leave-active {
  transition: all 0.3s ease;
}

.grid-item-enter-from,
.list-item-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.grid-item-leave-to,
.list-item-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>