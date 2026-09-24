<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { useToast } from "@/composables/useToast";

const { toast } = useToast();

/** 近期直播 Mock：样式优先，后续再接 GET /api/activities */
const recentLives = [
  { id: "mock-1", title: "测试直播功能-秦", stateLabel: "已结束" },
];

const todos = [
  { key: "complaint", label: "待处理投诉", value: 0 },
  { key: "pay", label: "待付款订单", value: 0 },
  { key: "ship", label: "待发货订单(近30天)", value: 0 },
  { key: "aftersale", label: "待处理售后订单", value: 0 },
  { key: "feedback", label: "用户反馈", value: 0 },
  { key: "promoter", label: "待审核推广员", value: 0 },
];

const bizMetrics = [
  { key: "visit", label: "今日店铺访客数", value: "8" },
  { key: "newUser", label: "今日新增用户数", value: "3" },
  { key: "payAmount", label: "今日支付金额", value: "¥ 0.01", tip: true },
  { key: "order", label: "今日订单数", value: "1", tip: true },
  { key: "payUsers", label: "累计支付人数", value: "17" },
  { key: "users", label: "累计用户", value: "31,457" },
  { key: "totalPay", label: "累计支付金额", value: "¥ 28,060.06", tip: true },
  { key: "withdraw", label: "可提现金额", value: "¥ 0.00", tip: true, action: "提现" },
];

const refreshedAt = computed(() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
});

const selectedLive = recentLives[0];

function onMockAction(label: string) {
  toast(`「${label}」暂未开放`);
}
</script>

<template>
  <div class="mx-auto flex max-w-[1080px] flex-col gap-5">
    <!-- 近期直播 -->
    <section class="rounded-lg bg-white px-5 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-baseline gap-3">
          <h2 class="text-[16px] font-semibold text-[#1a1a1a]">近期直播</h2>
          <RouterLink
            to="/live"
            class="border-0 bg-transparent text-[13px] text-[#999] outline-none transition-colors hover:text-[var(--color-primary)]"
          >
            全部直播 &gt;
          </RouterLink>
        </div>
        <RouterLink
          to="/live/create"
          class="inline-flex items-center gap-1 rounded border-0 bg-[var(--color-primary)] px-3.5 py-1.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          <span class="text-[15px] leading-none">+</span>
          新建直播
        </RouterLink>
      </div>

      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div class="flex min-h-[200px] flex-col md:border-r md:border-[#f0f0f0] md:pr-5">
          <div
            v-for="item in recentLives"
            :key="item.id"
            class="mb-3 rounded-md bg-[#fafafa] px-4 py-3"
          >
            <p class="mb-2.5 text-[14px] font-medium text-[#1a1a1a]">{{ item.title }}</p>
            <div class="flex items-center justify-between">
              <span class="inline-flex items-center gap-1.5 text-[12px] text-[#999]">
                <span class="h-1.5 w-1.5 rounded-full bg-[#bfbfbf]" />
                {{ item.stateLabel }}
              </span>
              <button
                type="button"
                class="rounded border border-[var(--color-primary-border)] bg-white px-2.5 py-0.5 text-[12px] text-[var(--color-primary)] outline-none transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-bg)]"
                @click="onMockAction('直播管理')"
              >
                直播管理
              </button>
            </div>
          </div>

          <div class="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-[13px] text-[#bfbfbf]">
            <span>暂无更多直播</span>
            <RouterLink
              to="/live/create"
              class="border-0 bg-transparent text-[13px] text-[var(--color-primary)] outline-none"
            >
              新建直播
            </RouterLink>
          </div>
        </div>

        <div class="rounded-md bg-[#eef5ff] p-4">
          <h3 class="mb-3 text-[14px] font-semibold text-[#1a1a1a]">{{ selectedLive.title }}</h3>
          <div class="space-y-2.5">
            <div class="flex items-center justify-between rounded-md bg-white px-3.5 py-3">
              <div class="min-w-0 pr-3">
                <p class="text-[13px] font-medium text-[#1a1a1a]">用户管理</p>
                <p class="mt-0.5 text-[12px] text-[#999]">查看用户行为，确定用户意向</p>
              </div>
              <button
                type="button"
                class="flex-none rounded border border-[#e8e8e8] bg-white px-2.5 py-1 text-[12px] text-[#666] outline-none transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                @click="onMockAction('用户管理')"
              >
                去查看
              </button>
            </div>
            <div class="flex items-center justify-between rounded-md bg-white px-3.5 py-3">
              <div class="min-w-0 pr-3">
                <p class="text-[13px] font-medium text-[#1a1a1a]">直播数据</p>
                <p class="mt-0.5 text-[12px] text-[#999]">查看直播各项数据，复盘场次直播效果</p>
              </div>
              <button
                type="button"
                class="flex-none rounded border border-[#e8e8e8] bg-white px-2.5 py-1 text-[12px] text-[#666] outline-none transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                @click="onMockAction('直播数据')"
              >
                去查看
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 待办事项：内容格保留细边，hover 浅蓝 -->
    <section class="rounded-lg bg-white px-5 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <h2 class="mb-4 text-[16px] font-semibold text-[#1a1a1a]">待办事项</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          v-for="item in todos"
          :key="item.key"
          type="button"
          class="flex flex-col items-center justify-center gap-2 rounded-md border border-[#f0f0f0] bg-white px-2 py-4 outline-none transition-colors hover:border-[#adc6ff] hover:bg-[#f7faff]"
          @click="onMockAction(item.label)"
        >
          <span class="text-[22px] font-semibold tabular-nums leading-none text-[#1a1a1a]">{{ item.value }}</span>
          <span class="text-center text-[12px] leading-snug text-[#999]">{{ item.label }}</span>
        </button>
      </div>
    </section>

    <!-- 经营数据 -->
    <section class="rounded-lg bg-white px-5 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <div class="mb-5 flex flex-wrap items-center gap-2">
        <h2 class="text-[16px] font-semibold text-[#1a1a1a]">经营数据</h2>
        <button
          type="button"
          class="border-0 bg-transparent p-0.5 text-[#bfbfbf] outline-none hover:text-[var(--color-primary)]"
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
        <span class="text-[12px] text-[#bfbfbf]">{{ refreshedAt }}</span>
      </div>

      <div class="grid grid-cols-2 gap-x-8 gap-y-7 md:grid-cols-4">
        <div
          v-for="item in bizMetrics"
          :key="item.key"
          class="min-w-0"
        >
          <div class="mb-1.5 flex items-center gap-1 text-[12px] text-[#999]">
            <span>{{ item.label }}</span>
            <button
              v-if="item.tip"
              type="button"
              class="border-0 bg-transparent p-0 text-[#d9d9d9] outline-none hover:text-[var(--color-primary)]"
              @click="onMockAction(item.label + '说明')"
            >
              <svg
                class="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                />
                <path d="M12 8h.01M11 12h1v4h1" />
              </svg>
            </button>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-[22px] font-semibold tabular-nums leading-none text-[#1a1a1a]">{{ item.value }}</span>
            <button
              v-if="item.action"
              type="button"
              class="border-0 bg-transparent p-0 text-[13px] text-[var(--color-primary)] outline-none"
              @click="onMockAction(item.action)"
            >
              {{ item.action }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
