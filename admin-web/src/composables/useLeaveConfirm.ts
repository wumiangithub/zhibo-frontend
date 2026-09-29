import { onBeforeUnmount, onMounted, ref, watch, type Ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { ElMessageBox } from "element-plus";

export interface LeaveConfirmApi {
  dirty: Ref<boolean>;
  markDirty: () => void;
  markClean: () => void;
  /** 保存成功后导航前调用，跳过下一次路由拦截 */
  allowNextNavigation: () => void;
  /** 手动离开（取消按钮 / 切 Tab）时弹窗；返回是否允许离开 */
  confirmLeave: () => Promise<boolean>;
  /** 对 reactive 表单做快照对比，变更则 dirty */
  trackForm: (form: object) => { takeSnapshot: () => void };
}

export interface LeaveConfirmOptions {
  /**
   * 是否注册 onBeforeRouteLeave。
   * 仅路由组件（RouterView 直接渲染）有效；子组件请设 false，由父级处理路由离开。
   */
  routeLeave?: boolean;
}

/**
 * 有未保存改动时：站内路由离开弹自定义确认；关标签/刷新走浏览器 beforeunload。
 */
export function useLeaveConfirm(options: LeaveConfirmOptions = {}): LeaveConfirmApi {
  const enableRouteLeave = options.routeLeave !== false;
  const dirty = ref(false);
  let bypass = false;

  function markDirty() {
    dirty.value = true;
  }

  function markClean() {
    dirty.value = false;
  }

  function allowNextNavigation() {
    bypass = true;
    dirty.value = false;
  }

  async function confirmLeave(): Promise<boolean> {
    if (!dirty.value) return true;
    try {
      await ElMessageBox.confirm("此时离开将丢失已编辑的内容", "确认离开吗？", {
        type: "info",
        confirmButtonText: "确认离开",
        cancelButtonText: "继续编辑",
        distinguishCancelAndClose: true,
        closeOnClickModal: false,
      });
      return true;
    } catch {
      return false;
    }
  }

  if (enableRouteLeave) {
    onBeforeRouteLeave(async () => {
      if (bypass) {
        bypass = false;
        return true;
      }
      if (!dirty.value) return true;
      return confirmLeave();
    });
  }

  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (!dirty.value) return;
    e.preventDefault();
    e.returnValue = "";
  }

  onMounted(() => {
    window.addEventListener("beforeunload", onBeforeUnload);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("beforeunload", onBeforeUnload);
  });

  function trackForm(form: object) {
    let snapshot = "";
    let ready = false;

    function takeSnapshot() {
      snapshot = JSON.stringify(form);
      markClean();
      ready = true;
    }

    watch(
      () => JSON.stringify(form),
      (v) => {
        if (!ready) return;
        if (v !== snapshot) markDirty();
        else markClean();
      },
    );

    return { takeSnapshot };
  }

  return { dirty, markDirty, markClean, allowNextNavigation, confirmLeave, trackForm };
}
