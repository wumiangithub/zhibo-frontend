import { ref } from "vue";

const message = ref("");
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

/** 全局轻提示：未开放菜单、侧栏占位、中控台等共用；单次可传 durationMs，默认 2000 */
export function useToast(defaultDuration = 2000) {
  function toast(msg: string, durationMs = defaultDuration) {
    message.value = msg;
    visible.value = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      visible.value = false;
    }, durationMs);
  }

  return { message, visible, toast };
}
