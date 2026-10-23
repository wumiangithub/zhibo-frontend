<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  acceptActivityMember,
  getActivity,
  listActivityMembers,
  type ActivityDetail,
} from "@/api/activity";
import UiButton from "@/components/ui/UiButton.vue";
import { useAuthStore } from "@/stores/auth";
import { decodeInviteToken } from "@/utils/inviteToken";
import {
  buildLiveStudioPath,
  HOST_INVITE_TOKEN_QUERY,
} from "@/utils/liveLinks";
import {
  ActivityMemberRole,
  ACTIVITY_MEMBER_ROLE_LABEL,
  isLiveRoomRole,
  type LiveRoomRole,
} from "@/views/live/detail/role/roleTypes";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const activityId = computed(() => String(route.params.activityId ?? "").trim());

/** 只认不透明 `c`，不解析明文 `role` / `inviter`。 */
const invitePayload = computed(() => {
  const rawToken = route.query[HOST_INVITE_TOKEN_QUERY];
  if (typeof rawToken !== "string" || !rawToken.trim()) return null;
  const decoded = decodeInviteToken(rawToken);
  if (!decoded || !isLiveRoomRole(decoded.role)) return null;
  return { role: decoded.role as LiveRoomRole, inviterId: decoded.inviterId };
});

const inviteRole = computed<LiveRoomRole | null>(
  () => invitePayload.value?.role ?? null,
);
const inviterId = computed(() => invitePayload.value?.inviterId ?? null);

/** `c` 缺失或解不出：链接无效 / 被篡改。 */
const inviteTokenInvalid = computed(() => invitePayload.value == null);

const loading = ref(true);
const accepting = ref(false);
const error = ref("");
const detail = ref<ActivityDetail | null>(null);
/** 未加入 / 已加入（含本场已是同角色再次打开） */
const joined = ref(false);
const alreadyMember = ref(false);
const inviterName = ref("");

const roleLabel = computed(() =>
  inviteRole.value == null ? "" : ACTIVITY_MEMBER_ROLE_LABEL[inviteRole.value],
);

const resultText = computed(() => {
  if (!joined.value || !roleLabel.value) return "";
  if (alreadyMember.value) return `你已是本场直播的${roleLabel.value}`;
  return `加入成功，你已成为本场直播的${roleLabel.value}`;
});

/** 主播：立即开播；助理 / 嘉宾：加入直播。都打开第三方主持人/参会页。 */
const actionLabel = computed(() =>
  inviteRole.value === ActivityMemberRole.HOST ? "立即开播" : "加入直播",
);

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

  const userId = auth.user?.id;
  if (userId) {
    try {
      const data = await listActivityMembers(activityId.value);
      const mine = (data.list ?? []).find((row) => row.id === userId);
      if (mine != null && mine.role === inviteRole.value) {
        joined.value = true;
        alreadyMember.value = true;
      }
    } catch {
      // 名单拉失败不挡确认加入；点同意时仍由 accept 接口判定
    }
  }
  loading.value = false;
});

async function onAccept() {
  if (
    accepting.value ||
    joined.value ||
    inviteRole.value == null ||
    inviterId.value == null
  ) {
    return;
  }
  accepting.value = true;
  error.value = "";
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
    accepting.value = false;
  }
}

function onEnterLive() {
  if (!activityId.value || inviteRole.value == null) return;
  void router.push(buildLiveStudioPath(activityId.value, inviteRole.value));
}
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
        加载中…
      </p>
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
          v-else-if="detail && inviteTokenInvalid"
          class="note"
        >
          邀请链接无效或已被篡改，请联系邀约人重新发送。
        </p>

        <div
          v-if="detail && inviteRole != null && inviterId != null && !error"
          class="actions"
        >
          <template v-if="!joined">
            <p class="hint">
              确认后你将以{{ roleLabel }}身份加入本场直播。
            </p>
            <UiButton
              variant="primary"
              :disabled="accepting"
              @click="onAccept"
            >
              {{ accepting ? "加入中…" : "同意邀请" }}
            </UiButton>
          </template>
          <template v-else>
            <UiButton
              variant="primary"
              @click="onEnterLive"
            >
              {{ actionLabel }}
            </UiButton>
          </template>
        </div>
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
.actions {
  margin-top: 20px;
}
.hint {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 22px;
  color: var(--color-text-secondary);
}
</style>
