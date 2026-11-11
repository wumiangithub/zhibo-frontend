<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import RiskAssessmentOverlay from "@/components/watch/RiskAssessmentOverlay.vue";
import { useToast } from "@/composables/useToast";
import {
  useViewerOrderFlow,
  watchRoomRoute,
} from "@/composables/useViewerOrderFlow";
import type { RiskAnswerItem } from "@/api/orderCenter";
import { loadViewerOrderCheckoutSession } from "@/utils/viewerOrderCheckoutSession";
import { backOrReplace } from "@/utils/navigation";

const route = useRoute();
const router = useRouter();
const { toast } = useToast();
const { submitRiskAnswers, goToPay } = useViewerOrderFlow();

const activityId = String(route.params.id ?? "").trim();
const ready = ref(false);
const riskSubmitting = ref(false);
const riskSubmitError = ref("");

onMounted(() => {
  const session = loadViewerOrderCheckoutSession(activityId);
  if (!session?.checkoutDetail?.sku) {
    toast("请从直播间重新下单");
    void router.replace(watchRoomRoute(activityId, "live"));
    return;
  }
  ready.value = true;
});

function leaveRisk() {
  const session = loadViewerOrderCheckoutSession(activityId);
  const mode = session?.watchMode ?? "live";
  backOrReplace(router, watchRoomRoute(activityId, mode));
}

async function onRiskAnswersSubmit(answers: RiskAnswerItem[]) {
  if (riskSubmitting.value) return;
  riskSubmitting.value = true;
  riskSubmitError.value = "";
  const result = await submitRiskAnswers(activityId, answers);
  riskSubmitting.value = false;
  if (!result.ok) {
    riskSubmitError.value = result.error;
    return;
  }
  const session = loadViewerOrderCheckoutSession(activityId);
  if (!session) {
    toast("下单信息已失效");
    leaveRisk();
    return;
  }
  goToPay(router, session, result.orderId, {
    riskGrade: result.riskGrade,
    riskGradeName: result.riskGradeName,
  });
}
</script>

<template>
  <RiskAssessmentOverlay
    v-if="ready"
    :open="true"
    :submitting="riskSubmitting"
    :submit-error="riskSubmitError"
    @close="leaveRisk"
    @submit="onRiskAnswersSubmit"
  />
</template>
