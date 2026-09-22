import { ref } from "vue";

const message = ref("");
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

/** 全局轻提示：未开放菜单、侧栏占位等共用 */
export function useToast() {
  function toast(msg: string) {
    message.value = msg;
    visible.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      visible.value = false;
    }, 2000);
  }

  return { message, visible, toast };
}
