<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { ElMessageBox } from "element-plus";
import SideIcon from "@/components/SideIcon.vue";
import { useToast } from "@/composables/useToast";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { message, visible, toast } = useToast();

/** 顶栏通知未读数 Mock（UI 示意，接口未接） */
const mockUnreadNotificationCount = 5;

/** 用户模块侧栏「用户管理」分组是否展开 */
const userGroupOpen = ref(true);
/** 交易模块侧栏「订单管理」分组是否展开 */
const tradeGroupOpen = ref(true);
/** 工作台 / 直播模块「直播中控台」分组是否展开 */
const consoleGroupOpen = ref(true);

const consoleSubNav = [
  { key: "console-list", label: "直播列表", icon: "video", segment: "list" },
  { key: "console-quick-send", label: "快捷发送", icon: "plus", segment: "quick-send" },
  { key: "console-settings", label: "通用设置", icon: "settings", segment: "settings" },
] as const;

const topNav = [
  { key: "workbench", label: "工作台", to: "/" },
  { key: "course", label: "课程", to: "/course" },
  { key: "live", label: "直播", to: "/live" },
  { key: "trade", label: "交易", to: "/trade/orders" },
  { key: "user", label: "用户", to: "/user/list" },
  { key: "settings", label: "设置", to: "/settings/materials" },
] as const;

const workbenchSideNav = [
  { key: "overview", label: "概况", icon: "overview", to: "/" },
  { key: "live-console", label: "直播中控台", icon: "monitor" },
  { key: "live-data", label: "直播数据", icon: "chart" },
  { key: "course", label: "课程", icon: "stack", to: "/course" },
  { key: "users", label: "用户列表", icon: "user", to: "/user/list" },
  { key: "material", label: "素材中心", icon: "grid", to: "/settings/materials" },
  { key: "sep-more", label: "", divider: true },
  { key: "series", label: "系列课", icon: "stack" },
  { key: "mp", label: "定制小程序", icon: "target" },
  { key: "app", label: "定制App", icon: "phone" },
  { key: "circle", label: "圈子管理", icon: "people" },
  { key: "assess", label: "适应性测评", icon: "clipboard" },
  { key: "public", label: "公域概况", icon: "globe" },
  { key: "traffic", label: "流量中心", icon: "trend" },
] as const;

/** 直播模块侧栏：一级菜单统一带图标（同源功能与工作台同 icon） */
const liveSideNav = [
  { key: "report", label: "直播报备", icon: "clipboard", to: "/live-reports" },
  { key: "manage", label: "直播管理", icon: "video", to: "/live" },
  { key: "data", label: "直播数据", icon: "chart" },
  { key: "console", label: "直播中控台", icon: "monitor" },
  { key: "sep-tools", label: "", divider: true },
  { key: "download", label: "软件下载", icon: "download" },
  { key: "settings", label: "通用设置", icon: "settings" },
] as const;

const courseSideNav = [
  { key: "create", label: "新建课程", icon: "plus", to: "/course/create" },
  { key: "manage", label: "课程管理", icon: "stack", to: "/course" },
] as const;

/** 设置模块侧栏 */
const settingsSideNav = [
  { key: "materials", label: "素材中心", icon: "grid", to: "/settings/materials" },
  { key: "employees", label: "员工管理", icon: "people", to: "/settings/employees" },
  { key: "roles", label: "角色管理", icon: "user", to: "/settings/roles" },
] as const;

/** 顶栏用户模块侧栏（D79）；分组头为一级（已有 icon），下列为二级无 icon */
const userSideNav = [
  { key: "list", label: "用户列表", to: "/user/list" },
  { key: "learning-stats", label: "用户学习统计", to: "/user/learning-stats" },
  { key: "tags", label: "标签管理", to: "/user/tags" },
] as const;

/** 顶栏交易模块侧栏：订单管理（分组头为一级） */
const tradeSideNav = [
  { key: "orders", label: "全部订单", to: "/trade/orders" },
] as const;

const isWorkbenchConsole = computed(() => route.path.startsWith("/console"));

const isLiveModule = computed(() => {
  if (isWorkbenchConsole.value) return false;
  const name = route.name;
  return (
    name === "live-manage" ||
    route.path.startsWith("/live-reports") ||
    name === "live-create" ||
    name === "live-detail" ||
    route.path.startsWith("/live")
  );
});

const isOnConsoleRoutes = computed(
  () => isWorkbenchConsole.value || route.path.startsWith("/live/console"),
);

const activeConsoleSide = computed(() => {
  if (!isOnConsoleRoutes.value) return "";
  const name = String(route.name ?? "");
  if (name.includes("quick-send")) return "console-quick-send";
  if (name.includes("settings")) return "console-settings";
  return "console-list";
});

watch(
  isOnConsoleRoutes,
  (on) => {
    if (on) consoleGroupOpen.value = true;
  },
  { immediate: true },
);

const isCourseModule = computed(() => route.path === "/course" || route.path.startsWith("/course/"));

const isSettingsModule = computed(
  () => route.name === "settings-materials" || route.path.startsWith("/settings"),
);

const isUserModule = computed(() => route.path.startsWith("/user"));

const isTradeModule = computed(() => route.path.startsWith("/trade"));

const activeTop = computed(() => {
  if (isLiveModule.value) return "live";
  if (isCourseModule.value) return "course";
  if (isTradeModule.value) return "trade";
  if (isSettingsModule.value) return "settings";
  if (isUserModule.value) return "user";
  if (
    isWorkbenchConsole.value ||
    route.name === "dashboard" ||
    route.name === "notification-center" ||
    route.path === "/"
  ) {
    return "workbench";
  }
  return "";
});

const activeSide = computed(() => {
  if (isTradeModule.value) {
    if (route.name === "trade-orders" || route.path.startsWith("/trade/orders")) return "orders";
    return "";
  }
  if (isUserModule.value) {
    if (route.name === "user-learning-stats") return "learning-stats";
    if (
      route.name === "user-tags" ||
      route.name === "user-tags-create" ||
      route.name === "user-tags-detail" ||
      route.name === "user-tags-edit" ||
      route.path.startsWith("/user/tags")
    ) {
      return "tags";
    }
    return "list";
  }
  if (isSettingsModule.value) {
    if (route.path.startsWith("/settings/materials")) return "materials";
    if (route.name === "settings-employees") return "employees";
    if (route.name === "settings-roles") return "roles";
    return "";
  }
  if (isCourseModule.value) {
    if (route.name === "course-create") return "create";
    return "manage";
  }
  if (isLiveModule.value) {
    // 新建报备 / 报备列表均高亮「直播报备」
    if (route.path.startsWith("/live-reports")) return "report";
    if (route.path.startsWith("/live/console")) return activeConsoleSide.value;
    // 新建直播 / 列表 / 详情 / 去审核均高亮「直播管理」
    if (
      route.name === "live-create" ||
      route.name === "live-manage" ||
      route.name === "live-detail" ||
      route.name === "live-audit" ||
      route.path === "/live" ||
      (route.path.startsWith("/live/") && !route.path.startsWith("/live/console"))
    ) {
      return "manage";
    }
    return "";
  }
  if (isWorkbenchConsole.value) return activeConsoleSide.value;
  return route.name === "dashboard" ||
    route.name === "notification-center" ||
    route.path === "/"
    ? "overview"
    : "";
});

/**
 * 新建/编辑报备是同一个页面组件。不换 key 时，从编辑点侧栏「新建直播报备」
 * 只会改地址，组件实例还停在编辑态。
 */
const viewKey = computed(() => {
  if (route.name === "live-report-create" || route.name === "live-report-edit") {
    return route.fullPath;
  }
  const leaf = route.matched[route.matched.length - 1];
  return leaf?.path || route.path;
});

const currentSideNav = computed(() => {
  if (isTradeModule.value) return tradeSideNav;
  if (isUserModule.value) return userSideNav;
  if (isSettingsModule.value) return settingsSideNav;
  if (isCourseModule.value) return courseSideNav;
  if (isLiveModule.value) return liveSideNav;
  return workbenchSideNav;
});

function isSideDivider(item: object): boolean {
  return "divider" in item && Boolean((item as { divider?: unknown }).divider);
}

function sideIconOf(item: object): string | undefined {
  if (isSideDivider(item)) return undefined;
  if ("icon" in item && typeof (item as { icon?: unknown }).icon === "string") {
    return (item as { icon: string }).icon;
  }
  return undefined;
}

function onShellClick(label: string) {
  toast(`「${label}」暂未开放`);
}

function isConsoleNavParent(item: { key: string }) {
  return item.key === "console" || item.key === "live-console";
}

function consoleSubTo(segment: string) {
  if (isLiveModule.value) return `/live/console/${segment}`;
  return `/console/${segment}`;
}

function onSideClick(item: { key: string; label: string }) {
  onShellClick(item.label);
}

function goHome() {
  void router.push("/");
}

function goNotificationCenter() {
  void router.push({ name: "notification-center" });
}

async function onAccountClick() {
  try {
    await ElMessageBox.confirm("确定退出登录？", "退出登录", {
      confirmButtonText: "退出",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return;
  }
  auth.logout();
  void router.replace("/login");
}
</script>

<template>
  <div class="app-shell flex h-dvh flex-col overflow-hidden text-[var(--text)] antialiased">
    <header class="app-header z-20 flex h-[52px] flex-none items-center bg-white">
      <button
        type="button"
        class="app-brand group flex flex-none items-center gap-2 border-0 bg-transparent p-0 outline-none"
        @click="goHome"
      >
        <img
          src="/favicon.svg"
          alt="钱坤"
          class="h-7 w-7 flex-none rounded-full transition-opacity group-hover:opacity-90"
        >
        <span class="text-[15px] font-bold text-[var(--text)] transition-colors group-hover:text-[var(--color-primary)]">
          钱坤云直播平台
        </span>
      </button>

      <nav class="top-nav flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-[14px]">
        <RouterLink
          v-for="item in topNav"
          :key="item.key"
          :to="item.to"
          class="top-nav-item"
          :class="{ 'is-active': activeTop === item.key }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="ml-3 flex flex-none items-center gap-2">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded border-0 bg-transparent text-[var(--text-3)] outline-none transition-colors hover:bg-[#F8FAFC] hover:text-[var(--primary)]"
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
          class="header-notify-btn"
          title="通知中心"
          aria-label="通知中心"
          @click="goNotificationCenter"
        >
          <span class="header-notify-icon-wrap">
            <svg
              class="header-notify-bell"
              viewBox="0 0 20 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                stroke="currentColor"
                stroke-width="1.35"
                stroke-linecap="round"
                fill="none"
                d="M3.4 6.1c.5-.9 1.25-1.6 2.2-2"
              />
              <path
                stroke="currentColor"
                stroke-width="1.35"
                stroke-linecap="round"
                fill="none"
                d="M16.6 6.1c-.5-.9-1.25-1.6-2.2-2"
              />
              <path
                fill="currentColor"
                d="M10 2.1c.28 0 .5.22.5.5v.92c2.02.29 3.68 1.98 3.9 4.12l.12 1.52h1.06c.28 0 .5.22.5.5s-.22.5-.5.5h-.8l.32 3.48a2.12 2.12 0 0 1-2.1 1.92H8.88a2.12 2.12 0 0 1-2.1-1.92l.32-3.48H6.42c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h1.06l.12-1.52c.22-2.14 1.88-3.83 3.9-4.12V2.6c0-.28.22-.5.5-.5Z"
              />
              <path
                fill="currentColor"
                d="M8.65 17.75h2.7a1.1 1.1 0 0 1 0 2.2h-2.7a1.1 1.1 0 0 1 0-2.2Z"
              />
            </svg>
            <span
              v-if="mockUnreadNotificationCount > 0"
              class="header-notify-badge"
            >{{ mockUnreadNotificationCount }}</span>
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-full border-0 bg-transparent py-1 pl-1 pr-2 text-[13px] text-[var(--text-2)] outline-none transition-colors hover:bg-[#F8FAFC]"
          title="退出登录"
          @click="onAccountClick"
        >
          <span
            v-if="auth.user?.avatar"
            class="h-7 w-7 overflow-hidden rounded-full bg-[#bfbfbf]"
          >
            <img
              :src="auth.user.avatar"
              alt=""
              class="h-full w-full object-cover"
            >
          </span>
          <span
            v-else
            class="flex h-7 w-7 items-center justify-center rounded-full bg-[#bfbfbf] text-white"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
            </svg>
          </span>
          <span>{{ auth.displayName }}</span>
          <svg
            class="h-3 w-3 text-[var(--text-4)]"
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
        class="side-aside flex w-[220px] flex-none flex-col border-r border-[var(--line)] bg-white"
      >
        <nav class="side-nav hover-scrollbar min-h-0 flex-1 space-y-0.5 px-2 py-3 text-[13px]">
          <button
            v-if="isUserModule"
            type="button"
            class="side-group-toggle"
            :aria-expanded="userGroupOpen"
            @click="userGroupOpen = !userGroupOpen"
          >
            <span class="side-group-label">
              <SideIcon name="people" />
              <span>用户管理</span>
            </span>
            <svg
              class="side-group-chevron"
              :class="{ 'is-collapsed': !userGroupOpen }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <button
            v-if="isTradeModule"
            type="button"
            class="side-group-toggle"
            :aria-expanded="tradeGroupOpen"
            @click="tradeGroupOpen = !tradeGroupOpen"
          >
            <span class="side-group-label">
              <SideIcon name="order" />
              <span>订单管理</span>
            </span>
            <svg
              class="side-group-chevron"
              :class="{ 'is-collapsed': !tradeGroupOpen }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
          <template
            v-if="
              (!isUserModule || userGroupOpen) && (!isTradeModule || tradeGroupOpen)
            "
          >
            <template
              v-for="item in currentSideNav"
              :key="item.key"
            >
              <div
                v-if="isSideDivider(item)"
                class="side-nav-divider"
                role="separator"
              />
              <template v-else-if="isConsoleNavParent(item)">
                <button
                  type="button"
                  class="side-group-toggle"
                  :class="{ 'is-parent-active': Boolean(activeConsoleSide) }"
                  :aria-expanded="consoleGroupOpen"
                  @click="consoleGroupOpen = !consoleGroupOpen"
                >
                  <span class="side-group-label">
                    <SideIcon name="monitor" />
                    <span>直播中控台</span>
                  </span>
                  <svg
                    class="side-group-chevron"
                    :class="{ 'is-collapsed': !consoleGroupOpen }"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <template v-if="consoleGroupOpen">
                  <RouterLink
                    v-for="sub in consoleSubNav"
                    :key="sub.key"
                    :to="consoleSubTo(sub.segment)"
                    class="side-nav-item is-console-sub"
                    :class="{ 'is-active': activeSide === sub.key }"
                  >
                    <SideIcon :name="sub.icon" />
                    <span>{{ sub.label }}</span>
                  </RouterLink>
                </template>
              </template>
              <RouterLink
                v-else-if="'to' in item && item.to"
                :to="item.to"
                class="side-nav-item"
                :class="{
                  'is-active': activeSide === item.key,
                  'is-nested': isUserModule || isTradeModule,
                }"
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
                :class="{ 'is-nested': isUserModule || isTradeModule }"
                @click="onSideClick(item)"
              >
                <SideIcon
                  v-if="sideIconOf(item)"
                  :name="sideIconOf(item)!"
                />
                <span>{{ item.label }}</span>
              </button>
            </template>
          </template>
        </nav>

        <div
          v-if="
            !isLiveModule &&
              !isSettingsModule &&
              !isCourseModule &&
              !isUserModule &&
              !isTradeModule
          "
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

      <main
        class="min-h-0 min-w-0 flex-1 p-5"
        :class="
          route.name === 'settings-employees' ||
            route.name === 'settings-roles' ||
            route.name === 'dashboard'
            ? 'flex flex-col overflow-hidden'
            : 'overflow-y-auto hover-scrollbar'
        "
      >
        <RouterView v-slot="{ Component }">
          <component
            :is="Component"
            :key="viewKey"
          />
        </RouterView>
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
.app-shell {
  background: var(--bg, #F5F7FB);
}

.app-header {
  position: relative;
  padding: 0 20px 0 16px;
  border-bottom: 1px solid var(--line, #E2E8F0);
}

/* 金线叠在栏内，保持现高 52，避免其它页 100dvh-92px 被撑破 */
.app-header::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 2px;
  background: var(--gold, #F5B942);
  pointer-events: none;
  z-index: 1;
}

.app-brand {
  box-sizing: border-box;
  width: 204px;
}

.side-aside,
.side-nav,
.side-nav-item,
.side-fav-btn,
.top-nav-item,
.side-group-toggle {
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
  border-radius: 8px;
  background: transparent;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-2, #334155);
  text-decoration: none;
  outline: none;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.top-nav-item:hover {
  color: var(--color-primary);
  background: var(--color-primary-bg);
  text-decoration: none;
}

.top-nav-item.is-active {
  color: var(--color-primary);
  background: var(--primary-soft, #EFF6FF);
  font-weight: 700;
  text-decoration: none;
}

.side-group-toggle {
  display: flex;
  width: 100%;
  height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-2, #334155);
  outline: none;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

/* 父级只做展开分组，不要选中底，避免与子项双高亮 */
.side-group-toggle:hover {
  color: var(--text-2, #334155);
  background: #F8FAFC;
}

.side-group-toggle.is-parent-active {
  color: var(--color-primary);
  font-weight: 700;
}

.side-nav-item.is-console-sub {
  width: auto;
  height: 36px;
  margin-left: 12px;
  padding-left: 12px;
}

.side-nav-item.is-console-sub.is-active::before {
  top: 6px;
  bottom: 6px;
}

.side-group-label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.side-group-chevron {
  flex: none;
  width: 12px;
  height: 12px;
  color: var(--text-4, #94A3B8);
  transition: transform 0.15s;
}

.side-group-chevron.is-collapsed {
  transform: rotate(-90deg);
}

.side-nav-item {
  display: flex;
  position: relative;
  width: 100%;
  max-width: 100%;
  align-items: center;
  gap: 10px;
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  padding: 0 12px;
  text-align: left;
  text-decoration: none;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-2, #334155);
  outline: none;
  transition: background-color 0.15s, color 0.15s;
}

.side-nav-item:hover,
.side-nav-item:focus,
.side-nav-item:active {
  text-decoration: none;
  background: #F8FAFC;
  color: var(--color-primary);
}

.side-nav-item.is-active {
  background: var(--primary-soft, #EFF6FF);
  color: var(--color-primary);
  font-weight: 700;
  text-decoration: none;
}

.side-nav-item.is-active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--gold, #F5B942);
}

/* 二级菜单：左缩 22，高 36；当前项金条上下各留 6 */
.side-nav-item.is-nested {
  width: auto;
  height: 36px;
  margin-left: 22px;
  padding-left: 12px;
}

.side-nav-item.is-nested.is-active::before {
  top: 6px;
  bottom: 6px;
}

.side-nav-divider {
  height: 1px;
  margin: 12px 10px;
  background: var(--line-soft, #EEF2F7);
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
  background: var(--color-primary-bg-active);
  color: var(--color-primary);
}

header a {
  text-decoration: none;
}

.header-notify-btn {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  overflow: visible;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--primary, #2563EB);
  outline: none;
  cursor: pointer;
  transition: background-color 0.15s;
}

.header-notify-btn:hover {
  background: #F8FAFC;
}

.header-notify-icon-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  overflow: visible;
}

.header-notify-bell {
  display: block;
  width: 18px;
  height: 20px;
}

.header-notify-badge {
  position: absolute;
  top: -5px;
  right: -8px;
  box-sizing: border-box;
  min-width: 15px;
  height: 15px;
  padding: 0 3px;
  border-radius: 9999px;
  background: var(--danger, #EF4444);
  color: #fff;
  font-size: 9px;
  font-weight: 600;
  line-height: 15px;
  text-align: center;
  pointer-events: none;
}
</style>
