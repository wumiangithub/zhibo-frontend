<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDialog } from "element-plus";

const props = defineProps<{
  modelValue: boolean;
  url: string;
  title?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [v: boolean];
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const videoRef = ref<HTMLVideoElement | null>(null);

watch(
  () => props.modelValue,
  (open) => {
    if (open) return;
    const el = videoRef.value;
    if (!el) return;
    el.pause();
    el.removeAttribute("src");
    el.load();
  },
);

function onClosed() {
  const el = videoRef.value;
  if (!el) return;
  el.pause();
}
</script>

<template>
  <ElDialog
    v-model="visible"
    :title="title || '视频预览'"
    width="800px"
    align-center
    destroy-on-close
    append-to-body
    class="material-video-preview-dlg"
    @closed="onClosed"
  >
    <div class="player-wrap">
      <video
        v-if="visible && url"
        ref="videoRef"
        class="player"
        :src="url"
        controls
        autoplay
        playsinline
      />
      <p
        v-else
        class="empty"
      >
        暂无可播放地址
      </p>
    </div>
  </ElDialog>
</template>

<style scoped>
.player-wrap {
  min-height: 360px;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  overflow: hidden;
}

.player {
  width: 100%;
  max-height: 70vh;
  outline: none;
  background: #000;
}

.empty {
  margin: 0;
  color: rgba(255, 255, 255, 0.65);
  font-size: 14px;
}
</style>
