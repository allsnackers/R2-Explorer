<template>
  <q-page class="files-folder-page">
    <file-browser
      :bucket="selectedBucket"
      :folder="$route.params.folder"
    />
  </q-page>
</template>

<script>
import { defineComponent } from "vue";
import FileBrowser from "components/files/FileBrowser.vue";

export default defineComponent({
	name: "FilesIndexPage",
	components: {
		FileBrowser,
	},
	computed: {
		selectedBucket: function () {
			return this.$route.params.bucket;
		},
	},
});
</script>

<style scoped>
.files-folder-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
