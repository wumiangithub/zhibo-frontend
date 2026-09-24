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
import type { LiveFormState, ViewerStyle } from "../composables/useLiveForm";
import videoIcon from "@/assets/images/live/video.svg?raw";
import recordIcon from "@/assets/images/live/record.svg?raw";
import voiceIcon from "@/assets/images/live/voice.svg?raw";

const props = defineProps<{ form: LiveFormState }>();

const latencyTipVisible = ref(false);

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
          label="模式设置:"
          required
          info="直播中无法修改直播模式，请在直播结束后再调整模式。"
        >
          <div class="mode-tiles">
            <label
              v-for="m in modeOptions"
              :key="m.v"
              class="mode-tile"
              :class="{ 'is-active': form.mode === m.v }"
            >
              <input
                v-model="form.mode"
                type="radio"
                :value="m.v"
                class="hidden"
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
        >
          <div class="viewer-styles">
            <label
              v-for="s in viewerStyleOptions"
              :key="s.v"
              class="viewer-style"
              :class="{ 'is-active': form.viewerStyle === s.v }"
            >
              <input
                v-model="form.viewerStyle"
                type="radio"
                :value="s.v"
                class="hidden"
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

        <FormRow label="超低延迟:">
          <div class="flex items-center gap-3">
            <ElSwitch v-model="form.ultraLowLatency" />
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

        <FormRow label="直播简介:">
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
          :start-time="previewTime"
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
.mode-tile:hover {
  border-color: var(--color-primary);
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
.viewer-style:hover {
  border-color: var(--color-primary);
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
