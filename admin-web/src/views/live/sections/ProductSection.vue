<script setup lang="ts">
import { ElCheckbox, ElRadioGroup, ElRadioButton, ElSelect, ElOption, ElDatePicker } from "element-plus";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

defineProps<{ form: LiveFormState }>();
</script>

<template>
  <div class="section-title">商品信息</div>

  <FormRow label="售卖方式:">
    <div>
      <div class="flex items-center gap-3">
        <ElCheckbox v-model="form.sellAlone">单独售卖</ElCheckbox>
        <span class="text-[12px] text-[#999]">用户可以通过店铺或链接的方式单独购买该商品</span>
      </div>
      <div class="mt-3">
        <ElRadioGroup v-model="form.sellType">
          <ElRadioButton value="free">免费</ElRadioButton>
          <ElRadioButton value="paid">付费</ElRadioButton>
          <ElRadioButton value="encrypted">加密</ElRadioButton>
          <ElRadioButton value="specified">指定用户</ElRadioButton>
        </ElRadioGroup>
      </div>
      <div class="validity-box">
        <span class="text-[13px] text-[#333]">有效期：</span>
        <ElRadioGroup
          :model-value="'long'"
          disabled
        >
          <ElRadioButton value="long">{{ form.validity }}</ElRadioButton>
        </ElRadioGroup>
      </div>
    </div>
  </FormRow>

  <FormRow label="商品分组:">
    <div class="flex items-center gap-3">
      <ElSelect
        v-model="form.productGroup"
        placeholder="请选择"
        style="width: 200px"
      >
        <ElOption
          label="默认分组"
          value="default"
        />
      </ElSelect>
      <a class="link">刷新</a>
      <a class="link">前往商品分组</a>
      <a class="link">查看教程</a>
    </div>
  </FormRow>

  <FormRow label="上架设置:">
    <div>
      <ElRadioGroup v-model="form.shelfType">
        <ElRadioButton value="now">立即上架</ElRadioButton>
        <ElRadioButton value="scheduled">定时上架</ElRadioButton>
        <ElRadioButton value="none">暂不上架</ElRadioButton>
      </ElRadioGroup>
      <div
        v-if="form.shelfType === 'scheduled'"
        class="mt-3 flex items-center gap-2"
      >
        <ElDatePicker
          v-model="form.shelfTime"
          type="datetime"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
          placeholder="请设置时间"
          style="width: 200px"
        />
      </div>
    </div>
  </FormRow>

  <FormRow label="更多设置:">
    <div class="more-box">
      <div class="flex items-center gap-6">
        <ElCheckbox v-model="form.hidden">隐藏</ElCheckbox>
        <ElCheckbox v-model="form.stopped">停售</ElCheckbox>
      </div>
    </div>
  </FormRow>
</template>

<style scoped>
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 8px 0 18px;
  padding-left: 8px;
  border-left: 3px solid var(--color-primary);
}
.validity-box {
  margin-top: 12px;
  background: #f7f8fa;
  border-radius: 6px;
  padding: 12px 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.more-box {
  background: #f7f8fa;
  border-radius: 6px;
  padding: 12px 16px;
  display: inline-block;
}
.link {
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}
.link:hover {
  opacity: 0.8;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
