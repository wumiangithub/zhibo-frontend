import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import type { UploadRawFile, UploadUserFile } from "element-plus";
import type {
  FileTableItem,
  MaterialRegisterItem,
  UploadItem,
} from "@/views/settings/materials/materialUploadTypes";
import {
  buildMaterialObjectKey,
  formatDuration,
  formatImageMeta,
  resolveMaterialAccessUrl,
  type MaterialObjectKind,
} from "@/views/settings/materials/materialUploadFormat";
import { useMaterialsStore } from "@/stores/materials";
import { handleUpload, type TosUploadResult } from "@/utils/upload";
import { getImageInfo, getVideoInfo } from "@/utils/fileInfo";

function toUploadRawFile(file: File, uid: number): UploadRawFile {
  const raw = file as UploadRawFile;
  raw.uid = uid;
  return raw;
}

async function buildRegisterMeta(
  materialType: MaterialObjectKind,
  file: File,
): Promise<string | undefined> {
  if (materialType === "image") {
    const { width, height } = await getImageInfo(file);
    return formatImageMeta(width, height) || undefined;
  }
  if (materialType === "video") {
    const { duration } = await getVideoInfo(file);
    return duration > 0 ? formatDuration(duration) : undefined;
  }
  return undefined;
}

export function useMaterialUpload() {
  const materialsStore = useMaterialsStore();

  const items = ref<UploadItem[]>([]);
  const uploading = ref(false);
  const abortFlags = reactive<Record<number, boolean>>({});

  const pendingCount = computed(
    () => items.value.filter((i) => i.status === "waiting" || i.status === "error").length,
  );
  const successCount = computed(() => items.value.filter((i) => i.status === "success").length);
  const uploadingCount = computed(() =>
    items.value.filter(
      (i) => i.status === "uploading" || (uploading.value && i.status === "waiting"),
    ).length,
  );
  const showStats = computed(() => items.value.length > 0);
  const canConfirm = computed(() => pendingCount.value > 0 && !uploading.value);

  function revokePreviews(list: UploadItem[]) {
    for (const item of list) {
      if (item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
    }
  }

  function syncItemsFromFileList(files: UploadUserFile[]) {
    const prevByUid = new Map(items.value.map((i) => [i.uid, i]));
    const next: UploadItem[] = [];
    for (const f of files) {
      const raw = f.raw;
      const uid = f.uid;
      if (!raw || uid == null) continue;
      const prev = prevByUid.get(uid);
      if (prev) {
        next.push(prev);
        prevByUid.delete(uid);
        continue;
      }
      next.push({
        uid,
        name: f.name,
        file: raw,
        previewUrl: URL.createObjectURL(raw),
        status: "waiting",
        percent: 0,
        speedBps: 0,
      });
    }
    revokePreviews([...prevByUid.values()]);
    items.value = next;
  }

  function findItem(uid: number) {
    return items.value.find((i) => i.uid === uid);
  }

  function removeItem(item: FileTableItem, fileList: UploadUserFile[]) {
    const full = findItem(item.uid);
    if (!full) return fileList;
    items.value = items.value.filter((i) => i.uid !== full.uid);
    if (full.previewUrl.startsWith("blob:")) URL.revokeObjectURL(full.previewUrl);
    delete abortFlags[full.uid];
    return fileList.filter((f) => f.uid !== full.uid);
  }

  function cancelUpload(item: FileTableItem, fileList: UploadUserFile[]) {
    const full = findItem(item.uid);
    if (!full) return fileList;
    if (full.status === "waiting" || full.status === "error") {
      return removeItem(full, fileList);
    }
    if (full.status === "uploading") {
      abortFlags[full.uid] = true;
    }
    return fileList;
  }

  /** 裁剪后替换当前项（waiting / error → waiting），revoke 旧 blob */
  function replaceItemFile(uid: number, file: File, fileList: UploadUserFile[]) {
    const full = findItem(uid);
    if (!full) return fileList;
    if (full.status === "uploading" || full.status === "success") return fileList;
    if (full.previewUrl.startsWith("blob:")) URL.revokeObjectURL(full.previewUrl);
    const raw = toUploadRawFile(file, uid);
    full.file = file;
    full.name = file.name;
    full.previewUrl = URL.createObjectURL(file);
    full.status = "waiting";
    full.percent = 0;
    full.speedBps = 0;
    delete full.resultUrl;
    delete full.objectKey;
    delete abortFlags[full.uid];
    return fileList.map((f) =>
      f.uid === uid
        ? { ...f, name: file.name, size: file.size, raw, status: "ready" as const }
        : f,
    );
  }

  /** 成功项裁剪：新增一条 waiting，不覆盖已成功项 */
  function addCroppedItem(file: File, fileList: UploadUserFile[]) {
    const maxUid = Math.max(0, ...items.value.map((i) => i.uid), ...fileList.map((f) => f.uid ?? 0));
    const uid = maxUid + 1;
    const raw = toUploadRawFile(file, uid);
    const previewUrl = URL.createObjectURL(file);
    items.value = [
      ...items.value,
      {
        uid,
        name: file.name,
        file,
        previewUrl,
        status: "waiting",
        percent: 0,
        speedBps: 0,
      },
    ];
    return [
      ...fileList,
      {
        uid,
        name: file.name,
        size: file.size,
        raw,
        status: "ready" as const,
      },
    ];
  }

  function resetSession() {
    revokePreviews(items.value);
    items.value = [];
    uploading.value = false;
    for (const k of Object.keys(abortFlags)) delete abortFlags[Number(k)];
  }

  async function ensureStsOnOpen() {
    try {
      await materialsStore.ensureTosConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "获取上传凭证失败";
      ElMessage.error(msg);
    }
  }

  async function startUpload(materialType: MaterialObjectKind): Promise<{
    files: File[];
    results: Array<TosUploadResult | null>;
    registerItems: MaterialRegisterItem[];
  } | null> {
    if (!canConfirm.value) return null;
    const targets = items.value.filter((i) => i.status === "waiting" || i.status === "error");
    if (!targets.length) {
      ElMessage.warning("请先选择文件");
      return null;
    }

    uploading.value = true;
    const results: Array<TosUploadResult | null> = [];
    const registerItems: MaterialRegisterItem[] = [];
    try {
      const tosConfig = await materialsStore.ensureTosConfig();
      for (const item of targets) {
        if (abortFlags[item.uid]) {
          item.status = "cancelled";
          results.push({ cancelled: true });
          continue;
        }
        if (!items.value.some((i) => i.uid === item.uid)) continue;

        item.status = "uploading";
        item.percent = 0;
        item.speedBps = 0;
        let lastLoaded = 0;
        let lastAt = Date.now();

        const key = buildMaterialObjectKey(materialType, item.file.name);
        item.objectKey = key;
        const res = await handleUpload({
          ...tosConfig,
          name: key,
          file: item.file,
          fileSize: item.file.size,
          shouldCancel: () => !!abortFlags[item.uid],
          onProgress: (percent, loadedBytes) => {
            item.percent = percent;
            if (typeof loadedBytes === "number") {
              const now = Date.now();
              const dt = (now - lastAt) / 1000;
              if (dt >= 0.2) {
                const delta = loadedBytes - lastLoaded;
                if (delta > 0) item.speedBps = delta / dt;
                lastLoaded = loadedBytes;
                lastAt = now;
              }
            }
          },
        });

        results.push(res);
        if (res?.cancelled || abortFlags[item.uid]) {
          item.status = "cancelled";
          item.speedBps = 0;
          delete abortFlags[item.uid];
        } else if (res && !res.cancelled) {
          item.status = "success";
          item.percent = 100;
          item.speedBps = 0;
          const url = resolveMaterialAccessUrl(
            typeof res.Location === "string" ? res.Location : undefined,
            key,
          );
          item.resultUrl = url;
          const meta = await buildRegisterMeta(materialType, item.file);
          registerItems.push({
            name: item.file.name,
            url,
            objectKey: key,
            fileSize: item.file.size,
            mimeType: item.file.type || undefined,
            meta,
          });
        } else {
          item.status = "error";
          item.speedBps = 0;
        }
      }

      const ok = registerItems.length;
      const cancelled = results.filter((r) => r?.cancelled).length;
      const fail = results.length - ok - cancelled;
      if (fail === 0 && cancelled === 0 && ok > 0) {
        ElMessage.success(`上传成功 ${ok} 个`);
      } else if (results.length) {
        ElMessage.warning(
          `上传完成：成功 ${ok}${cancelled ? `，取消 ${cancelled}` : ""}${fail ? `，失败 ${fail}` : ""}`,
        );
      }

      return {
        files: targets.map((t) => t.file),
        results,
        registerItems,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      ElMessage.error(msg);
      return null;
    } finally {
      uploading.value = false;
    }
  }

  onBeforeUnmount(() => {
    revokePreviews(items.value);
  });

  return {
    items,
    uploading,
    pendingCount,
    successCount,
    uploadingCount,
    showStats,
    canConfirm,
    syncItemsFromFileList,
    removeItem,
    cancelUpload,
    replaceItemFile,
    addCroppedItem,
    resetSession,
    ensureStsOnOpen,
    startUpload,
  };
}
