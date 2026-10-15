import { inject, onBeforeUnmount, onMounted, provide, ref, type InjectionKey, type Ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { ElMessageBox } from "element-plus";

/** 子组件显式标记「用户已编辑」；程序化赋值勿调用 */
export const LEAVE_MARK_DIRTY_KEY: InjectionKey<() => void> = Symbol("leaveMarkDirty");

export interface LeaveConfirmApi {
  dirty: Ref<boolean>;
  /** 仅用户交互时调用 */
  markDirty: () => void;
  /** 保存成功 / 重置基线 */
  markClean: () => void;
  /** 保存成功后导航前调用，跳过下一次路由拦截 */
  allowNextNavigation: () => void;
  /** 手动离开（取消按钮 / 切 Tab）时弹窗；返回是否允许离开 */
  confirmLeave: () => Promise<boolean>;
}

export interface LeaveConfirmOptions {
  /**
   * 是否注册 onBeforeRouteLeave。
   * 仅路由组件（RouterView 直接渲染）有效；子组件请设 false，由父级处理路由离开。
   */
  routeLeave?: boolean;
  /** 确认框正文，默认沿用旧文案 */
  message?: string;
  title?: string;
}

/**
 * 有未保存改动时：站内路由离开弹自定义确认；关标签/刷新走浏览器 beforeunload。
 * dirty 仅由 markDirty / markClean / allowNextNavigation 控制，不做表单 deep watch。
 */
export function useLeaveConfirm(options: LeaveConfirmOptions = {}): LeaveConfirmApi {
  const enableRouteLeave = options.routeLeave !== false;
  const message = options.message ?? "此时离开将丢失已编辑的内容";
  const title = options.title ?? "确认离开吗？";
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
      await ElMessageBox.confirm(message, title, {
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

  provide(LEAVE_MARK_DIRTY_KEY, markDirty);

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

  return { dirty, markDirty, markClean, allowNextNavigation, confirmLeave };
}

/** 在表单子组件内调用；无 provide 时为 no-op（便于单测 / 孤立渲染） */
export function useMarkDirty(): () => void {
  return inject(LEAVE_MARK_DIRTY_KEY, () => {});
}
