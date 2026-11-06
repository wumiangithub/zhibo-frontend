<script setup lang="ts">
defineProps<{
  open: boolean;
  pageUrl: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-show="open"
      class="filter-layer"
      @click.self="emit('close')"
    >
      <aside
        class="filter-drawer"
        role="dialog"
        aria-label="评论审核"
      >
        <header class="filter-head">
          <h2>评论审核</h2>
          <button
            type="button"
            class="filter-close"
            aria-label="关闭评论审核"
            @click="emit('close')"
          >
            ✕
          </button>
        </header>
        <div class="filter-body">
          <div
            v-if="loading && !pageUrl"
            class="filter-state"
          >
            加载中…
          </div>
          <iframe
            v-if="pageUrl"
            :src="pageUrl"
            class="filter-iframe"
            title="评论审核"
            allow="fullscreen"
          />
          <div
            v-else-if="!loading"
            class="filter-state"
          >
            暂无审核页
          </div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<style scoped>
.filter-layer {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgb(0 0 0 / 28%);
}

.filter-drawer {
  display: flex;
  flex-direction: column;
  width: min(800px, 92vw);
  height: 100%;
  overflow: hidden;
  background: #fff;
  box-shadow: 8px 0 28px rgb(0 0 0 / 16%);
  animation: filter-slide-in 0.22s ease-out;
}

.filter-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.filter-head h2 {
  margin: 0;
  flex: 1;
  overflow: hidden;
  color: #333;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-close {
  flex: none;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #666;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.filter-close:hover {
  background: #f5f5f5;
  color: #333;
}

.filter-body {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: #fafafa;
}

.filter-iframe {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.filter-state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 13px;
}

@keyframes filter-slide-in {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(0);
  }
}
</style>
