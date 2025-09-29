<template>
  <q-dialog v-model="showDialog" @hide="reset">
    <q-card style="min-width: 500px; max-width: 600px;">
      <q-card-section>
        <div class="text-h6">Move {{ itemsToMove.length }} item{{ itemsToMove.length > 1 ? 's' : '' }}</div>
        <div class="text-caption text-grey-7">Select a destination folder</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-breadcrumbs class="q-mb-md">
          <q-breadcrumbs-el
            style="cursor: pointer"
            v-for="(crumb, index) in breadcrumbs"
            :key="index"
            :label="crumb.name"
            @click="navigateToFolder(crumb.path)"
          />
        </q-breadcrumbs>

        <q-list bordered class="rounded-borders" style="max-height: 400px; overflow-y: auto;">
          <q-item
            v-for="folder in availableFolders"
            :key="folder.key"
            clickable
            @click="selectFolder(folder)"
            :active="selectedFolder && selectedFolder.key === folder.key"
          >
            <q-item-section avatar>
              <q-icon name="folder" color="orange" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ folder.name }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                dense
                round
                icon="chevron_right"
                @click.stop="navigateIntoFolder(folder)"
              />
            </q-item-section>
          </q-item>

          <q-item v-if="availableFolders.length === 0">
            <q-item-section>
              <q-item-label class="text-grey-7">No folders available</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-if="selectedFolder" class="q-mt-md q-pa-md bg-blue-1 rounded">
          <div class="text-caption text-grey-7">Selected destination:</div>
          <div class="text-body2">{{ selectedFolder.key }}</div>
        </div>
      </q-card-section>

      <q-card-section v-if="moving">
        <q-linear-progress :value="moveProgress" color="primary" />
        <div class="text-caption text-center q-mt-sm">
          Moving {{ movedCount }} of {{ itemsToMove.length }} items...
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="grey" v-close-popup :disable="moving" />
        <q-btn
          flat
          label="Move Here"
          color="primary"
          :disable="!selectedFolder || moving"
          :loading="moving"
          @click="moveItems"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { useQuasar } from "quasar";
import { apiHandler } from "src/appUtils";
import { useMainStore } from "stores/main-store";
import { defineComponent } from "vue";

export default defineComponent({
	name: "MoveFolderPickerDialog",
	data: () => ({
		showDialog: false,
		itemsToMove: [],
		currentPath: "",
		selectedFolder: null,
		availableFolders: [],
		moving: false,
		moveProgress: 0,
		movedCount: 0,
		loading: false,
	}),
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
		breadcrumbs: function () {
			if (!this.currentPath || this.currentPath === "/") {
				return [{ name: this.selectedBucket, path: "" }];
			}

			const parts = this.currentPath.split("/").filter((p) => p !== "");
			const crumbs = [{ name: this.selectedBucket, path: "" }];

			for (let i = 0; i < parts.length; i++) {
				crumbs.push({
					name: parts[i],
					path: `${parts.slice(0, i + 1).join("/")}/`,
				});
			}

			return crumbs;
		},
	},
	methods: {
		open: function (items) {
			this.itemsToMove = items || [];
			this.showDialog = true;
			this.currentPath = "";
			this.selectedFolder = null;
			this.fetchFolders();
		},
		reset: function () {
			this.itemsToMove = [];
			this.currentPath = "";
			this.selectedFolder = null;
			this.availableFolders = [];
			this.moving = false;
			this.moveProgress = 0;
			this.movedCount = 0;
		},
		fetchFolders: async function () {
			this.loading = true;
			try {
				const allItems = await apiHandler.fetchFile(
					this.selectedBucket,
					this.currentPath,
					"/",
				);

				const itemKeys = this.itemsToMove.map((item) => item.key);
				this.availableFolders = allItems
					.filter((item) => item.type === "folder")
					.filter((folder) => !itemKeys.includes(folder.key));
			} catch (error) {
				this.q.notify({
					type: "negative",
					message: `Failed to load folders: ${error.message}`,
					timeout: 5000,
				});
			} finally {
				this.loading = false;
			}
		},
		navigateToFolder: function (path) {
			this.currentPath = path;
			this.selectedFolder = null;
			this.fetchFolders();
		},
		navigateIntoFolder: function (folder) {
			this.currentPath = folder.key;
			this.selectedFolder = null;
			this.fetchFolders();
		},
		selectFolder: function (folder) {
			this.selectedFolder = folder;
		},
		moveItems: async function () {
			if (!this.selectedFolder) return;

			this.moving = true;
			this.moveProgress = 0;
			this.movedCount = 0;

			try {
				for (let i = 0; i < this.itemsToMove.length; i++) {
					const item = this.itemsToMove[i];
					const fileName = item.key.split("/").pop();
					const newKey = `${this.selectedFolder.key}${fileName}`;

					await apiHandler.renameObject(this.selectedBucket, item.key, newKey);

					this.movedCount++;
					this.moveProgress = this.movedCount / this.itemsToMove.length;
				}

				this.q.notify({
					type: "positive",
					message: `Successfully moved ${this.itemsToMove.length} item${this.itemsToMove.length > 1 ? "s" : ""}!`,
					timeout: 2500,
				});

				this.showDialog = false;
				this.$emit("move");
			} catch (error) {
				this.q.notify({
					type: "negative",
					message: `Failed to move items: ${error.message}`,
					timeout: 5000,
				});
			} finally {
				this.moving = false;
			}
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