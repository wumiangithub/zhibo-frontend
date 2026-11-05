<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getViewerUserInfo, type ViewerAuthUser } from "@/api/viewerAuth";
import AudienceFrame from "@/components/audience/AudienceFrame.vue";
import AudienceTabBar from "@/components/audience/AudienceTabBar.vue";
import {
  clearViewerProfile,
  clearViewerSession,
  getViewerPhoneMasked,
  getViewerProfile,
  saveViewerProfile,
  saveViewerSession,
} from "@/utils/viewerAuth";
import {
  isViewerLoginRequiredError,
  recoverViewerAuth,
} from "@/utils/viewerLogin";

const HOTLINE = "4006-822-833";
const HOTLINE_TEL = "tel:4006822833";

const router = useRouter();

const nickname = ref("");
const phoneMasked = ref("");
const avatarUrl = ref("");
const avatarBroken = ref(false);
const logoutOpen = ref(false);

const displayName = computed(
  () => nickname.value || phoneMasked.value || "微信用户",
);
const phoneText = computed(() => phoneMasked.value || "未绑");

function fillFromCache() {
  const phone = getViewerPhoneMasked();
  const profile = getViewerProfile();
  nickname.value = profile.nickname;
  phoneMasked.value = phone;
  avatarUrl.value = profile.avatarUrl;
  avatarBroken.value = false;
}

function applyUser(user: ViewerAuthUser) {
  saveViewerSession({ user });
  saveViewerProfile({
    nickname: typeof user.nickname === "string" ? user.nickname : undefined,
    avatarUrl: user.avatarUrl,
  });
  const phone = user.phoneMasked?.trim() || getViewerPhoneMasked();
  nickname.value = user.nickname?.trim() || "";
  phoneMasked.value = phone;
  avatarUrl.value = user.avatarUrl?.trim() || getViewerProfile().avatarUrl;
  avatarBroken.value = false;
}

async function loadMe() {
  fillFromCache();
  try {
    applyUser(await getViewerUserInfo());
  } catch (e) {
    if (!isViewerLoginRequiredError(e)) return;
    const outcome = await recoverViewerAuth("/mine");
    if (outcome !== "refreshed") return;
    try {
      applyUser(await getViewerUserInfo());
    } catch {
      fillFromCache();
    }
  }
}

function onHotline() {
  window.location.href = HOTLINE_TEL;
}

function confirmLogout() {
  logoutOpen.value = false;
  clearViewerSession();
  clearViewerProfile();
  void router.replace({ name: "viewer-login" });
}

onMounted(() => {
  void loadMe();
});
</script>

<template>
  <AudienceFrame>
    <div class="page">
      <div class="scroll">
        <button
          type="button"
          class="profile"
          @click="router.push({ name: 'profile' })"
        >
          <span class="avatar">
            <img
              v-if="avatarUrl && !avatarBroken"
              :src="avatarUrl"
              alt=""
              @error="avatarBroken = true"
            >
            <img
              v-else
              src="/audience/avatar-default.png"
              alt=""
            >
          </span>
          <span class="profile-main">
            <span class="name">{{ displayName }}</span>
            <span class="sub">
              个人信息
              <img
                class="chev"
                src="/audience/icon-arrow-right.png"
                alt=""
              >
            </span>
          </span>
        </button>

        <button
          type="button"
          class="orders"
          @click="router.push({ name: 'orders' })"
        >
          <span>全部订单</span>
          <img
            src="/audience/icon-order.png"
            alt=""
          >
        </button>

        <div class="menu">
          <button
            type="button"
            class="row"
            @click="router.push({ name: 'learning' })"
          >
            <span>我的学习</span>
            <img
              class="chev"
              src="/audience/icon-arrow-right.png"
              alt=""
            >
          </button>
          <button
            type="button"
            class="row"
            @click="router.push({ name: 'bind-phone' })"
          >
            <span>绑定手机号</span>
            <span class="right">
              <span class="value">{{ phoneText }}</span>
              <img
                class="chev"
                src="/audience/icon-arrow-right.png"
                alt=""
              >
            </span>
          </button>
          <button
            type="button"
            class="row"
            @click="router.push({ name: 'agreement-list' })"
          >
            <span>服务协议</span>
            <img
              class="chev"
              src="/audience/icon-arrow-right.png"
              alt=""
            >
          </button>
          <button
            type="button"
            class="row"
            @click="router.push({ name: 'feedback' })"
          >
            <span>意见反馈</span>
            <img
              class="chev"
              src="/audience/icon-arrow-right.png"
              alt=""
            >
          </button>
          <button
            type="button"
            class="row last"
            @click="onHotline"
          >
            <span>客服热线</span>
            <span class="hotline">{{ HOTLINE }}</span>
          </button>
        </div>

        <button
          type="button"
          class="logout"
          @click="logoutOpen = true"
        >
          退出登录
        </button>
      </div>
      <AudienceTabBar active="mine" />

      <div
        v-if="logoutOpen"
        class="mask"
        @click.self="logoutOpen = false"
      >
        <div
          class="dialog"
          role="dialog"
          aria-labelledby="logout-title"
        >
          <p
            id="logout-title"
            class="dialog-title"
          >
            提示
          </p>
          <p class="dialog-body">
            确定退出登录吗？
          </p>
          <div class="dialog-actions">
            <button
              type="button"
              @click="logoutOpen = false"
            >
              取消
            </button>
            <button
              type="button"
              class="danger"
              @click="confirmLogout"
            >
              退出
            </button>
          </div>
        </div>
      </div>
    </div>
  </AudienceFrame>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  position: relative;
}
.scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-bottom: 24px;
}
.profile {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 24px 20px 28px;
  border: 0;
  text-align: left;
  cursor: pointer;
  background: linear-gradient(180deg, #dcebff 0%, #eaf4ff 55%, #f5f5f5 100%);
}
.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #cfe3ff;
  color: #ffffff;
  margin-right: 14px;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 20px;
  font-weight: 700;
  color: #111111;
  line-height: 28px;
  margin-bottom: 4px;
}
.sub {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: #8c8c8c;
  line-height: 18px;
}
.chev {
  width: 14px;
  height: 14px;
  margin-left: 4px;
  object-fit: contain;
  flex-shrink: 0;
}
.orders {
  margin: 0 12px 12px;
  height: 48px;
  padding: 0 16px;
  width: calc(100% - 24px);
  border: 0;
  border-radius: 8px;
  background: #dcebff;
  color: #1677ff;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.orders img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.menu {
  margin: 0 12px;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
}
.row {
  width: 100%;
  min-height: 50px;
  padding: 0 16px;
  border: 0;
  border-bottom: 1px solid #f0f0f0;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  color: #111111;
  cursor: pointer;
}
.row.last {
  border-bottom: 0;
}
.right {
  display: flex;
  align-items: center;
}
.value,
.hotline {
  font-size: 14px;
  color: #8c8c8c;
}
.hotline {
  color: #595959;
}
.logout {
  display: block;
  width: calc(100% - 24px);
  margin: 24px 12px 0;
  height: 48px;
  border: 0;
  border-radius: 8px;
  background: #ffffff;
  color: #ff4d4f;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}
.mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}
.dialog {
  width: 270px;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
}
.dialog-title {
  margin: 18px 16px 0;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  color: #111111;
}
.dialog-body {
  margin: 8px 16px 18px;
  text-align: center;
  font-size: 15px;
  color: #595959;
}
.dialog-actions {
  display: flex;
  border-top: 1px solid #f0f0f0;
}
.dialog-actions button {
  flex: 1;
  height: 44px;
  border: 0;
  background: #ffffff;
  font-size: 16px;
  color: #111111;
  cursor: pointer;
}
.dialog-actions button + button {
  border-left: 1px solid #f0f0f0;
}
.dialog-actions .danger {
  color: #ff4d4f;
}
</style>
