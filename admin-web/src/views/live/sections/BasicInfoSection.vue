<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  ElInput,
  ElRadioGroup,
  ElRadioButton,
  ElSwitch,
  ElDatePicker,
  ElTimePicker,
  ElIcon,
  ElDialog,
} from "element-plus";
import { Check } from "@element-plus/icons-vue";
import FormRow from "../components/FormRow.vue";
import PhonePreview from "../components/PhonePreview.vue";
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
  /** 编辑态：模式 / 观看端样式 / 超低延迟创建后不可改 */
  modeReadonly?: boolean;
  viewerStyleReadonly?: boolean;
  ultraLowLatencyReadonly?: boolean;
}>();

const providerOptions: { v: LiveProvider; t: string; tip: string }[] = [
  { v: "vhall", t: PROVIDER_LABEL.vhall, tip: "已接入" },
  { v: "aliyun", t: PROVIDER_LABEL.aliyun, tip: "本迭代未接入" },
  { v: "tencent", t: PROVIDER_LABEL.tencent, tip: "本迭代未接入" },
];

const latencyTipVisible = ref(false);
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

function onPickVideo(item: MaterialVideoItem) {
  props.form.recordId = (item.recordId || item.id).trim();
  props.form.recordLabel = item.title;
  props.form.recordSource = "video";
}

function onPickLivePlayback(payload: { live: VhallLiveItem; playback: VhallPlaybackItem }) {
  props.form.recordId = payload.playback.id.trim();
  props.form.recordLabel = `${payload.live.title} · ${payload.playback.title}`;
  props.form.recordSource = "live";
}

const previewTime = computed(() =>
  props.form.startDate && props.form.startTime
    ? `${props.form.startDate} ${props.form.startTime}`
    : "",
);

const modeOptions = [
  { v: "video" as const, t: "视频直播", d: "摄像头/推流", icon: videoIcon },
  { v: "recorded" as const, t: "录播直播", d: "播放录制视频", icon: recordIcon },
  { v: "voice" as const, t: "语音直播", d: "纯音频", icon: voiceIcon },
];

const allViewerStyles: { v: ViewerStyle; t: string }[] = [
  { v: "traditional", t: "传统直播间" },
  { v: "immersive", t: "沉浸直播间" },
];

/** 语音直播仅支持传统直播间 */
const viewerStyleOptions = computed(() =>
  props.form.mode === "voice"
    ? allViewerStyles.filter((s) => s.v === "traditional")
    : allViewerStyles,
);

watch(
  () => props.form.mode,
  (mode) => {
    if (mode === "voice" && props.form.viewerStyle !== "traditional") {
      props.form.viewerStyle = "traditional";
    }
    if (mode !== "recorded") clearRecord();
  },
);

const dateShortcuts = [
  {
    text: "今天",
    value: () => new Date(),
  },
];
</script>

<template>
  <div class="section">
    <div class="section__title">基本信息</div>

    <div class="section__body">
      <div class="section__fields">
        <FormRow
          label="直播服务商:"
          required
          info="创建后不可修改。阿里云 / 腾讯云本迭代未接入，保存将返回未接入错误。"
        >
          <ElRadioGroup
            v-model="form.provider"
            :disabled="providerReadonly"
          >
            <ElRadioButton
              v-for="p in providerOptions"
              :key="p.v"
              :value="p.v"
            >
              {{ p.t }}
              <span class="provider-tip">{{ p.tip }}</span>
            </ElRadioButton>
          </ElRadioGroup>
        </FormRow>

        <FormRow
          label="模式设置:"
          required
          info="创建后不可修改。"
        >
          <div class="mode-tiles">
            <label
              v-for="m in modeOptions"
              :key="m.v"
              class="mode-tile"
              :class="{ 'is-active': form.mode === m.v, 'is-locked': modeReadonly }"
            >
              <input
                v-model="form.mode"
                type="radio"
                :value="m.v"
                class="hidden"
                :disabled="modeReadonly"
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
          label="观看端样式:"
          required
          info="创建后不可修改。"
        >
          <div class="viewer-styles">
            <label
              v-for="s in viewerStyleOptions"
              :key="s.v"
              class="viewer-style"
              :class="{ 'is-active': form.viewerStyle === s.v, 'is-locked': viewerStyleReadonly }"
            >
              <input
                v-model="form.viewerStyle"
                type="radio"
                :value="s.v"
                class="hidden"
                :disabled="viewerStyleReadonly"
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

        <FormRow
          label="超低延迟:"
          info="创建后不可修改。"
        >
          <div class="flex items-center gap-3">
            <ElSwitch
              v-model="form.ultraLowLatency"
              :disabled="ultraLowLatencyReadonly"
            />
            <span class="text-[12px] text-[#999]">开启后，直播间可实现超低延迟体验，但同时会增加流量消耗</span>
            <a
              class="latency-tip-link"
              href="javascript:;"
              @click.prevent="latencyTipVisible = true"
            >查看说明</a>
          </div>
        </FormRow>

        <FormRow label="虚拟形象:">
          <ElRadioGroup v-model="form.virtualAvatar">
            <ElRadioButton :value="false">否</ElRadioButton>
            <ElRadioButton
              :value="true"
              disabled
            >是</ElRadioButton>
          </ElRadioGroup>
        </FormRow>

        <FormRow
          label="直播名称:"
          required
        >
          <div class="flex items-center gap-2">
            <ElInput
              v-model="form.name"
              placeholder="请输入直播名称（建议14字以内，不超过64字）"
              maxlength="64"
              show-word-limit
              style="width: 360px"
            />
          </div>
        </FormRow>

        <FormRow
          label="直播简介:"
          :required="form.provider === 'vhall' && form.mode === 'recorded'"
          :info="
            form.provider === 'vhall' && form.mode === 'recorded'
              ? '微吼录播创建时简介为必填'
              : undefined
          "
        >
          <ElInput
            v-model="form.intro"
            type="textarea"
            :rows="4"
            placeholder="请输入直播简介"
            maxlength="256"
            show-word-limit
            style="width: 480px"
          />
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
                @click="clearRecord"
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
          label="开始时间:"
          required
        >
          <div class="flex items-center gap-2">
            <ElDatePicker
              v-model="form.startDate"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              :shortcuts="dateShortcuts"
              style="width: 160px"
            />
            <ElTimePicker
              v-model="form.startTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
              style="width: 120px"
            />
          </div>
        </FormRow>

        <FormRow label="结束时间:">
          <div class="flex items-center gap-2">
            <ElDatePicker
              v-model="form.endDate"
              type="date"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              :shortcuts="dateShortcuts"
              style="width: 160px"
            />
            <ElTimePicker
              v-model="form.endTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="选择时间"
              style="width: 120px"
            />
          </div>
        </FormRow>
      </div>

      <aside class="section__preview">
        <PhonePreview
          :name="form.name"
          :intro="form.intro"
          :start-time="previewTime"
          :cover-url="form.detailCover"
          :mode="form.mode"
          :viewer-style="form.viewerStyle"
        />
      </aside>
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
.provider-tip {
  margin-left: 4px;
  font-size: 11px;
  font-weight: 400;
  opacity: 0.65;
}
.section__title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 18px;
  padding-left: 8px;
  border-left: 3px solid var(--color-primary);
}
.section__body {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}
.section__fields {
  flex: 1;
  min-width: 0;
}
.section__preview {
  flex: none;
  width: 280px;
  position: sticky;
  top: 12px;
}
.mode-tiles {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
/* 选中角标：右上三角 + Check */
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
}
.mode-tile:hover:not(.is-locked) {
  border-color: var(--color-primary);
}
.mode-tile.is-locked {
  cursor: not-allowed;
  opacity: 0.75;
}
.mode-tile.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
  color: var(--color-primary);
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
}
.viewer-style:hover:not(.is-locked) {
  border-color: var(--color-primary);
}
.viewer-style.is-locked {
  cursor: not-allowed;
  opacity: 0.75;
}
.viewer-style.is-active {
  border-color: var(--color-primary);
  background: var(--color-primary-bg);
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
