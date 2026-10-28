<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  ElCheckbox,
  ElDatePicker,
  ElMessage,
  ElOption,
  ElRadioButton,
  ElRadioGroup,
  ElSelect,
} from "element-plus";
import { listSalerProducts, type OrderCenterProduct } from "@/api/orderCenter";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const form = props.form;

const loading = ref(false);
const productError = ref("");
const options = ref<OrderCenterProduct[]>([]);

async function loadProducts() {
  loading.value = true;
  productError.value = "";
  try {
    options.value = await listSalerProducts();
  } catch (e) {
    productError.value = e instanceof Error ? e.message : "拉取商品列表失败";
    options.value = [];
    ElMessage.error(productError.value);
  } finally {
    loading.value = false;
  }
}

function onProductChange(spuIds: string[]) {
  const map = new Map(options.value.map((p) => [p.spuId, p]));
  for (const p of form.products) map.set(p.spuId, p);
  form.products = spuIds
    .map((id) => {
      const hit = map.get(id);
      return hit ? { spuId: hit.spuId, productName: hit.productName } : null;
    })
    .filter((p): p is { spuId: string; productName: string } => !!p);
}

onMounted(() => {
  void loadProducts();
});
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
          <ElRadioButton value="specified">指定学员</ElRadioButton>
        </ElRadioGroup>
      </div>
      <div class="validity-box">
        <span class="text-[13px] text-[#333]">有效期：</span>
        <ElRadioGroup
          :model-value="'long'"
          disabled
        >
          <ElRadioButton value="long">长期有效</ElRadioButton>
        </ElRadioGroup>
      </div>
    </div>
  </FormRow>

  <FormRow label="关联商品:">
    <div>
      <div class="flex items-center gap-3">
        <ElSelect
          :model-value="form.products.map((p) => p.spuId)"
          multiple
          filterable
          clearable
          collapse-tags
          collapse-tags-tooltip
          :max-collapse-tags="2"
          :loading="loading"
          placeholder="从订单中心选择商品（可选）"
          style="width: 420px"
          @update:model-value="onProductChange"
        >
          <ElOption
            v-for="p in options"
            :key="p.spuId"
            :label="p.productName"
            :value="p.spuId"
          />
        </ElSelect>
        <a
          class="link"
          @click.prevent="loadProducts"
        >刷新</a>
      </div>
      <p
        v-if="productError"
        class="hint is-err"
      >
        {{ productError }}（可不选商品继续保存）
      </p>
      <p
        v-else
        class="hint"
      >
        商品名称按保存时快照写入本站；拉取失败仍可无商品保存
      </p>
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
      <span class="hint">本迭代不落库</span>
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
        <span class="hint">定时本版不调度，保存时按「暂不上架」处理</span>
      </div>
    </div>
  </FormRow>

  <FormRow label="更多设置:">
    <div class="more-box">
      <div class="flex items-center gap-6">
        <ElCheckbox v-model="form.hidden">隐藏</ElCheckbox>
        <ElCheckbox v-model="form.stopped">停售</ElCheckbox>
      </div>
      <p class="hint">隐藏 / 停售本迭代不落库</p>
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
.hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999;
}
.hint.is-err {
  color: #cf1322;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
