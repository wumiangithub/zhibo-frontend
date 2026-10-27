<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  ElButton,
  ElDialog,
  ElEmpty,
  ElIcon,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElPagination,
  ElTable,
  ElTableColumn,
  ElTooltip,
} from "element-plus";
import { InfoFilled, Search } from "@element-plus/icons-vue";
import {
  createViewerTagGroup,
  deleteViewerTagGroup,
  listViewerTags,
  pageViewerTagGroups,
  updateViewerTagGroup,
  type ViewerTagGroupPageItem,
  type ViewerTagItem,
} from "@/api/viewerTag";
import { ApiError } from "@/api/http";

const loading = ref(false);
const rows = ref<ViewerTagGroupPageItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const nameKeyword = ref("");

const formVisible = ref(false);
const formMode = ref<"create" | "edit">("create");
const formId = ref(0);
const formName = ref("");
const formSubmitting = ref(false);

const viewVisible = ref(false);
const viewLoading = ref(false);
const viewTags = ref<ViewerTagItem[]>([]);
const viewGroupName = ref("");

const blockVisible = ref(false);
const blockTagCount = ref(0);

async function fetchList() {
  loading.value = true;
  try {
    const res = await pageViewerTagGroups({
      page: page.value,
      pageSize: pageSize.value,
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

function openCreate() {
  formMode.value = "create";
  formId.value = 0;
  formName.value = "";
  formVisible.value = true;
}

function openEdit(row: ViewerTagGroupPageItem) {
  if (row.isDefault) return;
  formMode.value = "edit";
  formId.value = row.id;
  formName.value = row.name;
  formVisible.value = true;
}

const canConfirmForm = () => {
  const n = formName.value.trim();
  return n.length > 0 && n.length <= 10 && !formSubmitting.value;
};

async function onConfirmForm() {
  if (!canConfirmForm()) return;
  formSubmitting.value = true;
  try {
    if (formMode.value === "create") {
      await createViewerTagGroup({ name: formName.value.trim() });
      ElMessage.success("创建成功");
    } else {
      await updateViewerTagGroup(formId.value, { name: formName.value.trim() });
      ElMessage.success("保存成功");
    }
    formVisible.value = false;
    void fetchList();
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "保存失败");
  } finally {
    formSubmitting.value = false;
  }
}

async function openViewTags(row: ViewerTagGroupPageItem) {
  viewGroupName.value = row.name;
  viewVisible.value = true;
  viewLoading.value = true;
  viewTags.value = [];
  try {
    const res = await listViewerTags({
      page: 1,
      pageSize: 100,
      groupId: row.id,
    });
    viewTags.value = res.list ?? [];
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "加载标签失败");
  } finally {
    viewLoading.value = false;
  }
}

async function onDelete(row: ViewerTagGroupPageItem) {
  if (row.isDefault) return;
  if (row.tagCount > 0) {
    blockTagCount.value = row.tagCount;
    blockVisible.value = true;
    return;
  }
  try {
    await ElMessageBox.confirm("删除后，标签将无法加入该分组", "删除分组", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      confirmButtonClass: "el-button--danger",
    });
  } catch {
    return;
  }
  try {
    await deleteViewerTagGroup(row.id);
    ElMessage.success("已删除");
    if (rows.value.length <= 1 && page.value > 1) page.value -= 1;
    void fetchList();
  } catch (e) {
    if (e instanceof ApiError && e.message.includes("不可删除分组")) {
      const m = e.message.match(/有(\d+)个标签/);
      blockTagCount.value = m ? Number(m[1]) : row.tagCount;
      blockVisible.value = true;
      return;
    }
    ElMessage.error(e instanceof Error ? e.message : "删除失败");
  }
}

onMounted(() => {
  void fetchList();
});

defineExpose({ refresh: fetchList });
</script>

<template>
  <div class="group-panel">
    <div class="toolbar">
      <ElButton
        type="primary"
        @click="openCreate"
      >
        + 新建分组
      </ElButton>
      <div class="toolbar-right">
        <ElInput
          v-model="nameKeyword"
          clearable
          placeholder="搜索标签分组名称"
          style="width: 260px"
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
      >
        <ElTableColumn
          prop="name"
          label="分组名称"
          min-width="180"
        />
        <ElTableColumn
          prop="tagCount"
          label="包含标签"
          width="120"
        />
        <ElTableColumn
          label="操作"
          width="220"
          fixed="right"
        >
          <template #default="{ row }">
            <button
              type="button"
              class="link-btn"
              @click="openViewTags(row)"
            >
              查看标签
            </button>
            <span class="op-sep">|</span>
            <button
              type="button"
              class="link-btn"
              :class="{ disabled: row.isDefault }"
              :disabled="row.isDefault"
              @click="openEdit(row)"
            >
              编辑
            </button>
            <span class="op-sep">|</span>
            <button
              type="button"
              class="link-btn"
              :class="{ disabled: row.isDefault }"
              :disabled="row.isDefault"
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

    <ElDialog
      v-model="formVisible"
      :title="formMode === 'create' ? '新建分组' : '编辑分组'"
      width="480px"
      destroy-on-close
    >
      <div class="form-row">
        <label class="label required">分组名称:</label>
        <ElInput
          v-model="formName"
          maxlength="10"
          show-word-limit
          placeholder="请输入分组名称"
        />
      </div>
      <template #footer>
        <ElButton @click="formVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :disabled="!canConfirmForm()"
          :loading="formSubmitting"
          @click="onConfirmForm"
        >
          确认
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="viewVisible"
      title="查看标签"
      width="560px"
      destroy-on-close
    >
      <ElTable
        v-loading="viewLoading"
        :data="viewTags"
        max-height="360"
      >
        <ElTableColumn
          prop="name"
          label="标签名称"
          min-width="160"
        />
        <ElTableColumn width="140">
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
        <template #empty>
          <ElEmpty
            description="暂无标签"
            :image-size="64"
          />
        </template>
      </ElTable>
      <template #footer>
        <ElButton
          type="primary"
          @click="viewVisible = false"
        >
          确认
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog
      v-model="blockVisible"
      title="暂不可删除分组"
      width="480px"
      destroy-on-close
    >
      <div class="block-body">
        <ElIcon
          class="block-warn"
          color="#f56c6c"
          :size="22"
        >
          <InfoFilled />
        </ElIcon>
        <p>
          该分组有{{ blockTagCount }}个标签，不可删除分组，
          <span class="fake-link">【标签列表】</span>
          ，请前往标签列表将其调整至其它标签分组后再删除
        </p>
      </div>
      <template #footer>
        <ElButton @click="blockVisible = false">取消</ElButton>
        <ElButton
          type="danger"
          @click="blockVisible = false"
        >
          我知道了
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.group-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
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
}
.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #ebebeb;
  border-radius: 4px;
  background: #fff;
}
.link-btn {
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 13px;
}
.link-btn:hover:not(.disabled) {
  opacity: 0.85;
}
.link-btn.disabled,
.link-btn:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
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
.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.label {
  flex: none;
  font-size: 14px;
  color: #333;
  white-space: nowrap;
}
.label.required::before {
  content: "*";
  color: #f56c6c;
  margin-right: 4px;
}
.th-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.info-icon {
  font-size: 14px;
  color: #c0c4cc;
  cursor: help;
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
.block-body {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
}
.block-warn {
  flex: none;
  margin-top: 2px;
}
.fake-link {
  color: var(--color-primary);
}
</style>
