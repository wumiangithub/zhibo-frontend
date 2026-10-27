<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  ElButton,
  ElInput,
  ElMessage,
  ElPagination,
  ElTable,
  ElTableColumn,
} from "element-plus";
import { listAudienceComments, type AudienceCommentItem } from "@/api/audience";
import type { ActivityId } from "@/api/activity";

const props = defineProps<{ activityId: ActivityId }>();

const loading = ref(false);
const rows = ref<AudienceCommentItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const nickname = ref("");

async function fetchList() {
  loading.value = true;
  try {
    const res = await listAudienceComments(props.activityId, {
      page: page.value,
      pageSize: pageSize.value,
      nickname: nickname.value.trim() || undefined,
    });
    rows.value = res.list ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载失败");
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  void fetchList();
}

function onReset() {
  nickname.value = "";
  page.value = 1;
  void fetchList();
}

onMounted(() => {
  void fetchList();
});
</script>

<template>
  <div class="comment-manage">
    <div class="filters">
      <ElInput
        v-model="nickname"
        clearable
        placeholder="昵称"
        style="width: 200px"
        @keyup.enter="onSearch"
      />
      <ElButton type="primary" @click="onSearch">查询</ElButton>
      <ElButton @click="onReset">重置</ElButton>
    </div>

    <ElTable v-loading="loading" :data="rows" row-key="id">
      <ElTableColumn prop="commentTime" label="时间" width="180" />
      <ElTableColumn label="用户" min-width="140">
        <template #default="{ row }">
          {{ row.nickname || (row.viewerId != null ? `用户${row.viewerId}` : row.guestId || "—") }}
        </template>
      </ElTableColumn>
      <ElTableColumn prop="content" label="内容" min-width="240" />
      <ElTableColumn label="状态" width="90">
        <template #default="{ row }">
          {{ row.deleted ? "已删除" : "正常" }}
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="pager">
      <ElPagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="fetchList"
        @size-change="
          () => {
            page = 1;
            fetchList();
          }
        "
      />
    </div>
  </div>
</template>

<style scoped>
.comment-manage {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.pager {
  display: flex;
  justify-content: flex-end;
}
</style>
