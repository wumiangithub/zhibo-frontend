<script setup lang="ts">
export type DataKpiMetric = {
  label: string;
  value: string | number;
};

defineProps<{
  primaryLabel: string;
  primaryValue: string | number;
  /** 副指标：前 4 个进 2×2，第 5 个（若有）底栏居中；宽卡横排 */
  metrics: DataKpiMetric[];
}>();
</script>

<template>
  <!-- 白卡片即栅格子项：双列 stretch 与走势同高；内容顶对齐，底部白底填满 -->
  <section
    class="data-kpi"
    aria-label="关键指标"
  >
    <div class="primary-block">
      <div class="primary-label">{{ primaryLabel }}</div>
      <div class="primary-value">{{ primaryValue }}</div>
    </div>
    <div class="metric-grid">
      <div
        v-for="item in metrics"
        :key="item.label"
        class="metric-cell"
      >
        <div class="metric-value">{{ item.value }}</div>
        <div class="metric-label">{{ item.label }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.data-kpi {
  /* 双列时随栅格 stretch 与走势同高；窄屏叠放时落在 auto 行 → 仍是内容高 */
  align-self: stretch;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 16px;
  margin: 0;
  padding: 20px 12px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background: #fff;
  container-type: inline-size;
  container-name: data-kpi;
}

.primary-block {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.primary-label {
  color: #666;
  font-size: 13px;
}

.primary-value {
  color: var(--color-primary);
  font-size: 44px;
  font-weight: 600;
  line-height: 1.1;
}

.metric-grid {
  display: grid;
  flex: none;
  grid-template-columns: 1fr 1fr;
  gap: 16px 8px;
}

.metric-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

/* 第 5 个指标底栏居中（与观看数据一致） */
.metric-cell:nth-child(5) {
  grid-column: 1 / -1;
}

.metric-value {
  color: #333;
  font-size: 20px;
  font-weight: 600;
}

.metric-label {
  color: #999;
  font-size: 12px;
}

/**
 * 宽卡（中栏纵向堆叠后 KPI 拉满）：副指标横排，label 在上。
 * 只改后代；容器自身 padding/gap 用子元素间距近似（不可自引用 @container）。
 */
@container data-kpi (min-width: 400px) {
  .primary-block {
    padding: 4px 0 0;
  }

  .primary-value {
    font-size: 36px;
  }

  .metric-grid {
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px 4px;
  }

  .metric-cell {
    flex-direction: column-reverse;
    min-width: 0;
  }

  .metric-cell:nth-child(5) {
    grid-column: auto;
  }

  .metric-value {
    font-size: 18px;
  }

  .metric-label {
    text-align: center;
    line-height: 1.3;
  }
}
</style>
