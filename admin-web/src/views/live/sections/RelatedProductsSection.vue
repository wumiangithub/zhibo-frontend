<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElOption, ElSelect } from "element-plus";
import {
  canBindOrderCenterProduct,
  listSalerProducts,
  type OrderCenterProduct,
} from "@/api/orderCenter";
import { useMarkDirty } from "@/composables/useLeaveConfirm";
import FormRow from "../components/FormRow.vue";
import type { LiveFormState } from "../composables/useLiveForm";

const props = defineProps<{ form: LiveFormState }>();
const form = props.form;
const markDirty = useMarkDirty();

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
  const prevIds = form.products.map((p) => p.spuId);
  const prevSet = new Set(prevIds);
  const blockedNew = spuIds.filter((id) => {
    if (prevSet.has(id)) return false;
    const hit = options.value.find((p) => p.spuId === id);
    return !!hit && !canBindOrderCenterProduct(hit);
  });
  if (blockedNew.length) {
    ElMessage.warning("无 SKU 的商品不可绑定");
  }
  const nextIds = spuIds.filter((id) => !blockedNew.includes(id)).slice(0, 20);
  // 选项异步加载 / 重渲染时 ElSelect 可能无差异回发
  if (
    nextIds.length === prevIds.length &&
    nextIds.every((id, i) => id === prevIds[i])
  ) {
    return;
  }
  const map = new Map(options.value.map((p) => [p.spuId, p]));
  for (const p of form.products) map.set(p.spuId, p);
  form.products = nextIds
    .map((id) => {
      const hit = map.get(id);
      return hit ? { spuId: hit.spuId, productName: hit.productName } : null;
    })
    .filter((p): p is { spuId: string; productName: string } => !!p);
  markDirty();
}

onMounted(() => {
  void loadProducts();
});
</script>

<template>
  <FormRow
    label="关联商品:"
    info="商品名称按保存时快照写入本站；最多 20 个。无 SKU 的商品不可选"
  >
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
          placeholder="+ 选择商品"
          style="width: 420px"
          @update:model-value="onProductChange"
        >
          <ElOption
            v-for="p in options"
            :key="p.spuId"
            :label="p.productName"
            :value="p.spuId"
            :disabled="!canBindOrderCenterProduct(p)"
          >
            <span :class="{ 'is-unbindable': !canBindOrderCenterProduct(p) }">
              {{ p.productName }}
              <span
                v-if="!canBindOrderCenterProduct(p)"
                class="sku-hint"
              >无SKU</span>
            </span>
          </ElOption>
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
    </div>
  </FormRow>
</template>

<style scoped>
.link {
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
}
.hint.is-err {
  margin: 8px 0 0;
  font-size: 12px;
  color: #cf1322;
}
.is-unbindable {
  color: #a8abb2;
  cursor: not-allowed;
}
.sku-hint {
  margin-left: 8px;
  font-size: 12px;
  color: #c0c4cc;
}
:deep(.form-row) {
  margin-bottom: 18px;
}
</style>
