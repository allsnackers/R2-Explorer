<template>
  <q-btn dense flat round icon="menu" @click="$emit('toggle')" />

  <q-toolbar-title style="overflow: unset" class="text-bold">
    <router-link :to="homeRoute" class="topbar-home-link">
      <q-avatar class="topbar-avatar">
        <img src="/logo-white.svg">
      </q-avatar>
      <span>R2-Explorer</span>
    </router-link>
  </q-toolbar-title>
  <q-space />
  <div v-if="mainStore.buckets.length > 1">
    <bucket-picker/>
  </div>
</template>

<script>
import BucketPicker from "components/main/BucketPicker.vue";
import { useMainStore } from "stores/main-store";
import { computed, defineComponent } from "vue";
import { useRoute } from "vue-router";

export default defineComponent({
	name: "TopBar",
	emits: ["toggle"],
	components: { BucketPicker },
	setup() {
		const mainStore = useMainStore();
		const route = useRoute();

		const homeRoute = computed(() => {
			const bucket = route.params.bucket || mainStore.buckets?.[0]?.name;
			if (bucket) {
				return { name: "files-home", params: { bucket } };
			}
			return { name: "home" };
		});

		return { mainStore, homeRoute };
	},
});
</script>

<style scoped>
.topbar-home-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: inherit;
  text-decoration: none;
}

.topbar-home-link:hover {
  text-decoration: underline;
}

.topbar-avatar {
  background: transparent;
}
</style>
