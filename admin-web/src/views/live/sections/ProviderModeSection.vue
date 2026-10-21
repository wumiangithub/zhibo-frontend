<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ElRadioGroup,
  ElRadioButton,
  ElIcon,
  ElSwitch,
  ElDialog,
} from "element-plus";
import { Check } from "@element-plus/icons-vue";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import MaterialVideoPicker from "../components/MaterialVideoPicker.vue";
import VhallLivePicker from "../components/VhallLivePicker.vue";
import UiButton from "@/components/ui/UiButton.vue";
import type { LiveFormState, ViewerStyle } from "../composables/useLiveForm";
import { PROVIDER_LABEL, type LiveProvider } from "@/api/activity";
import type { MaterialVideoItem, VhallLiveItem, VhallPlaybackItem } from "@/api/recordResource";
import videoIcon from "@/assets/images/live/video.svg?raw";
import recordIcon from "@/assets/images/live/record.svg?raw";
import voiceIcon from "@/assets/images/live/voice.svg?raw";

const props = defineProps<{
  form: LiveFormState;
  /** 编辑态：服务商不可改 */
  providerReadonly?: boolean;
  /** 编辑态：模式 / 观看端样式创建后不可改 */
  modeReadonly?: boolean;
  viewerStyleReadonly?: boolean;
  /** 是否展示服务商（设置页基本信息可隐藏，只读展示在别处） */
  hideProvider?: boolean;
}>();

const markDirty = useMarkDirty();
/** 超低延迟说明弹窗 */
const latencyTipVisible = ref(false);

/** 暂未开放：仅展示，不可点选（编辑历史数据靠 readonly 只读展示） */
const DISABLED_PROVIDERS = new Set<LiveProvider>(["aliyun", "tencent"]);

const providerOptions: { v: LiveProvider; t: string; tip: string; disabled?: boolean }[] = [
  { v: "vhall", t: PROVIDER_LABEL.vhall, tip: "已接入" },
  { v: "aliyun", t: PROVIDER_LABEL.aliyun, tip: "暂不可选", disabled: true },
  { v: "tencent", t: PROVIDER_LABEL.tencent, tip: "暂不可选", disabled: true },
];

const videoPickerVisible = ref(false);
const livePickerVisible = ref(false);

const recordSourceLabel = computed(() => {
  if (props.form.recordSource === "video") return "素材视频";
  if (props.form.recordSource === "live") return "直播回放";
  return "";
});

function clearRecord() {
  props.form.recordId = "";
  props.form.recordLabel = "";
  props.form.recordSource = "";
}

function onClearRecord() {
  clearRecord();
  markDirty();
}

function onPickVideo(item: MaterialVideoItem) {
  props.form.recordId = (item.recordId || item.id).trim();
  props.form.recordLabel = item.title;
  props.form.recordSource = "video";
  markDirty();
}

function onPickLivePlayback(payload: { live: VhallLiveItem; playback: VhallPlaybackItem }) {
  props.form.recordId = payload.playback.id.trim();
  props.form.recordLabel = `${payload.live.title} · ${payload.playback.title}`;
  props.form.recordSource = "live";
  markDirty();
}

const modeOptions = [
  { v: "video" as const, t: "视频直播", d: "摄像头/推流", icon: videoIcon },
  { v: "recorded" as const, t: "录播直播", d: "播放录制视频", icon: recordIcon },
  { v: "voice" as const, t: "语音直播", d: "纯音频", icon: voiceIcon, disabled: true },
];

const viewerStyleOptions: { v: ViewerStyle; t: string; disabled?: boolean }[] = [
  { v: "traditional", t: "传统直播间" },
  { v: "immersive", t: "沉浸直播间", disabled: true },
];

function isProviderDisabled(v: LiveProvider) {
  return props.providerReadonly || DISABLED_PROVIDERS.has(v);
}

function isModeDisabled(v: (typeof modeOptions)[number]["v"]) {
  return props.modeReadonly || v === "voice";
}

function isViewerStyleDisabled(v: ViewerStyle) {
  return props.viewerStyleReadonly || v === "immersive";
}

watch(
  () => props.form.mode,
  (mode) => {
    if (mode === "voice" && props.form.viewerStyle !== "traditional") {
      props.form.viewerStyle = "traditional";
    }
    // 级联清录播字段；dirty 由用户改 mode 的交互负责
    if (mode !== "recorded") {
      if (props.form.recordId || props.form.recordLabel || props.form.recordSource) {
        props.form.recordId = "";
        props.form.recordLabel = "";
        props.form.recordSource = "";
      }
    }
  },
);
</script>

<template>
  <div class="provider-mode">
    <div class="provider-mode__title">直播配置</div>
    <div class="provider-mode__body">
      <FormRow
        v-if="!hideProvider"
        label="直播服务商:"
        required
        info="创建后不可修改。阿里云 / 腾讯云暂不可选。"
      >
        <ElRadioGroup
          v-model="form.provider"
          :disabled="providerReadonly"
          @change="markDirty"
        >
          <ElRadioButton
            v-for="p in providerOptions"
            :key="p.v"
            :value="p.v"
            :disabled="isProviderDisabled(p.v)"
          >
            {{ p.t }}
            <span class="provider-tip">{{ p.tip }}</span>
          </ElRadioButton>
        </ElRadioGroup>
      </FormRow>

      <FormRow
        label="模式设置:"
        required
        info="创建后不可修改。语音直播暂不可选。"
      >
        <div class="mode-tiles">
          <label
            v-for="m in modeOptions"
            :key="m.v"
            class="mode-tile"
            :class="{
              'is-active': form.mode === m.v,
              'is-locked': modeReadonly,
              'is-disabled': !modeReadonly && m.v === 'voice',
            }"
          >
            <input
              v-model="form.mode"
              type="radio"
              :value="m.v"
              class="hidden"
              :disabled="isModeDisabled(m.v)"
              @change="markDirty"
            >
            <span
              v-if="form.mode === m.v"
              class="select-check"
              aria-hidden="true"
            >
              <ElIcon class="select-check__icon"><Check /></ElIcon>
            </span>
            <span
              class="mode-tile__icon"
              v-html="m.icon"
            />
            <span class="mode-tile__t">{{ m.t }}</span>
            <span class="mode-tile__d">{{ m.d }}</span>
          </label>
        </div>
      </FormRow>

      <FormRow
        v-if="form.mode === 'recorded'"
        label="回放资源:"
        required
        info="录播需指定资源：素材库视频，或从历史直播中选择回放。提交时写入 create 的 recordId。"
      >
        <div class="record-picker">
          <div class="record-picker__btns">
            <UiButton
              variant="outline"
              :class="{ 'is-source': form.recordSource === 'video' }"
              @click="videoPickerVisible = true"
            >
              选择视频
            </UiButton>
            <UiButton
              variant="outline"
              :class="{ 'is-source': form.recordSource === 'live' }"
              @click="livePickerVisible = true"
            >
              选择直播
            </UiButton>
          </div>
          <div
            v-if="form.recordId"
            class="record-picker__selected"
          >
            <span class="record-picker__tag">{{ recordSourceLabel }}</span>
            <span class="record-picker__name">{{ form.recordLabel || form.recordId }}</span>
            <span class="record-picker__id">ID：{{ form.recordId }}</span>
            <UiButton
              variant="link"
              @click="onClearRecord"
            >
              清除
            </UiButton>
          </div>
          <p
            v-else
            class="record-picker__hint"
          >
            请选择素材视频或历史直播回放
          </p>
        </div>
      </FormRow>

      <MaterialVideoPicker
        v-model="videoPickerVisible"
        :selected-id="form.recordSource === 'video' ? form.recordId : ''"
        @select="onPickVideo"
      />
      <VhallLivePicker
        v-model="livePickerVisible"
        @select="onPickLivePlayback"
      />

      <FormRow
        label="观看端样式:"
        required
        info="创建后不可修改。沉浸直播间暂不可选。"
      >
        <div class="viewer-styles">
          <label
            v-for="s in viewerStyleOptions"
            :key="s.v"
            class="viewer-style"
            :class="{
              'is-active': form.viewerStyle === s.v,
              'is-locked': viewerStyleReadonly,
              'is-disabled': !viewerStyleReadonly && s.v === 'immersive',
            }"
          >
            <input
              v-model="form.viewerStyle"
              type="radio"
              :value="s.v"
              class="hidden"
              :disabled="isViewerStyleDisabled(s.v)"
              @change="markDirty"
            >
            <span
              v-if="form.viewerStyle === s.v"
              class="select-check"
              aria-hidden="true"
            >
              <ElIcon class="select-check__icon"><Check /></ElIcon>
            </span>
            <div class="viewer-style__thumb" />
            <span class="viewer-style__t">{{ s.t }}</span>
          </label>
        </div>
      </FormRow>

      <!-- 定稿：新建/编辑均展示；默认开；禁切换（创建后微吼也不支持改） -->
      <FormRow
        label="超低延迟:"
        info="默认开启，创建后不可修改。"
      >
        <div class="latency-row">
          <ElSwitch
            :model-value="form.ultraLowLatency"
            disabled
          />
          <span class="latency-row__hint">
            开启后，直播间可实现超低延迟体验，但同时会增加流量消耗
          </span>
          <a
            class="latency-tip-link"
            href="javascript:;"
            @click.prevent="latencyTipVisible = true"
          >查看说明</a>
        </div>
      </FormRow>
    </div>

    <ElDialog
      v-model="latencyTipVisible"
      title="超低延迟说明"
      width="520px"
      align-center
      destroy-on-close
    >
      <p class="latency-tip__desc">
        直播间开启超低延迟后，直播间延迟≈1s，流量消耗将按 3 倍计算，具体对比如下：
      </p>
      <table class="latency-tip__table">
        <thead>
          <tr>
            <th />
            <th>低延迟直播</th>
            <th>超低延迟直播</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>直播延迟</td>
            <td>5~8s</td>
            <td class="is-hl">≈1s</td>
          </tr>
          <tr>
            <td>流量消耗</td>
            <td>22.5GB</td>
            <td class="is-hl">60.0GB</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">
              *流量消耗按照：码率500kbps，直播间100人，观看1h来估算
            </td>
          </tr>
        </tfoot>
      </table>
    </ElDialog>
  </div>
</template>

<style scoped>
.provider-mode {
  margin: 20px 0;
  padding: 18px 20px 4px;
  background: #fafbfc;
  border: 1px solid #eef0f3;
  border-radius: 8px;
}
.provider-mode__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 3px solid var(--color-primary);
}
.provider-mode__body :deep(.form-row:last-child) {
  margin-bottom: 14px;
}
.provider-tip {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 400;
  opacity: 0.65;
}
.mode-tiles {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.select-check {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 22px;
  height: 22px;
  overflow: hidden;
  pointer-events: none;
  z-index: 1;
}
.select-check::before {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  border-style: solid;
  border-width: 0 22px 22px 0;
  border-color: transparent var(--color-primary) transparent transparent;
}
.select-check__icon {
  position: absolute;
  top: 3px;
  right: 2px;
  font-size: 10px;
  color: #fff;
  line-height: 1;
}
.mode-tile {
  position: relative;
  width: 130px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 16px 12px;
  text-align: center;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #333;
  transition: all 0.15s;
  overflow: hidden;
  background: #fff;
}
.mode-tile:hover:not(.is-locked):not(.is-disabled) {
  border-color: var(--color-primary);
}
.mode-tile.is-locked,
.mode-tile.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
  color: #999;
  background: #f5f6f8;
}
.mode-tile.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  color: var(--color-primary);
}
.mode-tile.is-active.is-disabled,
.mode-tile.is-active.is-locked {
  opacity: 0.75;
}
.mode-tile__icon {
  display: flex;
  width: 24px;
  height: 24px;
  margin-bottom: 4px;
  color: inherit;
}
.mode-tile__icon :deep(svg) {
  width: 24px;
  height: 24px;
}
.mode-tile__t {
  font-size: 13px;
  font-weight: 500;
}
.mode-tile__d {
  font-size: 11px;
  color: #999;
}
.mode-tile.is-active .mode-tile__d {
  color: var(--color-primary);
}
.viewer-styles {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.viewer-style {
  position: relative;
  width: 160px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.15s;
  overflow: hidden;
  background: #fff;
}
.viewer-style:hover:not(.is-locked):not(.is-disabled) {
  border-color: var(--color-primary);
}
.viewer-style.is-locked,
.viewer-style.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
  color: #999;
  background: #f5f6f8;
}
.viewer-style.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
}
.viewer-style.is-active.is-disabled,
.viewer-style.is-active.is-locked {
  opacity: 0.75;
}
.viewer-style__thumb {
  width: 48px;
  height: 36px;
  border-radius: 4px;
  background: linear-gradient(135deg, #d6e4ff, #adc6ff);
  flex: none;
}
.viewer-style__t {
  font-size: 13px;
  font-weight: 500;
}
.record-picker__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.record-picker__btns :deep(.ui-btn.is-source) {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}
.record-picker__selected {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  font-size: 13px;
  color: var(--color-text);
}
.record-picker__tag {
  display: inline-flex;
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-size: 12px;
}
.record-picker__name {
  font-weight: 500;
}
.record-picker__id {
  color: var(--color-text-placeholder);
  font-size: 12px;
}
.record-picker__hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--color-text-placeholder);
}
.latency-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.latency-row__hint {
  font-size: 12px;
  color: #999;
}
.latency-tip-link {
  font-size: 12px;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}
.latency-tip-link:hover {
  opacity: 0.85;
}
.latency-tip__desc {
  margin: 0 0 16px;
  font-size: 13px;
  line-height: 1.6;
  color: #666;
}
.latency-tip__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  color: #333;
  text-align: center;
}
.latency-tip__table th,
.latency-tip__table td {
  border: 1px solid #e4e7ed;
  padding: 12px 10px;
}
.latency-tip__table th {
  font-weight: 500;
  background: #fafafa;
}
.latency-tip__table .is-hl {
  color: #f5222d;
}
.latency-tip__table tfoot td {
  text-align: left;
  font-size: 12px;
  color: #999;
  background: #fff;
  padding: 10px 12px;
}
</style>
