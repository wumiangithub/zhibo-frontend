<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import SideIcon from "@/components/SideIcon.vue";
import { useToast } from "@/composables/useToast";

const route = useRoute();
const router = useRouter();
const { message, visible, toast } = useToast();

const topNav = [
  { key: "workbench", label: "工作台", to: "/" },
  { key: "course", label: "课程" },
  { key: "live", label: "直播", to: "/live" },
  { key: "mall", label: "商城" },
  { key: "scrm", label: "SCRM" },
  { key: "trade", label: "交易" },
  { key: "user", label: "用户" },
  { key: "data", label: "数据" },
  { key: "settings", label: "设置" },
  { key: "apps", label: "应用" },
] as const;

const workbenchSideNav = [
  { key: "overview", label: "概况", icon: "overview", to: "/" },
  { key: "live-console", label: "直播中控台", icon: "monitor" },
  { key: "live-data", label: "直播数据", icon: "chart" },
  { key: "series", label: "系列课", icon: "stack" },
  { key: "mp", label: "定制小程序", icon: "target" },
  { key: "app", label: "定制App", icon: "phone" },
  { key: "circle", label: "圈子管理", icon: "people" },
  { key: "assess", label: "适应性测评", icon: "clipboard" },
  { key: "public", label: "公域概况", icon: "globe" },
  { key: "users", label: "用户列表", icon: "user" },
  { key: "traffic", label: "流量中心", icon: "trend" },
  { key: "material", label: "素材中心", icon: "grid" },
] as const;

/** 直播模块侧栏：无图标，贴近截图 */
const liveSideNav = [
  { key: "create", label: "新建直播", to: "/activities/create" },
  { key: "manage", label: "直播管理", to: "/live" },
  { key: "data", label: "直播数据" },
  { key: "download", label: "软件下载" },
  { key: "settings", label: "通用设置" },
] as const;

const isLiveModule = computed(() => {
  const name = route.name;
  return (
    name === "live-manage" ||
    name === "activity-list" ||
    name === "activity-create" ||
    name === "activity-detail" ||
    name === "activity-stats" ||
    route.path.startsWith("/live") ||
    route.path.startsWith("/activities")
  );
});

const activeTop = computed(() => {
  if (isLiveModule.value) return "live";
  if (route.name === "dashboard" || route.path === "/") return "workbench";
  return "";
});

const activeSide = computed(() => {
  if (isLiveModule.value) {
    if (route.name === "activity-create") return "create";
    if (route.name === "live-manage" || route.path === "/live" || route.name === "activity-list") {
      return "manage";
    }
    // 详情 / 统计仍归在「直播管理」下高亮
    if (route.name === "activity-detail" || route.name === "activity-stats") return "manage";
    return "";
  }
  return route.name === "dashboard" || route.path === "/" ? "overview" : "";
});

const currentSideNav = computed(() => (isLiveModule.value ? liveSideNav : workbenchSideNav));

function sideIconOf(item: object): string | undefined {
  if ("icon" in item && typeof (item as { icon?: unknown }).icon === "string") {
    return (item as { icon: string }).icon;
  }
  return undefined;
}

function onShellClick(label: string) {
  toast(`「${label}」暂未开放`);
}

function goHome() {
  void router.push("/");
}
</script>

<template>
  <div class="flex h-dvh flex-col bg-[#f5f6f8] text-[#333] antialiased">
    <header class="z-20 flex h-[52px] flex-none items-center border-b border-[#ebebeb] bg-white px-5">
      <button
        type="button"
        class="group mr-7 flex flex-none items-center gap-2.5 border-0 bg-transparent p-0 outline-none"
        @click="goHome"
      >
        <span
          class="flex h-7 w-7 items-center justify-center rounded-full bg-[#e54d42] text-[11px] font-bold text-white transition-opacity group-hover:opacity-90"
        >
          钱坤
        </span>
        <span class="text-[15px] font-semibold text-[#1a1a1a] transition-colors group-hover:text-[#2f54eb]">
          钱坤云直播平台
        </span>
      </button>

      <nav class="top-nav flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[14px]">
        <template
          v-for="item in topNav"
          :key="item.key"
        >
          <RouterLink
            v-if="'to' in item && item.to"
            :to="item.to"
            class="top-nav-item"
            :class="{ 'is-active': activeTop === item.key }"
          >
            {{ item.label }}
          </RouterLink>
          <button
            v-else
            type="button"
            class="top-nav-item"
            @click="onShellClick(item.label)"
          >
            {{ item.label }}
          </button>
        </template>
      </nav>

      <div class="ml-3 flex flex-none items-center gap-2">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-[#666] outline-none transition-colors hover:bg-[#f0f0f0] hover:text-[#2f54eb]"
          title="搜索"
          @click="onShellClick('搜索')"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-full border-0 bg-transparent py-1 pl-1 pr-2 text-[13px] text-[#333] outline-none transition-colors hover:bg-[#f0f0f0]"
          @click="onShellClick('账号')"
        >
          <span class="flex h-7 w-7 items-center justify-center rounded-full bg-[#bfbfbf] text-white">
            <svg
              class="h-3.5 w-3.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
            </svg>
          </span>
          <span>管理员</span>
          <svg
            class="h-3 w-3 text-[#999]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <aside
        class="side-aside flex w-[176px] flex-none flex-col border-r border-[#ebebeb] bg-[#fafbfc]"
        :class="{ 'is-live-module': isLiveModule }"
      >
        <nav class="side-nav min-h-0 flex-1 space-y-0.5 px-2 py-3 text-[13px]">
          <template
            v-for="item in currentSideNav"
            :key="item.key"
          >
            <RouterLink
              v-if="'to' in item && item.to"
              :to="item.to"
              class="side-nav-item"
              :class="{ 'is-active': activeSide === item.key }"
            >
              <SideIcon
                v-if="sideIconOf(item)"
                :name="sideIconOf(item)!"
              />
              <span>{{ item.label }}</span>
            </RouterLink>
            <button
              v-else
              type="button"
              class="side-nav-item"
              @click="onShellClick(item.label)"
            >
              <SideIcon
                v-if="sideIconOf(item)"
                :name="sideIconOf(item)!"
              />
              <span>{{ item.label }}</span>
            </button>
          </template>
        </nav>

        <div
          v-if="!isLiveModule"
          class="box-border px-2 pb-3"
        >
          <button
            type="button"
            class="side-fav-btn"
            @click="onShellClick('常用功能')"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="currentColor"
              viewBox="0 0 16 16"
            >
              <circle
                cx="4"
                cy="4"
                r="1.5"
              />
              <circle
                cx="12"
                cy="4"
                r="1.5"
              />
              <circle
                cx="4"
                cy="12"
                r="1.5"
              />
              <circle
                cx="12"
                cy="12"
                r="1.5"
              />
            </svg>
            常用功能
          </button>
        </div>
      </aside>

      <main class="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
        <RouterView />
      </main>
    </div>

    <div
      v-if="visible"
      class="pointer-events-none fixed bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-md bg-[#1f2329]/90 px-4 py-2 text-sm text-white shadow-lg"
    >
      {{ message }}
    </div>
  </div>
</template>

<style scoped>
.side-aside,
.side-nav,
.side-nav-item,
.side-fav-btn,
.top-nav-item {
  box-sizing: border-box;
}

.side-aside {
  overflow: hidden;
}

.side-nav {
  overflow-x: hidden;
  overflow-y: auto;
}

.top-nav-item {
  flex: none;
  border: 0;
  border-radius: 0.375rem;
  background: transparent;
  padding: 0.375rem 0.75rem;
  font-size: 14px;
  color: #333;
  text-decoration: none;
  outline: none;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.top-nav-item:hover {
  color: #2f54eb;
  background: #f0f5ff;
  text-decoration: none;
}

.top-nav-item.is-active {
  color: #2f54eb;
  background: #e8f0ff;
  font-weight: 600;
  text-decoration: none;
}

.side-nav-item {
  display: flex;
  width: 100%;
  max-width: 100%;
  align-items: center;
  gap: 0.625rem;
  border: 0;
  border-radius: 0.375rem;
  background: transparent;
  padding: 0.625rem 0.75rem;
  text-align: left;
  text-decoration: none;
  font-size: 13px;
  color: #333;
  outline: none;
  transition: background-color 0.15s, color 0.15s;
}

.side-nav-item:hover,
.side-nav-item:focus,
.side-nav-item:active {
  text-decoration: none;
  background: #eef2ff;
  color: #2f54eb;
}

.side-nav-item.is-active {
  background: #e8f0ff;
  color: #2f54eb;
  font-weight: 600;
  text-decoration: none;
}

/* 直播模块选中：左侧蓝条，贴近参考图 */
.side-aside.is-live-module .side-nav-item.is-active {
  border-radius: 0 0.375rem 0.375rem 0;
  border-left: 3px solid #2f54eb;
  padding-left: calc(0.75rem - 3px);
}

.side-nav-item :deep(svg) {
  color: inherit;
  flex-shrink: 0;
}

.side-fav-btn {
  display: flex;
  width: 100%;
  max-width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  border: 0;
  border-radius: 0.375rem;
  background: #f0f0f0;
  padding: 0.5rem;
  font-size: 12px;
  color: #666;
  outline: none;
  transition: background-color 0.15s, color 0.15s;
}

.side-fav-btn:hover {
  background: #e8f0ff;
  color: #2f54eb;
}

header a {
  text-decoration: none;
}
</style>
