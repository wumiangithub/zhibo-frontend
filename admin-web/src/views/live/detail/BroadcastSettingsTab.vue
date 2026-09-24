<script setup lang="ts">
import { ref } from "vue";
import { getHostUrl } from "@/api/activity";
import { useToast } from "@/composables/useToast";
import UiButton from "@/components/ui/UiButton.vue";

const props = defineProps<{ activityId: number }>();
const emit = defineEmits<{ error: [msg: string] }>();

const { toast } = useToast();
const subTab = ref<"method" | "role" | "relay" | "notify">("method");
const opening = ref(false);

const subTabs = [
  { key: "method" as const, label: "开播方式" },
  { key: "role" as const, label: "角色设置" },
  { key: "relay" as const, label: "转播设置" },
  { key: "notify" as const, label: "通知设置" },
];

function onSubTab(key: (typeof subTabs)[number]["key"]) {
  if (key === "method") {
    subTab.value = key;
    return;
  }
  toast(`「${subTabs.find((t) => t.key === key)?.label}」暂未开放`);
}

async function openHost() {
  opening.value = true;
  try {
    const { hostUrl } = await getHostUrl(props.activityId);
    window.open(hostUrl, "_blank", "noopener");
  } catch (e) {
    emit("error", e instanceof Error ? e.message : "获取开播链接失败");
  } finally {
    opening.value = false;
  }
}
</script>

<template>
  <div class="broadcast-tab">
    <div class="sub-tabs">
      <button
        v-for="t in subTabs"
        :key="t.key"
        type="button"
        class="sub-tab"
        :class="{ 'is-active': subTab === t.key }"
        @click="onSubTab(t.key)"
      >
        {{ t.label }}
      </button>
    </div>

    <template v-if="subTab === 'method'">
      <section class="block">
        <h3 class="block-title">邀请主播</h3>
        <p class="block-desc">
          可将开播权限分享给他人，对方通过链接或客户端以主播身份进入直播间。
        </p>
        <UiButton
          variant="outline"
          @click="toast('「邀请主播」暂未开放')"
        >
          邀请主播
        </UiButton>
      </section>

      <section class="block">
        <h3 class="block-title">自己开播</h3>
        <div class="host-cards">
          <div class="host-card">
            <div class="host-card__icon">PC</div>
            <div class="host-card__body">
              <p class="host-card__name">钱坤云直播客户端</p>
              <p class="host-card__desc">专业模式 / 标准模式，适合电脑摄像头或推流开播</p>
              <div class="host-card__actions">
                <UiButton
                  variant="primary"
                  :disabled="opening"
                  @click="openHost"
                >
                  {{ opening ? "打开中…" : "客户端开播" }}
                </UiButton>
                <UiButton
                  variant="link"
                  @click="toast('「客户端下载」暂未开放')"
                >
                  下载客户端
                </UiButton>
              </div>
            </div>
          </div>

          <div class="host-card">
            <div class="host-card__icon is-app">APP</div>
            <div class="host-card__body">
              <p class="host-card__name">钱坤云直播 APP</p>
              <p class="host-card__desc">支持美颜、屏幕共享等，适合手机端开播</p>
              <div class="host-card__actions">
                <UiButton
                  variant="primary"
                  @click="toast('「APP 开播」暂未开放')"
                >
                  APP 开播
                </UiButton>
              </div>
              <UiButton
                variant="link"
                class="mt-2"
                @click="toast('「小程序开播」暂未开放')"
              >
                钱坤云直播小程序
              </UiButton>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.sub-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--color-border-light);
}
.sub-tab {
  border: 0;
  background: transparent;
  padding: 10px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  outline: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.sub-tab.is-active {
  color: var(--color-primary);
  font-weight: 600;
  border-bottom-color: var(--color-primary);
}
.block {
  margin-bottom: 28px;
}
.block-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}
.block-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--color-text-placeholder);
  line-height: 1.5;
}
.host-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.host-card {
  display: flex;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fafbfc;
}
.host-card__icon {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.host-card__icon.is-app {
  background: #f6ffed;
  color: var(--color-success);
}
.host-card__name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.host-card__desc {
  margin: 4px 0 12px;
  font-size: 12px;
  color: var(--color-text-placeholder);
  line-height: 1.5;
}
.host-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
</style>
