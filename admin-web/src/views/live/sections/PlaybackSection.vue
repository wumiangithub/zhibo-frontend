<script setup lang="ts">
import {
  ElSwitch,
  ElRadioGroup,
  ElRadio,
  ElInputNumber,
  ElDatePicker,
  ElIcon,
  ElMessage,
} from "element-plus";
import { CircleClose } from "@element-plus/icons-vue";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();

const MAX_PERIODS = 5;

function addPeriod() {
  if (props.form.playbackPeriods.length >= MAX_PERIODS) {
    ElMessage.warning(`最多添加 ${MAX_PERIODS} 个时段`);
    return;
  }
  props.form.playbackPeriods.push({ start: "", end: "" });
}

function removePeriod(index: number) {
  if (index <= 0) return;
  props.form.playbackPeriods.splice(index, 1);
}

/** 首条未填开始时间时，视为「直播结束时」 */
function resolvePeriodStart(index: number, start: string): string | null {
  if (start) return start;
  if (index === 0 && props.form.endDate && props.form.endTime) {
    const t = props.form.endTime.length === 5 ? `${props.form.endTime}:00` : props.form.endTime;
    return `${props.form.endDate} ${t}`;
  }
  return null;
}

function validatePeriodRange(index: number, field: "start" | "end") {
  const p = props.form.playbackPeriods[index];
  if (!p) return;
  const start = resolvePeriodStart(index, p.start);
  const end = p.end;
  if (!start || !end) return;
  if (new Date(end).getTime() <= new Date(start).getTime()) {
    ElMessage.error("回放结束时间必须大于开始时间");
    if (field === "end") p.end = "";
    else p.start = "";
  }
}
</script>

<template>
  <FormRow label="回放设置:">
    <div class="playback-box">
      <div class="flex items-center gap-3">
        <ElSwitch v-model="form.playbackEnabled" />
        <span class="text-[12px] text-[#999]">开启回放后，直播结束后直播间将播放回放视频</span>
      </div>

      <div
        v-if="form.playbackEnabled"
        class="mt-4"
      >
        <div class="flex items-start gap-3">
          <span class="playback-label">回放有效期:</span>
          <div class="flex-1 min-w-0">
            <ElRadioGroup
              v-model="form.playbackValidity"
              class="validity-radios"
            >
              <ElRadio value="forever">永久有效</ElRadio>
              <ElRadio value="days">
                <span class="days-option">
                  直播结束后有效天数：
                  <ElInputNumber
                    v-model="form.playbackDays"
                    :min="1"
                    :max="365"
                    size="small"
                    style="width: 100px"
                    @click.stop
                  />
                </span>
              </ElRadio>
              <ElRadio value="period">指定时段有效</ElRadio>
            </ElRadioGroup>

            <div
              v-if="form.playbackValidity === 'period'"
              class="period-list"
            >
              <div
                v-for="(p, i) in form.playbackPeriods"
                :key="i"
                class="period-row"
              >
                <span class="period-row__idx">{{ i + 1 }}</span>
                <ElDatePicker
                  v-model="p.start"
                  type="datetime"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  :placeholder="i === 0 ? '直播结束时' : '请选择日期和时间'"
                  style="width: 200px"
                  @change="validatePeriodRange(i, 'start')"
                />
                <span class="period-row__sep">至</span>
                <ElDatePicker
                  v-model="p.end"
                  type="datetime"
                  format="YYYY-MM-DD HH:mm:ss"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  placeholder="请选择日期和时间"
                  style="width: 200px"
                  @change="validatePeriodRange(i, 'end')"
                />
                <button
                  v-if="i > 0"
                  type="button"
                  class="period-row__del"
                  title="删除"
                  @click="removePeriod(i)"
                >
                  <ElIcon :size="16"><CircleClose /></ElIcon>
                </button>
              </div>
              <a
                v-if="form.playbackPeriods.length < MAX_PERIODS"
                class="period-add"
                href="javascript:;"
                @click.prevent="addPeriod"
              >+ 增加时段</a>
            </div>
          </div>
        </div>
        <p class="playback-tip">到期后，学员无法观看回放内容，但仍可进入直播间查看聊天内容及共享文件</p>
      </div>

      <template v-if="form.playbackEnabled">
        <div class="mt-4 flex items-center gap-3">
          <span class="playback-label">
            <span class="pro-tag">[专业版]</span> 倍速播放:
          </span>
          <ElRadioGroup v-model="form.playbackSpeed">
            <ElRadioButton value="allow">允许</ElRadioButton>
            <ElRadioButton value="forbid">禁止</ElRadioButton>
          </ElRadioGroup>
        </div>
        <p class="playback-tip">禁止时，课程未学完学员不可倍速播放</p>

        <div class="mt-4 flex items-center gap-3">
          <span class="playback-label">
            <span class="pro-tag">[专业版]</span> 快进:
          </span>
          <ElRadioGroup v-model="form.fastForward">
            <ElRadioButton value="allow">允许</ElRadioButton>
            <ElRadioButton value="forbid">禁止</ElRadioButton>
          </ElRadioGroup>
        </div>
        <p class="playback-tip">禁止时，课程未学完学员不可快进</p>

        <div class="mt-4 flex items-center gap-3">
          <span class="playback-label">直播回放增强防护:</span>
          <ElSwitch v-model="form.replayProtection" />
          <span class="text-[12px] text-[#999]">开启后，仅支持在客户端观看直播回放，可有效防止H5、小程序等路径的盗录行为</span>
        </div>
      </template>
    </div>
  </FormRow>
</template>

<style scoped>
.playback-box {
  background: #f7f8fa;
  border-radius: 6px;
  padding: 16px;
}
.playback-label {
  font-size: 13px;
  color: #333;
  white-space: nowrap;
  line-height: 32px;
}
.validity-radios {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.validity-radios :deep(.el-radio) {
  height: auto;
  margin-right: 0;
  align-items: center;
}
.days-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.playback-tip {
  margin-top: 6px;
  margin-left: 100px;
  font-size: 12px;
  color: #999;
}
.pro-tag {
  display: inline-block;
  background: var(--color-primary-bg);
  color: var(--color-primary);
  border-radius: 2px;
  padding: 0 4px;
  font-size: 11px;
  margin-right: 4px;
}
.period-list {
  margin-top: 12px;
}
.period-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.period-row__idx {
  width: 18px;
  flex: none;
  font-size: 13px;
  color: #666;
  text-align: center;
}
.period-row__sep {
  font-size: 13px;
  color: #666;
  flex: none;
}
.period-row__del {
  flex: none;
  border: 0;
  background: transparent;
  padding: 0;
  color: #c0c4cc;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.period-row__del:hover {
  color: #f5222d;
}
.period-add {
  display: inline-block;
  margin-left: 26px;
  font-size: 13px;
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: none;
}
.period-add:hover {
  opacity: 0.85;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
