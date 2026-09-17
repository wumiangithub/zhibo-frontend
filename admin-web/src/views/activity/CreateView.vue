<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { createActivity, TYPE_LABEL } from "@/api/activity";

const router = useRouter();
const submitting = ref(false);
const error = ref("");

const form = reactive({
  title: "",
  startTime: "",
  type: 2,
});

const typeOptions = [1, 2, 3];

function toApiTime(local: string): string {
  if (!local) return "";
  const [date, time = "00:00"] = local.split("T");
  const hms = time.length === 5 ? `${time}:00` : time;
  return `${date} ${hms}`;
}

async function submit() {
  error.value = "";
  if (!form.title.trim()) {
    error.value = "请填写标题";
    return;
  }
  if (!form.startTime) {
    error.value = "请选择开始时间";
    return;
  }
  submitting.value = true;
  try {
    const data = await createActivity({
      title: form.title.trim(),
      startTime: toApiTime(form.startTime),
      type: form.type,
    });
    router.push(`/activities/${data.id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "创建失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <h2 class="mb-4 text-lg font-semibold text-gray-800">创建活动</h2>

    <form class="space-y-4 rounded-lg border border-gray-200 bg-white p-6" @submit.prevent="submit">
      <div>
        <label class="mb-1 block text-sm text-gray-600">标题</label>
        <input
          v-model="form.title"
          type="text"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="活动标题"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600">开始时间</label>
        <input
          v-model="form.startTime"
          type="datetime-local"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm text-gray-600">类型（创建后不可改）</label>
        <select
          v-model.number="form.type"
          class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option v-for="t in typeOptions" :key="t" :value="t">
            {{ TYPE_LABEL[t] }}
          </option>
        </select>
      </div>

      <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{{ error }}</p>

      <div class="flex items-center gap-3 pt-2">
        <button
          type="submit"
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="submitting"
        >
          {{ submitting ? "提交中…" : "创建" }}
        </button>
        <button
          type="button"
          class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          @click="router.back()"
        >
          取消
        </button>
      </div>
    </form>
  </div>
</template>
