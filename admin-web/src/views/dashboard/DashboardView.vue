<script setup lang="ts">
import { computed } from "vue";
import { ElTable, ElTableColumn } from "element-plus";
import { useToast } from "@/composables/useToast";

const { toast } = useToast();

/** 经营数据 Mock：只画 UI，后续再接接口 */
const bizMetrics = [
  { key: "visit", label: "今日访客数", value: "2,870" },
  { key: "newUser", label: "今日新增用户数", value: "90" },
  { key: "payAmount", label: "今日支付金额", value: "¥26,800.00" },
  { key: "order", label: "今日订单数", value: "1" },
  { key: "payUsers", label: "累计支付人数", value: "15,870" },
  { key: "users", label: "累计用户", value: "218,870" },
  { key: "totalPay", label: "累计支付金额", value: "¥111,126,800.00" },
] as const;

/** 最近直播数据 Mock */
const recentLiveRows = [
  {
    id: "1",
    title: "测试直播功能-秦",
    coverUrl: "",
    startTime: "2025-10-11 09:00:00",
    endTime: "2025-10-11 11:00:00",
    stateLabel: "已结束",
    stateTone: "ended" as const,
    roomPv: "12,480",
    roomUv: "3,210",
    watchPv: "18,902",
    watchUv: "4,105",
    avgDuration: "00:12:36",
    peakOnline: "862",
    newUsers: "47",
  },
  {
    id: "2",
    title: "十月公开课 · 市场解读",
    coverUrl: "",
    startTime: "2025-10-09 19:30:00",
    endTime: "2025-10-09 21:05:00",
    stateLabel: "已结束",
    stateTone: "ended" as const,
    roomPv: "8,136",
    roomUv: "2,044",
    watchPv: "11,220",
    watchUv: "2,580",
    avgDuration: "00:18:02",
    peakOnline: "510",
    newUsers: "29",
  },
  {
    id: "3",
    title: "产品发布会直播专场",
    coverUrl: "",
    startTime: "2025-10-08 14:00:00",
    endTime: "2025-10-08 16:20:00",
    stateLabel: "已结束",
    stateTone: "ended" as const,
    roomPv: "21,055",
    roomUv: "6,780",
    watchPv: "29,410",
    watchUv: "7,932",
    avgDuration: "00:25:41",
    peakOnline: "1,240",
    newUsers: "112",
  },
];

/** 通知中心 Mock */
const notices = [
  {
    id: "n1",
    category: "直播",
    title: "状态异常通知",
    unread: true,
    body: "直播间 ID 882910「十月公开课 · 市场解读」推流中断，请及时排查。",
  },
  {
    id: "n2",
    category: "直播",
    title: "合规风控审核结果通知",
    unread: true,
    body: "直播「产品发布会直播专场」审核通过，可正常开播。",
  },
  {
    id: "n3",
    category: "直播",
    title: "合规风控审核结果通知",
    unread: false,
    body: "直播「测试直播功能-秦」审核未通过：封面含未授权第三方 Logo。",
  },
  {
    id: "n4",
    category: "素材库",
    title: "合规风控审核结果通知",
    unread: true,
    body: "素材「活动主视觉封面-A」审核通过，已可在直播间使用。",
  },
  {
    id: "n5",
    category: "直播",
    title: "合规风控审核结果通知",
    unread: false,
    body: "直播「周末答疑专场」审核未通过：简介含未授权第三方 Logo。",
  },
];

const refreshedAt = computed(() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
});

function onMockAction(label: string) {
  toast(`「${label}」暂未开放`);
}
</script>

<template>
  <div class="dash">
    <div class="dash-main">
      <!-- 经营数据 -->
      <section class="card">
        <div class="card-head">
          <h2 class="card-title">经营数据</h2>
          <button
            type="button"
            class="refresh-btn"
            title="刷新"
            @click="onMockAction('刷新经营数据')"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014-7M19 5a9 9 0 00-14 7"
              />
            </svg>
          </button>
          <span class="refresh-time">{{ refreshedAt }}</span>
        </div>

        <div class="metrics">
          <div
            v-for="item in bizMetrics"
            :key="item.key"
            class="metric"
          >
            <div class="metric-label">{{ item.label }}</div>
            <div class="metric-value">{{ item.value }}</div>
          </div>
        </div>
      </section>

      <!-- 最近直播数据：普通表格，最左序号，名称列不缩进 -->
      <section class="card card-table">
        <div class="card-head">
          <h2 class="card-title">最近直播数据</h2>
        </div>

        <div class="table-scroll">
          <ElTable
            :data="recentLiveRows"
            row-key="id"
            height="100%"
            class="live-table"
            :header-cell-style="{
              background: '#F8FAFC',
              color: 'var(--text-3)',
              fontWeight: '400',
              fontSize: '13px',
            }"
            :cell-style="{ fontSize: '13px', color: 'var(--text-2)' }"
          >
            <ElTableColumn
              type="index"
              label="序号"
              width="64"
              align="center"
            />
            <ElTableColumn
              label="直播名称"
              min-width="220"
            >
              <template #default="{ row }">
                <div class="live-name">
                  <div class="cover">
                    <img
                      v-if="row.coverUrl"
                      :src="row.coverUrl"
                      alt=""
                    >
                    <span
                      v-else
                      class="cover-ph"
                    >无封面</span>
                  </div>
                  <span
                    class="live-title"
                    :title="row.title"
                  >{{ row.title }}</span>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="startTime"
              label="直播开始时间"
              min-width="168"
            />
            <ElTableColumn
              label="直播状态"
              min-width="100"
            >
              <template #default="{ row }">
                <span
                  class="status-dot"
                  :class="`is-${row.stateTone}`"
                >
                  <i class="dot" />
                  {{ row.stateLabel }}
                </span>
              </template>
            </ElTableColumn>
            <ElTableColumn
              prop="endTime"
              label="直播结束时间"
              min-width="168"
            />
            <ElTableColumn
              prop="roomPv"
              label="直播间浏览量"
              min-width="120"
              align="right"
            />
            <ElTableColumn
              prop="roomUv"
              label="直播间访问人数"
              min-width="130"
              align="right"
            />
            <ElTableColumn
              prop="watchPv"
              label="累计观看人次"
              min-width="120"
              align="right"
            />
            <ElTableColumn
              prop="watchUv"
              label="累计观看人数"
              min-width="120"
              align="right"
            />
            <ElTableColumn
              prop="avgDuration"
              label="人均观看时长"
              min-width="120"
              align="right"
            />
            <ElTableColumn
              prop="peakOnline"
              label="最高在线人数"
              min-width="120"
              align="right"
            />
            <ElTableColumn
              prop="newUsers"
              label="当日新增用户数"
              min-width="130"
              align="right"
            />
          </ElTable>
        </div>
      </section>
    </div>

    <!-- 通知中心 -->
    <aside class="card notice-panel">
      <button
        type="button"
        class="notice-head"
        @click="onMockAction('通知中心')"
      >
        <span>通知中心</span>
        <svg
          class="notice-chevron"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>

      <ul class="notice-list hover-scrollbar">
        <li
          v-for="item in notices"
          :key="item.id"
          class="notice-item"
          @click="onMockAction(item.title)"
        >
          <div class="notice-title-row">
            <p class="notice-title">
              <span class="notice-cat">[{{ item.category }}]</span>
              {{ item.title }}
            </p>
            <span
              v-if="item.unread"
              class="notice-dot"
              aria-label="未读"
            />
          </div>
          <p class="notice-body">{{ item.body }}</p>
        </li>
      </ul>
    </aside>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  align-items: stretch;
  gap: 16px;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.dash-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.card {
  box-sizing: border-box;
  border-radius: 12px;
  background: var(--white);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 16px 20px 0;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.refresh-btn {
  display: inline-flex;
  border: 0;
  background: transparent;
  padding: 2px;
  color: var(--text-4);
  outline: none;
  cursor: pointer;
}

.refresh-btn:hover {
  color: var(--primary);
}

.refresh-time {
  font-size: 12px;
  color: var(--text-4);
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 28px 24px;
  padding: 20px 20px 24px;
}

.metric-label {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-3);
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.card-table {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 12px;
}

/* 外层不滚，只让 ElTable 内部出一条滚动条 */
.table-scroll {
  min-width: 0;
  min-height: 0;
  flex: 1;
  margin-top: 12px;
  padding: 0 12px 4px;
  overflow: hidden;
}

.live-table {
  width: 100%;
  height: 100%;
}

.live-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cover {
  display: flex;
  flex: none;
  width: 64px;
  height: 36px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background: var(--line-soft);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-ph {
  font-size: 11px;
  color: var(--text-4);
}

.live-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  color: var(--text);
}

.notice-panel {
  display: flex;
  width: 300px;
  flex: none;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.notice-head {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  padding: 16px 20px 8px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  outline: none;
  cursor: pointer;
}

.notice-head:hover {
  color: var(--primary);
}

.notice-chevron {
  width: 14px;
  height: 14px;
  color: var(--text-4);
}

.notice-list {
  margin: 0;
  padding: 4px 12px 16px;
  list-style: none;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.notice-item {
  box-sizing: border-box;
  margin-bottom: 8px;
  border-radius: 8px;
  background: var(--bg);
  padding: 12px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.notice-item:last-child {
  margin-bottom: 0;
}

.notice-item:hover {
  background: var(--primary-soft);
}

.notice-title-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.notice-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text);
}

.notice-cat {
  color: var(--text-3);
  font-weight: 500;
}

.notice-dot {
  flex: none;
  width: 6px;
  height: 6px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--danger);
}

.notice-body {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-3);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .dash {
    flex-direction: column;
  }

  .notice-panel {
    width: 100%;
    max-height: 360px;
  }

  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
