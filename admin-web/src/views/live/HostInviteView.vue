<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  acceptActivityMember,
  getActivity,
  type ActivityDetail,
} from "@/api/activity";
import {
  ACTIVITY_MEMBER_ROLE_LABEL,
  isLiveRoomRole,
  type LiveRoomRole,
} from "@/views/live/detail/role/roleTypes";

const route = useRoute();
const activityId = computed(() => String(route.params.activityId ?? "").trim());
const inviteRole = computed<LiveRoomRole | null>(() => {
  const raw = Number(route.query.role);
  return isLiveRoomRole(raw) ? raw : null;
});
const inviterId = computed(() => {
  const raw = Number(route.query.inviter);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
});

const loading = ref(true);
const error = ref("");
const detail = ref<ActivityDetail | null>(null);
const joined = ref(false);
const alreadyMember = ref(false);
const inviterName = ref("");

const roleLabel = computed(() =>
  inviteRole.value == null ? "" : ACTIVITY_MEMBER_ROLE_LABEL[inviteRole.value],
);

const resultText = computed(() => {
  if (!joined.value || !roleLabel.value) return "";
  if (alreadyMember.value) return `你已是本场直播的${roleLabel.value}`;
  return `你已加入本场直播的${roleLabel.value}`;
});

onMounted(async () => {
  if (!activityId.value) {
    error.value = "邀请链接无效";
    loading.value = false;
    return;
  }
  try {
    detail.value = await getActivity(activityId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载直播失败";
    loading.value = false;
    return;
  }
  if (inviteRole.value == null || inviterId.value == null) {
    loading.value = false;
    return;
  }
  try {
    const result = await acceptActivityMember(activityId.value, {
      role: inviteRole.value,
      inviterId: inviterId.value,
    });
    joined.value = true;
    alreadyMember.value = result.alreadyMember;
    inviterName.value = result.inviterName?.trim() ?? "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加入开播角色失败";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="host-invite">
    <div class="card">
      <p class="brand">钱坤云直播平台</p>
      <h1 class="title">{{ roleLabel ? `${roleLabel}邀请` : "直播邀请" }}</h1>
      <p
        v-if="loading"
        class="status"
      >
        加载中…      </p>
      <template v-else>
        <p
          v-if="detail"
          class="line"
        >
          <span class="label">直播名称：</span>{{ detail.title || "暂无" }}
        </p>
        <p
          v-if="detail"
          class="line"
        >
          <span class="label">直播时间：</span>{{ detail.startTime || "暂无" }}
        </p>
        <p
          v-if="inviterName"
          class="line"
        >
          <span class="label">邀约人：</span>{{ inviterName }}
        </p>
        <p
          v-if="resultText"
          class="result"
        >
          {{ resultText }}
        </p>
        <p
          v-if="error"
          class="status is-error"
        >
          {{ error }}
        </p>
        <p
          v-else-if="detail && inviteRole == null"
          class="note"
        >
          这条链接没有带开播角色，打开后不会加入名单。        </p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.host-invite {
  box-sizing: border-box;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--color-bg-page);
}
.card {
  box-sizing: border-box;
  width: min(480px, 100%);
  padding: 28px 28px 24px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}
.brand {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--color-text-secondary);
}
.title {
  margin: 8px 0 20px;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  color: var(--color-text);
}
.line {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 22px;
  color: var(--color-text);
}
.label {
  color: var(--color-text-secondary);
}
.status {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--color-text-secondary);
}
.status.is-error {
  margin-top: 12px;
  color: var(--color-danger);
}
.result {
  margin: 16px 0 0;
  font-size: 14px;
  line-height: 22px;
  color: var(--color-success);
}
.note {
  margin: 16px 0 0;
  font-size: 13px;
  line-height: 22px;
  color: var(--color-text-placeholder);
}
</style>
