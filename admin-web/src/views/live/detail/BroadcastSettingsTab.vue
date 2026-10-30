<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Refresh } from "@element-plus/icons-vue";
import { ElIcon, ElMessage, ElMessageBox } from "element-plus";
import {
  endActivity,
  getActivityPasscode,
  getPushStream,
  getStreamStatus,
  resetActivityPasscode,
  startActivityLive,
  type ActivityId,
  type LiveProvider,
} from "@/api/activity";
import { useToast } from "@/composables/useToast";
import UiButton from "@/components/ui/UiButton.vue";
import InviteHostDialog from "@/components/live/InviteHostDialog.vue";
import { useAuthStore } from "@/stores/auth";
import { copyText } from "@/utils/copyText";
import {
  buildAudienceWatchUrl,
  buildLiveStudioPath,
  buildPasscodeHostUrl,
} from "@/utils/liveLinks";
import { ActivityMemberRole } from "@/views/live/detail/role/roleTypes";
import RoleSettingsPanel from "./role/RoleSettingsPanel.vue";

const props = withDefaults(
  defineProps<{
    activityId: ActivityId;
    canBroadcast?: boolean;
    liveTitle?: string;
    startTime?: string;
    provider: LiveProvider;
    hostLocked?: boolean;
    /** 活动 type：4=录播 */
    activityType?: number | null;
    /** 录播是否定时；省略按 true */
    isTiming?: boolean | null;
    /** 活动直播状态：1=直播中（结束按钮高亮条件） */
    activityState?: number | null;
  }>(),
  {
    canBroadcast: false,
    liveTitle: "",
    startTime: "",
    hostLocked: false,
    activityType: null,
    isTiming: null,
    activityState: null,
  },
);
const emit = defineEmits<{ error: [msg: string]; refreshed: [] }>();

const { toast } = useToast();
const auth = useAuthStore();
const inviteHostVisible = ref(false);

function openInviteHost() {
  if (!auth.user?.id) {
    ElMessage.warning("请重新登录后再邀请");
    return;
  }
  inviteHostVisible.value = true;
}

const subTab = ref<"method" | "role">("method");
const startingLive = ref(false);
const endingLive = ref(false);
const otherMethod = ref<"push" | "passcode">("push");
const pushProtocol = ref<"rtmp" | "srt">("rtmp");
const showSrt = computed(() => props.provider === "tencent");

/**
 * 微吼定时录播不支持主持人参会：开播方式整块只展示提示，勿再拉 host / 推流。
 */
const timedHostUnsupported = computed(
  () => props.activityType === 4 && (props.isTiming ?? true),
);

const rtmpServer = ref("");
const rtmpStreamKey = ref("");
const rtmpExpireTime = ref("");
/** 推流区本地错误，不上顶栏，避免与并行请求互相覆盖闪烁 */
const pushError = ref("");
/** 推流状态：null 未查到；0 无流；1 有流 */
const streamStatus = ref<number | null>(null);
const streamStatusLoading = ref(false);
const broadcastPasscode = ref("");
const passcodeLoading = ref(false);
const passcodeResetting = ref(false);
let pushSeq = 0;
let statusSeq = 0;
let passcodeSeq = 0;

/** 进入本 Tab 清掉详情顶栏残留错误，避免上次失败文案挂着 */
onMounted(() => emit("error", ""));

function shownOrEmpty(value: string | undefined) {
  const text = (value ?? "").trim();
  return text || "暂无";
}

const liveNameText = computed(() => shownOrEmpty(props.liveTitle));
const liveTimeText = computed(() => shownOrEmpty(props.startTime));
const watchLinkText = computed(() =>
  shownOrEmpty(buildAudienceWatchUrl(props.activityId)),
);
const passcodeText = computed(() => shownOrEmpty(broadcastPasscode.value));
/** 本站口令 H5，不是微吼 hostUrl。 */
const hostLinkText = computed(() => {
  const code = broadcastPasscode.value.trim();
  if (!code) return "暂无";
  return buildPasscodeHostUrl(code);
});

const currentPush = computed(() => {
  if (pushProtocol.value !== "rtmp") return { server: "", streamKey: "" };
  return { server: rtmpServer.value, streamKey: rtmpStreamKey.value };
});

/** 无流 / 未查到 / 失败时直接展示完整文案，禁止用「—」「-」占位 */
const streamStatusText = computed(() => {
  if (streamStatusLoading.value && streamStatus.value === null) return "检测中…";
  if (streamStatus.value === 1) return "已检测到流";
  return "未检测到推流";
});

const canStartLive = computed(
  () =>
    pushProtocol.value === "rtmp" &&
    !!currentPush.value.server &&
    !!currentPush.value.streamKey &&
    streamStatus.value === 1 &&
    !startingLive.value &&
    !endingLive.value,
);

/** 有流且本站 state=1（直播中）才可结束；仅有流不够 */
const canEndLive = computed(
  () =>
    pushProtocol.value === "rtmp" &&
    !!currentPush.value.server &&
    !!currentPush.value.streamKey &&
    streamStatus.value === 1 &&
    props.activityState === 1 &&
    !startingLive.value &&
    !endingLive.value,
);

async function loadRtmp() {
  const seq = ++pushSeq;
  rtmpServer.value = "";
  rtmpStreamKey.value = "";
  rtmpExpireTime.value = "";
  pushError.value = "";
  try {
    const data = await getPushStream(props.activityId);
    if (seq !== pushSeq) return;
    rtmpServer.value = (data.streamAddress ?? "").trim();
    rtmpStreamKey.value = (data.streamCode ?? "").trim();
    rtmpExpireTime.value = (data.expireTime ?? "").trim();
    pushError.value = "";
  } catch (e) {
    if (seq !== pushSeq) return;
    rtmpServer.value = "";
    rtmpStreamKey.value = "";
    rtmpExpireTime.value = "";
    pushError.value = e instanceof Error ? e.message : "获取推流地址失败";
  }
}

async function loadStreamStatus() {
  if (otherMethod.value !== "push" || pushProtocol.value !== "rtmp") return;
  const seq = ++statusSeq;
  streamStatusLoading.value = true;
  try {
    const data = await getStreamStatus(props.activityId);
    if (seq !== statusSeq) return;
    streamStatus.value = data.status === 1 ? 1 : 0;
  } catch (e) {
    if (seq !== statusSeq) return;
    streamStatus.value = null;
    if (!pushError.value) {
      pushError.value = e instanceof Error ? e.message : "获取推流状态失败";
    }
  } finally {
    if (seq === statusSeq) streamStatusLoading.value = false;
  }
}

watch(
  () =>
    [
      otherMethod.value,
      pushProtocol.value,
      props.activityId,
      timedHostUnsupported.value,
    ] as const,
  ([method, protocol, , unsupported]) => {
    if (unsupported) {
      pushSeq += 1;
      statusSeq += 1;
      rtmpServer.value = "";
      rtmpStreamKey.value = "";
      rtmpExpireTime.value = "";
      streamStatus.value = null;
      streamStatusLoading.value = false;
      pushError.value = "";
      return;
    }
    if (method === "push" && protocol === "rtmp") {
      void loadRtmp();
      void loadStreamStatus();
      return;
    }
    pushSeq += 1;
    statusSeq += 1;
    streamStatus.value = null;
    streamStatusLoading.value = false;
    pushError.value = "";
  },
  { immediate: true },
);

async function loadPasscode() {
  const seq = ++passcodeSeq;
  passcodeLoading.value = true;
  broadcastPasscode.value = "";
  try {
    const data = await getActivityPasscode(props.activityId);
    if (seq !== passcodeSeq) return;
    broadcastPasscode.value = (data.passcode ?? "").trim();
    emit("error", broadcastPasscode.value ? "" : "获取开播口令失败");
  } catch (e) {
    if (seq !== passcodeSeq) return;
    broadcastPasscode.value = "";
    emit("error", e instanceof Error ? e.message : "获取开播口令失败");
  } finally {
    if (seq === passcodeSeq) passcodeLoading.value = false;
  }
}

watch(
  () =>
    [otherMethod.value, props.activityId, timedHostUnsupported.value] as const,
  ([method, , unsupported]) => {
    if (unsupported || method !== "passcode") {
      passcodeSeq += 1;
      broadcastPasscode.value = "";
      passcodeLoading.value = false;
      return;
    }
    void loadPasscode();
  },
);

const subTabs = [
  { key: "method" as const, label: "开播方式" },
  { key: "role" as const, label: "角色设置" },
];

function onSubTab(key: (typeof subTabs)[number]["key"]) {
  subTab.value = key;
}

async function startThirdPartyLive() {
  if (!canStartLive.value) return;
  startingLive.value = true;
  try {
    await startActivityLive(props.activityId);
    emit("error", "");
    ElMessage.success("已开始直播");
    emit("refreshed");
  } catch (e) {
    emit("error", e instanceof Error ? e.message : "开始直播失败");
  } finally {
    startingLive.value = false;
  }
}

async function endThirdPartyLive() {
  if (!canEndLive.value) return;
  try {
    await ElMessageBox.confirm("确认结束直播？结束后将生成回放。", "结束直播", {
      type: "warning",
      confirmButtonText: "结束直播",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  endingLive.value = true;
  try {
    await endActivity(props.activityId);
    emit("error", "");
    ElMessage.success("已结束直播");
    emit("refreshed");
  } catch (e) {
    emit("error", e instanceof Error ? e.message : "结束直播失败");
  } finally {
    endingLive.value = false;
  }
}

function copyValue(value: string, emptyTip = "暂无") {
  const text = value.trim();
  if (!text || text === "暂无") {
    toast(emptyTip);
    return;
  }
  void copyText(text, "已复制");
}

async function resetPasscode() {
  if (passcodeResetting.value || passcodeLoading.value) return;
  try {
    await ElMessageBox.confirm(
      "重置口令后，原口令失效，是否确认重置？",
      "提示",
      {
        type: "info",
        confirmButtonText: "确定",
        cancelButtonText: "取消",
      },
    );
  } catch {
    return;
  }
  passcodeResetting.value = true;
  try {
    const data = await resetActivityPasscode(props.activityId);
    broadcastPasscode.value = (data.passcode ?? "").trim();
    emit("error", broadcastPasscode.value ? "" : "重置开播口令失败");
    if (broadcastPasscode.value) {
      ElMessage.success("口令已重置");
    }
  } catch (e) {
    emit("error", e instanceof Error ? e.message : "重置开播口令失败");
  } finally {
    passcodeResetting.value = false;
  }
}

function copyPasscode() {
  void copyValue(broadcastPasscode.value);
}

function copyAllPasscodeInfo() {
  const text = [
    `直播名称：${liveNameText.value}`,
    `直播时间：${liveTimeText.value}`,
    `直播口令：${passcodeText.value}`,
    `口令开播链接：${hostLinkText.value}`,
    `观众观看链接：${watchLinkText.value}`,
  ].join("\n");
  void copyValue(text);
}

function openHost() {
  if (!props.canBroadcast || timedHostUnsupported.value) return;
  window.open(
    buildLiveStudioPath(props.activityId, ActivityMemberRole.HOST),
    "_blank",
    "noopener",
  );
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
      <section
        v-if="timedHostUnsupported"
        class="block"
      >
        <p class="broadcast-unsupported">
          定时直播不支持主持人参会，本场无法通过开播设置进入主持/推流/口令开播。到达开播时间后将按定时录播自动播出。
        </p>
      </section>

      <template v-else>
        <section class="block">
          <h3 class="block-title">邀请主播</h3>
          <p class="block-desc">
            可将开播权限分享给他人，对方通过链接或客户端以主播身份进入直播间。
          </p>
          <UiButton
            variant="outline"
            @click="openInviteHost"
          >
            邀请主播
          </UiButton>
          <InviteHostDialog
            v-if="auth.user?.id"
            v-model="inviteHostVisible"
            :activity-id="activityId"
            :inviter-id="auth.user.id"
            :live-title="liveTitle"
            :start-time="startTime"
          />
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
                    @click="toast('「客户端开播」暂未开放')"
                  >
                    客户端开播
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

            <div class="host-card">
              <div class="host-card__icon is-web">Web</div>
              <div class="host-card__body">
                <p class="host-card__name">网页开播</p>
                <p class="host-card__desc">浏览器直接打开主持人控制台，无需安装客户端</p>
                <div class="host-card__actions">
                  <UiButton
                    variant="primary"
                    :disabled="!canBroadcast"
                    @click="openHost"
                  >
                    网页开播
                  </UiButton>
                  <p
                    v-if="!canBroadcast"
                    class="host-card__hint"
                  >
                    需风控已通过、已上架，且直播状态为预告或已结束
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="block">
          <h3 class="block-title">其他方式开播</h3>
          <div class="other-card">
            <div class="method-tabs">
              <button
                type="button"
                class="method-tab"
                :class="{ 'is-active': otherMethod === 'push' }"
                @click="otherMethod = 'push'"
              >
                第三方推流到直播间
              </button>
              <button
                type="button"
                class="method-tab"
                :class="{ 'is-active': otherMethod === 'passcode' }"
                @click="otherMethod = 'passcode'"
              >
                口令开播
              </button>
            </div>

            <template v-if="otherMethod === 'push'">
              <p class="method-desc">
                OBS摄像机 适合双机位开播，支持桌面共享/屏幕捕获
              </p>
              <div class="protocol-row">
                <label class="protocol-option">
                  <input
                    v-model="pushProtocol"
                    type="radio"
                    value="rtmp"
                  >
                  rtmp推流
                </label>
                <label
                  v-if="showSrt"
                  class="protocol-option"
                >
                  <input
                    v-model="pushProtocol"
                    type="radio"
                    value="srt"
                  >
                  srt推流
                  <span class="protocol-hint">低延迟/更稳定</span>
                </label>
              </div>
              <p
                v-if="pushError"
                class="push-error"
              >
                {{ pushError }}
              </p>
              <div class="copy-row">
                <span class="copy-label">服务器：</span>
                <input
                  class="copy-input"
                  type="text"
                  readonly
                  :value="currentPush.server"
                  placeholder="暂无推流地址"
                >
                <UiButton
                  variant="default"
                  @click="copyValue(currentPush.server)"
                >
                  复制
                </UiButton>
              </div>
              <div class="copy-row">
                <span class="copy-label">串流密钥：</span>
                <input
                  class="copy-input"
                  type="text"
                  readonly
                  :value="currentPush.streamKey"
                  placeholder="暂无串流密钥"
                >
                <UiButton
                  variant="default"
                  @click="copyValue(currentPush.streamKey)"
                >
                  复制
                </UiButton>
              </div>
              <p
                v-if="pushProtocol === 'rtmp' && rtmpExpireTime"
                class="expire-note"
              >
                有效期至 {{ rtmpExpireTime }}
              </p>
              <div
                v-if="pushProtocol === 'rtmp'"
                class="stream-status-row"
              >
                <span class="copy-label">推流状态：</span>
                <span
                  class="status-text"
                  :class="{
                    'is-ok': streamStatus === 1,
                    'is-miss':
                      streamStatus === 0 ||
                      (streamStatus === null && !streamStatusLoading),
                  }"
                >{{ streamStatusText }}</span>
                <button
                  type="button"
                  class="status-refresh"
                  :disabled="streamStatusLoading"
                  title="刷新推流状态"
                  @click="loadStreamStatus"
                >
                  <ElIcon
                    class="status-refresh__icon"
                    :class="{ 'is-spinning': streamStatusLoading }"
                    :size="14"
                  >
                    <Refresh />
                  </ElIcon>
                </button>
                <UiButton
                  variant="primary"
                  :disabled="!canStartLive"
                  @click="startThirdPartyLive"
                >
                  {{ startingLive ? "开播中…" : "开始直播" }}
                </UiButton>
                <UiButton
                  variant="default"
                  :disabled="!canEndLive"
                  @click="endThirdPartyLive"
                >
                  {{ endingLive ? "结束中…" : "结束直播" }}
                </UiButton>
              </div>
              <div class="push-notes">
                <p>1、推流域名不固定，复制时请仔细检查。为防止串流，每次推流只能用一种地址</p>
                <p>2、为保证观看质量与流量消耗，推荐设置码率1000~2000之间，分辨率在1080P或以下</p>
              </div>
            </template>

            <template v-else>
              <p class="passcode-desc">
                发送口令信息给主播即可开播，开播链接与直播口令为主播专用，请勿随意转发
              </p>
              <div class="passcode-card">
                <div class="passcode-row">
                  <span class="passcode-label">直播名称：</span>
                  <span class="passcode-value">{{ liveNameText }}</span>
                </div>
                <div class="passcode-row">
                  <span class="passcode-label">直播时间：</span>
                  <span class="passcode-value">{{ liveTimeText }}</span>
                </div>
                <div class="passcode-row">
                  <span class="passcode-label">直播口令：</span>
                  <span class="passcode-value">{{ passcodeText }}</span>
                  <button
                    type="button"
                    class="passcode-reset"
                    :disabled="passcodeLoading || passcodeResetting"
                    @click="resetPasscode"
                  >
                    <ElIcon
                      class="passcode-reset__icon"
                      :class="{ 'is-spinning': passcodeResetting }"
                      :size="14"
                    >
                      <Refresh />
                    </ElIcon>
                    {{ passcodeResetting ? "重置中…" : "重置口令" }}
                  </button>
                </div>
                <div class="passcode-row">
                  <span class="passcode-label">口令开播链接：</span>
                  <span class="passcode-value">{{ hostLinkText }}</span>
                  <span class="passcode-aside">主播专用链接，请勿随意转发</span>
                </div>
                <div class="passcode-row">
                  <span class="passcode-label">观众观看链接：</span>
                  <span class="passcode-value">{{ watchLinkText }}</span>
                </div>
              </div>
              <div class="passcode-actions">
                <UiButton
                  variant="outline"
                  @click="copyPasscode"
                >
                  复制口令
                </UiButton>
                <UiButton
                  variant="primary"
                  @click="copyAllPasscodeInfo"
                >
                  复制全部信息
                </UiButton>
              </div>
            </template>
          </div>
        </section>
      </template>
    </template>

    <RoleSettingsPanel
      v-show="subTab === 'role'"
      :activity-id="activityId"
      :live-title="liveTitle"
      :start-time="startTime"
      :host-locked="hostLocked"
    />
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
.host-card__icon.is-web {
  background: #fff7e6;
  color: #d48806;
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
.host-card__hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999;
}
.host-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.other-card {
  padding: 4px 16px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #fff;
}
.method-tabs {
  display: flex;
  gap: 24px;
  border-bottom: 1px solid var(--color-border-light);
}
.method-tab {
  border: 0;
  background: transparent;
  padding: 10px 0;
  margin-bottom: -1px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  outline: none;
  border-bottom: 2px solid transparent;
}
.method-tab.is-active {
  color: var(--color-primary);
  font-weight: 600;
  border-bottom-color: var(--color-primary);
}
.method-desc {
  margin: 16px 0 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.broadcast-unsupported {
  margin: 0;
  padding: 16px 20px;
  border-radius: 8px;
  background: #fff7e6;
  border: 1px solid #ffd591;
  font-size: 14px;
  color: #ad6800;
  line-height: 1.6;
}
.push-error {
  margin: 0 0 12px;
  font-size: 13px;
  color: #f5222d;
  line-height: 1.5;
}
.protocol-row {
  display: flex;
  align-items: center;
  gap: 28px;
  margin-bottom: 16px;
}
.protocol-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
}
.protocol-option input {
  margin: 0;
  accent-color: var(--color-primary);
}
.protocol-hint {
  color: var(--color-text-disabled);
  font-size: 12px;
}
.copy-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.copy-label {
  flex: none;
  width: 84px;
  text-align: right;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.copy-input {
  box-sizing: border-box;
  flex: 1 1 240px;
  width: auto;
  min-width: 0;
  max-width: 420px;
  height: 32px;
  padding: 0 11px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: var(--color-bg-muted);
  font-size: 13px;
  color: var(--color-text);
  outline: none;
}
.copy-input::placeholder {
  color: var(--color-text-placeholder);
}
.expire-note {
  margin: -4px 0 12px 92px;
  font-size: 12px;
  color: var(--color-text-placeholder);
  line-height: 1.5;
}
.stream-status-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.status-text {
  flex: none;
  font-size: 13px;
  line-height: 32px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.status-text.is-miss {
  color: #f5222d;
}
.status-text.is-ok {
  color: #52c41a;
}
.status-refresh {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}
.status-refresh:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.status-refresh:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.status-refresh__icon.is-spinning {
  animation: status-spin 0.8s linear infinite;
}
@keyframes status-spin {
  to {
    transform: rotate(360deg);
  }
}
.push-notes p {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-placeholder);
  line-height: 1.7;
}
.passcode-desc {
  margin: 16px 0 12px;
  font-size: 13px;
  color: var(--color-text-placeholder);
  line-height: 1.6;
}
.passcode-card {
  padding: 16px 24px 16px 12px;
  border-radius: 8px;
  background: #f5f7fb;
}
.passcode-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 11px 0;
  font-size: 13px;
  line-height: 22px;
}
.passcode-label {
  flex: none;
  width: 108px;
  text-align: right;
  color: var(--color-text-secondary);
}
.passcode-value {
  min-width: 0;
  max-width: calc(100% - 124px);
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.passcode-reset {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  line-height: 22px;
  cursor: pointer;
}
.passcode-reset:hover {
  color: var(--color-primary-hover);
}
.passcode-reset__icon {
  font-size: 14px;
}
.passcode-aside {
  color: var(--color-text-placeholder);
  font-size: 12px;
  line-height: 22px;
}
.passcode-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
}
</style>
