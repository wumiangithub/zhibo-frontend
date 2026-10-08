import { ref } from "vue";

const message = ref("");
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

/** 全局轻提示，无第三方 UI 库 */
export function useToast(duration = 2000) {
  function toast(msg: string) {
    message.value = msg;
    visible.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      visible.value = false;
    }, duration);
  }

  return { message, visible, toast };
}
