// 引入火山TOS SDK（若项目已在index.html引入，无需重复引入）
const isDev = import.meta.env.VITE_APP_ENV === 'dev'
let TosSDK = null

async function loadTosSDK() {
  if (TosSDK) return TosSDK
  if (window.TOS) {
    TosSDK = window.TOS
    return TosSDK
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/tos.umd.production.min.js'
    script.onload = () => {
      TosSDK = window.TOS
      resolve(TosSDK)
    }
    script.onerror = () => reject(new Error('Failed to load TOS SDK'))
    document.head.appendChild(script)
  })
}

/**
 * 单个文件分片上传（保留你项目原有逻辑，新增进度回调，无UI）
 * @param {Object} params - 上传参数
 * @param {string} params.region - 火山TOS区域
 * @param {string} params.endpoint - 火山TOS区域端点
 * @param {string} params.accessKeyId - 后端返回的临时AK
 * @param {string} params.secretAccessKey - 后端返回的临时SK
 * @param {string} params.sessionToken - 后端返回的STS Token
 * @param {string} params.bucketName - 火山TOS Bucket名称
 * @param {string} params.name - 云端文件路径及名称
 * @param {File} params.file - 待上传文件对象
 * @param {number} params.fileSize - 文件大小（单位：B）
 * @param {Function} [params.onProgress] - 进度回调函数，参数为当前进度百分比（0-100）
 * @returns {Promise<Object|null>} 上传成功返回文件信息，失败/取消返回null
 */
export const handleUpload = async ({
  region,
  endpoint,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  bucketName,
  name,
  file,
  fileSize,
  onProgress
}) => {
  const TOS = await loadTosSDK()
  let uploadId = null
  // prettier-ignore
  // eslint-disable-next-line
  let proxy = isDev ? {
    proxy: {
      url: '/tos',
      needProxyParams: false
    }
  } : {}
  const client = new TOS({
    ...proxy,
    region: region,
    endpoint: endpoint,
    accessKeyId: accessKeyId,
    accessKeySecret: secretAccessKey,
    stsToken: sessionToken,
    bucket: bucketName
  })
  try {
    const {
      data: { UploadId }
    } = await client.createMultipartUpload({
      key: name
    })
    uploadId = UploadId
    // 每个 Part 的大小是 4M（和你项目一致）
    const PART_SIZE = 4 * 1024 * 1024
    const uploadPartRes = []
    const totalParts = Math.ceil(file.size / PART_SIZE) // 总分片数，用于计算进度
    // 串行上传每个 Part（和你项目一致）
    for (let i = 0; i * PART_SIZE < file.size; ++i) {
      const { data } = await client.uploadPart({
        key: name,
        partNumber: i + 1,
        body: file.slice(i * PART_SIZE, Math.min((i + 1) * PART_SIZE, file.size)),
        uploadId: UploadId
      })
      uploadPartRes[i] = data.ETag

      // 新增：计算单个文件当前进度，触发回调（供Vue页面接收，渲染进度条）
      const currentProgress = (i + 1) / totalParts // 当前分片占比
      onProgress?.(Math.round(currentProgress * 100)) // 转成百分比，回调给Vue页面
    }
    let resp = await client.completeMultipartUpload({
      key: name,
      parts: uploadPartRes.map((eTag, idx) => ({
        eTag,
        partNumber: idx + 1
      })),
      uploadId: UploadId
    })
    // console.log('单个文件上传结果', resp)
    if (resp.data.Location) {
      resp.data.fileSize = fileSize
      return resp.data // 上传成功，返回文件信息（Location、fileSize等）
    }
    return null // 上传无结果，返回null
  } catch (error) {
    console.log('单个文件上传失败', error)
    if (uploadId) {
      // 出错后取消分片，避免产生垃圾文件（和你项目一致）
      try {
        await client.abortMultipartUpload({
          key: name,
          uploadId
        })
      } catch (abortError) {
        console.log('取消分片上传失败', abortError)
      }
    }
    return null // 上传失败，返回null
  }
}

/**
 * 批量上传文件（纯函数，无UI，串行上传，稳定不报错）
 * @param {FileList|Array<File>} files - 待上传文件列表（可直接接收input的files对象）
 * @param {Object} tosConfig - 火山TOS配置参数（region、endpoint等）
 * @param {Function} [onFileProgress] - 单个文件进度回调，参数：(fileName, percent)
 * @param {Function} [onBatchProgress] - 批量总进度回调，参数：(percent, completedCount, totalCount)
 * @returns {Promise<Array<Object|null>>} 上传结果列表，与文件顺序一致，成功返回文件信息，失败返回null
 * @example  const resultList = await batchHandleUpload(files, tosConfig, onFileProgress, onBatchProgress)
 */
export const batchHandleUpload = async (files, tosConfig, onFileProgress, onBatchProgress) => {
  const results = []
  const fileList = Array.from(files) // 统一转为数组，兼容FileList对象
  const totalFileCount = fileList.length // 总文件数
  let completedCount = 0 // 已完成文件数
  let totalUploadedSize = 0 // 已上传总大小
  const totalFileSize = fileList.reduce((sum, file) => sum + file.size, 0) // 所有文件总大小

  // 遍历所有文件，逐个串行上传（稳定，避免浏览器并发限制）
  for (const file of fileList) {
    const fileName = `upload/${Date.now()}_${file.name}` // 云端文件名（和你项目一致）
    const res = await handleUpload({
      ...tosConfig,
      name: fileName,
      file: file,
      fileSize: file.size,
      // 单个文件进度回调，传递给外层，供Vue页面渲染单个文件进度
      onProgress: (percent) => {
        onFileProgress?.(file.name, percent)
      }
    })

    results.push(res)
    completedCount++
    // 累加已上传大小（仅统计成功上传的文件）
    if (res) {
      totalUploadedSize += file.size
    }

    // 计算批量总进度，触发总进度回调，供Vue页面渲染批量进度
    const batchPercent =
      totalFileSize > 0
        ? Math.round((totalUploadedSize / totalFileSize) * 100)
        : Math.round((completedCount / totalFileCount) * 100)
    onBatchProgress?.(batchPercent, completedCount, totalFileCount)
  }

  return results // 返回所有文件上传结果，与文件顺序一一对应
}
