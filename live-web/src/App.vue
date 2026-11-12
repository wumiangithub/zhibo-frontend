<script setup lang="ts">
import { RouterView } from "vue-router";
import UiToast from "@/components/UiToast.vue";
import ApiTargetSwitch from "@/components/ApiTargetSwitch.vue";
</script>

<template>
  <RouterView />
  <UiToast />
  <ApiTargetSwitch />
</template>
