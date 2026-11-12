<script setup lang="ts">
import { RouterView } from "vue-router";
import ApiTargetSwitch from "@/components/ApiTargetSwitch.vue";
</script>

<template>
  <RouterView />
  <ApiTargetSwitch />
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  overflow: hidden;
}

a {
  text-decoration: none;
}
</style>
