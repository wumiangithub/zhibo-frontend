import { onBeforeUnmount, ref } from "vue";

/** 预告态开播倒计时：到点显示「即将开播」并自停 */
export function useCountdown() {
  const countdown = ref("");
  let timer: ReturnType<typeof setInterval> | null = null;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start(startTime: string) {
    stop();
    const target = new Date(startTime.replace(" ", "T")).getTime();

    function update() {
      const diff = target - Date.now();
      if (diff <= 0) {
        countdown.value = "即将开播";
        stop();
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      if (hours > 0) {
        countdown.value = `${hours}时${minutes}分${seconds}秒`;
      } else if (minutes > 0) {
        countdown.value = `${minutes}分${seconds}秒`;
      } else {
        countdown.value = `${seconds}秒`;
      }
    }

    update();
    timer = setInterval(update, 1000);
  }

  onBeforeUnmount(stop);

  return { countdown, start, stop };
}
