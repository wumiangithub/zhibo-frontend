<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  ElButton,
  ElEmpty,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElSelect,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from "element-plus";
import { InfoFilled, Search } from "@element-plus/icons-vue";
import {
  deleteViewerTag,
  listViewerTags,
  ViewerTagType,
  viewerTagTypeLabel,
  type ViewerTagItem,
} from "@/api/viewerTag";
import TagGroupPanel from "./TagGroupPanel.vue";
import { exportTagRows } from "./exportTagRows";

const router = useRouter();

const activeTab = ref<"list" | "groups">("list");
const groupPanelRef = ref<InstanceType<typeof TagGroupPanel> | null>(null);

function onTabChange(tab: "list" | "groups") {
  activeTab.value = tab;
  if (tab === "list") void fetchList();
  else void groupPanelRef.value?.refresh();
}
const loading = ref(false);
const rows = ref<ViewerTagItem[]>([]);
const selected = ref<ViewerTagItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const typeFilter = ref<number | "">("");
const nameKeyword = ref("");

async function fetchList() {
  loading.value = true;
  try {
    const res = await listViewerTags({
      page: page.value,
      pageSize: pageSize.value,
      type: typeFilter.value === "" ? undefined : typeFilter.value,
      name: nameKeyword.value.trim() || undefined,
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

function onTypeChange() {
  page.value = 1;
  void fetchList();
}

function onSelectionChange(list: ViewerTagItem[]) {
  selected.value = list;
}

function onExport() {
  if (!selected.value.length) {
    ElMessage.warning("请先勾选要导出的标签");
    return;
  }
  exportTagRows(selected.value);
}

function onCreate() {
  void router.push({ name: "user-tags-create" });
}

function onDetail(row: ViewerTagItem) {
  void router.push({ name: "user-tags-detail", params: { id: String(row.id) } });
}

function onEdit(row: ViewerTagItem) {
  void router.push({ name: "user-tags-edit", params: { id: String(row.id) } });
}

function onAutoDetailPlaceholder() {
  ElMessage.info("自动标签详情即将开放");
}

async function onDelete(row: ViewerTagItem) {
  try {
    await ElMessageBox.confirm("确认删除该标签？", "提示", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }
  try {
    await deleteViewerTag(row.id);
    ElMessage.success("已删除");
    if (rows.value.length <= 1 && page.value > 1) {
      page.value -= 1;
    }
    void fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

onMounted(() => {
  void fetchList();
});
</script>

<template>
  <div class="tag-manage">
    <div class="tabs">
      <button
        type="button"
        class="tab"
        :class="{ active: activeTab === 'list' }"
        @click="onTabChange('list')"
      >
        标签列表
      </button>
      <button
        type="button"
        class="tab"
        :class="{ active: activeTab === 'groups' }"
        @click="onTabChange('groups')"
      >
        标签分组
      </button>
    </div>

    <TagGroupPanel
      v-if="activeTab === 'groups'"
      ref="groupPanelRef"
    />

    <template v-else>
      <div class="toolbar">
        <ElButton
          type="primary"
          @click="onCreate"
        >
          + 新建标签
        </ElButton>
        <ElButton @click="onExport">导出</ElButton>
        <div class="toolbar-right">
          <ElSelect
            v-model="typeFilter"
            style="width: 120px"
            @change="onTypeChange"
          >
            <ElOption
              label="全部标签"
              :value="''"
            />
            <ElOption
              label="手动标签"
              :value="ViewerTagType.MANUAL"
            />
            <ElOption
              label="自动标签"
              :value="ViewerTagType.AUTO"
            />
          </ElSelect>
          <ElInput
            v-model="nameKeyword"
            clearable
            placeholder="请输入内容"
            style="width: 240px"
            @keyup.enter="onSearch"
            @clear="onSearch"
          >
            <template #append>
              <ElButton
                :icon="Search"
                @click="onSearch"
              />
            </template>
          </ElInput>
        </div>
      </div>

      <div class="table-wrap">
        <ElTable
          v-loading="loading"
          :data="rows"
          height="100%"
          @selection-change="onSelectionChange"
        >
          <ElTableColumn
            type="selection"
            width="48"
          />
          <ElTableColumn
            prop="name"
            label="标签名字"
            min-width="160"
          />
          <ElTableColumn
            label="标签类型"
            width="110"
          >
            <template #default="{ row }">
              {{ viewerTagTypeLabel(row.type) }}
            </template>
          </ElTableColumn>
          <ElTableColumn
            label="标签定义"
            min-width="220"
          >
            <template #default="{ row }">
              <template v-if="row.type === ViewerTagType.AUTO">
                <span v-if="row.definitionSummary">{{ row.definitionSummary }}</span>
                <span v-else>--</span>
                <button
                  type="button"
                  class="link-btn detail-link"
                  @click="onAutoDetailPlaceholder"
                >
                  详情
                </button>
              </template>
              <span v-else>--</span>
            </template>
          </ElTableColumn>
          <ElTableColumn width="120">
            <template #header>
              <span class="th-with-tip">
                标签人数
                <ElTooltip
                  placement="top"
                  :show-after="200"
                >
                  <template #content>
                    <div class="user-count-tip">
                      <p>1. 手动标签标签人数实时更新;</p>
                      <p>2. 自动标签符合条件的人数出现时，标签人数需要5分钟左右更新</p>
                      <p>3. 不包含已注销用户</p>
                    </div>
                  </template>
                  <ElIcon class="info-icon">
                    <InfoFilled />
                  </ElIcon>
                </ElTooltip>
              </span>
            </template>
            <template #default="{ row }">
              <span class="user-count">{{ row.userCount }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn
            prop="groupName"
            label="所属分组"
            width="120"
          />
          <ElTableColumn
            label="操作"
            width="160"
            fixed="right"
          >
            <template #default="{ row }">
              <button
                type="button"
                class="link-btn"
                @click="onDetail(row)"
              >
                详情
              </button>
              <span class="op-sep">|</span>
              <button
                type="button"
                class="link-btn"
                @click="onEdit(row)"
              >
                编辑
              </button>
              <span class="op-sep">|</span>
              <button
                type="button"
                class="link-btn"
                @click="onDelete(row)"
              >
                删除
              </button>
            </template>
          </ElTableColumn>
          <template #empty>
            <ElEmpty
              description="暂无数据"
              :image-size="80"
            />
          </template>
        </ElTable>
      </div>

      <div class="pager">
        <span class="pager-total">共 {{ total }} 条</span>
        <ElPagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          background
          layout="sizes, prev, pager, next, jumper"
          @current-change="fetchList"
          @size-change="
            () => {
              page = 1;
              fetchList();
            }
          "
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.tag-manage {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100dvh - 92px);
  min-height: 0;
  overflow: hidden;
}
.tabs {
  flex: none;
  display: flex;
  gap: 24px;
  border-bottom: 1px solid #ebebeb;
}
.tab {
  border: 0;
  background: transparent;
  padding: 0 0 10px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  position: relative;
}
.tab.active {
  color: var(--color-primary);
  font-weight: 500;
}
.tab.active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--color-primary);
}
.toolbar {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.toolbar-right {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  background: #fff;
}
.th-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.info-icon {
  margin-left: 2px;
  font-size: 14px;
  color: #c0c4cc;
  cursor: help;
  vertical-align: middle;
}
.user-count {
  color: var(--color-primary);
}
.user-count-tip {
  max-width: 280px;
  line-height: 1.6;
  font-size: 12px;
}
.user-count-tip p {
  margin: 0;
}
.link-btn {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 13px;
}
.link-btn:hover {
  opacity: 0.85;
}
.detail-link {
  margin-left: 4px;
}
.op-sep {
  color: #ddd;
  margin: 0 6px;
}
.pager {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}
.pager-total {
  font-size: 13px;
  color: #666;
  margin-right: auto;
}
</style>
