<template>
  <q-dialog
    v-model="isOpen"
    full-width
    full-height
    maximized
    @hide="handleClose"
    @keydown.left="navigatePrev"
    @keydown.right="navigateNext"
    @keydown.esc="handleClose"
  >
    <div class="media-gallery-backdrop">
      <div class="media-gallery-header">
        <div class="media-gallery-title">
          {{ currentMedia?.name || 'Media Viewer' }}
        </div>
        <div class="media-gallery-counter">
          {{ currentIndex + 1 }} / {{ mediaFiles.length }}
        </div>
        <q-btn
          flat
          round
          dense
          icon="close"
          color="white"
          size="lg"
          @click="handleClose"
          class="media-gallery-close"
        />
      </div>

      <div class="media-gallery-content" @click.self="handleClose">
        <q-btn
          v-if="mediaFiles.length > 1"
          flat
          round
          dense
          icon="chevron_left"
          color="white"
          size="xl"
          @click="navigatePrev"
          class="media-gallery-nav media-gallery-nav-prev"
          :disable="currentIndex === 0"
        />

        <div class="media-gallery-media-container">
          <template v-if="currentMedia">
            <template v-if="getMediaType(currentMedia.name) === 'image'">
              <img
                :src="getMediaUrl(currentMedia)"
                :alt="currentMedia.name"
                class="media-gallery-image"
                @click.stop
              />
            </template>
            <template v-else-if="getMediaType(currentMedia.name) === 'video'">
              <video
                :src="getMediaUrl(currentMedia)"
                controls
                autoplay
                class="media-gallery-video"
                @click.stop
              >
                Your browser does not support the video tag.
              </video>
            </template>
          </template>
        </div>

        <q-btn
          v-if="mediaFiles.length > 1"
          flat
          round
          dense
          icon="chevron_right"
          color="white"
          size="xl"
          @click="navigateNext"
          class="media-gallery-nav media-gallery-nav-next"
          :disable="currentIndex === mediaFiles.length - 1"
        />
      </div>

      <div class="media-gallery-footer">
        <div class="media-gallery-info">
          <span class="text-caption">{{ currentMedia?.size || '' }}</span>
          <span class="text-caption q-ml-md">{{ currentMedia?.lastModified || '' }}</span>
        </div>
      </div>
    </div>
  </q-dialog>
</template>

<script>
import { encode } from "src/appUtils";
import { useMainStore } from "stores/main-store";

export default {
	name: "MediaGallery",
	props: {
		mediaFiles: {
			type: Array,
			default: () => [],
		},
		initialIndex: {
			type: Number,
			default: 0,
		},
		bucket: {
			type: String,
			required: true,
		},
	},
	data() {
		return {
			isOpen: false,
			currentIndex: 0,
		};
	},
	computed: {
		currentMedia() {
			return this.mediaFiles[this.currentIndex] || null;
		},
	},
	methods: {
		open(index = 0) {
			this.currentIndex = index;
			this.isOpen = true;
		},
		handleClose() {
			this.isOpen = false;
			this.$emit("close");
		},
		navigatePrev() {
			if (this.currentIndex > 0) {
				this.currentIndex--;
			}
		},
		navigateNext() {
			if (this.currentIndex < this.mediaFiles.length - 1) {
				this.currentIndex++;
			}
		},
		getMediaType(filename) {
			const ext = filename.toLowerCase().split(".").pop();
			const imageExts = ["png", "jpg", "jpeg", "webp", "avif", "gif", "bmp", "svg"];
			const videoExts = ["mp4", "ogg", "webm", "mov"];

			if (imageExts.includes(ext)) return "image";
			if (videoExts.includes(ext)) return "video";
			return null;
		},
		getMediaUrl(file) {
			const mainStore = useMainStore();
			const cacheVersion = file.customMetadata?.["cache-version"] || Date.now();

			let baseUrl;
			if (
				mainStore.directLinkSettings.enabled &&
				mainStore.directLinkSettings.baseUrl
			) {
				baseUrl = `${mainStore.directLinkSettings.baseUrl}/${this.bucket}/${file.key}`;
			} else {
				baseUrl = `${mainStore.serverUrl}/api/buckets/${this.bucket}/${encode(file.key)}`;
			}

			return `${baseUrl}?v=${cacheVersion}`;
		},
	},
	watch: {
		initialIndex(newVal) {
			this.currentIndex = newVal;
		},
	},
	mounted() {
		document.addEventListener("keydown", this.handleKeydown);
	},
	beforeUnmount() {
		document.removeEventListener("keydown", this.handleKeydown);
	},
	setup() {
		return {
			mainStore: useMainStore(),
		};
	},
};
</script>

<style lang="scss" scoped>
.media-gallery-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  z-index: 9999;
}

.media-gallery-header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
}

.media-gallery-title {
  flex: 1;
  font-size: 18px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-gallery-counter {
  font-size: 16px;
  margin-right: 16px;
  color: rgba(255, 255, 255, 0.8);
}

.media-gallery-close {
  margin-left: 8px;
}

.media-gallery-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.media-gallery-media-container {
  max-width: 90%;
  max-height: 90%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-gallery-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
}

.media-gallery-video {
  max-width: 100%;
  max-height: 100%;
  outline: none;
}

.media-gallery-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: rgba(0, 0, 0, 0.5) !important;
  transition: background 0.2s;

  &:hover {
    background: rgba(0, 0, 0, 0.7) !important;
  }
}

.media-gallery-nav-prev {
  left: 24px;
}

.media-gallery-nav-next {
  right: 24px;
}

.media-gallery-footer {
  padding: 16px 24px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
}

.media-gallery-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.7);
}
</style>