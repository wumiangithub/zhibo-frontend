// import StreamSaver from 'streamsaver'

// StreamSaver MITM 配置（用于跨域文件流式下载）
// StreamSaver.mitm = '/ai-gtm-web/mitm.html'
import {
  IMAGE_TYPES,
  VIDEO_TYPES,
  AUDIO_TYPES,
  THREE_D_TYPES,
  DESIGN_TYPES,
  DOCUMENT_TYPES,
  SPREADSHEET_TYPES,
  ARCHIVE_TYPES
} from './fileInfo'
// 支持通过 fetch 下载的文件类型列表（合并所有类型）
const typeList = [
  ...IMAGE_TYPES,
  ...VIDEO_TYPES,
  ...AUDIO_TYPES,
  ...THREE_D_TYPES,
  ...DESIGN_TYPES,
  ...DOCUMENT_TYPES,
  ...SPREADSHEET_TYPES,
  ...ARCHIVE_TYPES
]

const BATCH_SIZE = 5
const isDev = import.meta.env.VITE_APP_ENV === 'dev'

/**
 * 批量下载文件（支持分批递归下载）
 * @param {Array} fileList - 文件列表 [{fileUrl, fileName}]
 * @param {Object} options - 下载选项
 * @param {number} [options.startIndex=0] - 当前批次起始索引
 * @param {boolean} [options.useStream=false] - 是否使用流式下载
 * @param {boolean} [options.useLink=false] - 是否使用 a 标签下载
 * @returns {Promise<{success: boolean, successCount: number, failedFiles: Array}>}
 */
export async function downloadFiles(fileList, options = {}) {
  const { startIndex = 0, useStream = false, useLink = false } = options
  const totalFiles = fileList.length

  if (startIndex >= totalFiles) {
    return { success: true, successCount: 0, failedFiles: [] }
  }

  const endIndex = Math.min(startIndex + BATCH_SIZE, totalFiles)
  const batch = fileList.slice(startIndex, endIndex)

  // console.log(`downloadFiles: 正在下载第 ${startIndex + 1}-${endIndex} 个文件，共 ${totalFiles} 个`)

  // 下载当前批次
  const batchResult = await downloadBatch(batch, { useStream, useLink })

  if (!batchResult.success) {
    // 当前批次有失败，停止递归，返回失败结果
    return {
      success: false,
      successCount: batchResult.successCount,
      failedFiles: batchResult.failedFiles
    }
  }

  // 当前批次全部成功，递归下载下一批
  const nextResult = await downloadFiles(fileList, { startIndex: endIndex, useStream, useLink })

  return {
    success: nextResult.success,
    successCount: batchResult.successCount + (nextResult.success ? nextResult.successCount : 0),
    failedFiles: nextResult.failedFiles
  }
}

/**
 * 下载单批文件
 * @param {Array} batch - 单批文件列表
 * @param {boolean} useStream - 是否使用流式下载
 * @param {boolean} useLink - 是否使用 a 标签下载
 * @returns {Promise<{success: boolean, successCount: number, failedFiles: Array}>}
 */
async function downloadBatch(batch, { useStream = false, useLink = false }) {
  const results = {
    success: true,
    successCount: 0,
    failedFiles: []
  }

  for (let index = 0; index < batch.length; index++) {
    const item = batch[index]
    // console.log('downloadFiles=item===>', item)
    const fileArr = item.fileUrl.split('.')
    const type = fileArr[fileArr.length - 1].toLowerCase()

    try {
      if (useLink) {
        await downloadByLink(item, type)
      } else if (typeList.includes(type)) {
        await downloadByFetch(item, type)
        // if (useStream) {
        //   await downloadByStream(item, type)
        // } else {
        //   await downloadByFetch(item, type)
        // }
      } else {
        await downloadByLink(item, type)
      }
      results.successCount++
    } catch (error) {
      console.error('下载失败：', item.fileName, error)
      results.success = false
      results.failedFiles.push(item.fileName)
    }
  }

  return results
}

/**
 * 通过 a 标签下载文件  浏览器处理，不占内存
 * 普通文件 不能修改文件名
 * 适合直接从后端下载，后端会把文件名改好
 * downloadByLink 的行为取决于服务器返回的 Content-Disposition 头：attachment、inline 或 无
 */
function downloadByLink(item, type) {
  return new Promise((resolve, reject) => {
    const a = document.createElement('a')
    const hasExtension = /\.[^/.]+$/.test(item.fileName)
    a.download = hasExtension ? item.fileName : `${item.fileName}.${type}`
    a.style = 'display: none'
    a.href = item.fileUrl.replace(
      import.meta.env.VITE_APP_TOS_CDN_URL,
      import.meta.env.VITE_APP_TOS_NATIVE_URL
    )
    // 清理函数
    const cleanup = () => {
      if (a.parentNode) {
        document.body.removeChild(a)
      }
    }

    try {
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        cleanup()
        resolve()
      }, 1000)
    } catch (error) {
      console.error('downloadByLink下载失败：', error)
      cleanup()
      reject(error)
    }
  })
}

/**
 * response.blob  小文件、需处理文件名 大文件内存占用大
 * */
function downloadByFetch(item, type) {
  return new Promise((resolve, reject) => {
    let link = null
    let objectUrl = null

    // 清理函数
    const cleanup = () => {
      if (link && link.parentNode) {
        document.body.removeChild(link)
      }
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl)
      }
    }
    const proxyUrl = isDev
      ? item.fileUrl.replace(import.meta.env.VITE_APP_TOS_CDN_URL, '/cdn-media')
      : item.fileUrl
    fetch(`${proxyUrl}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        return response.blob()
      })
      .then((blob) => {
        // 创建一个虚拟的链接元素，模拟点击下载
        link = document.createElement('a')
        objectUrl = window.URL.createObjectURL(blob)
        link.href = objectUrl
        // 如果 fileName 已经包含后缀，则不再拼接 type
        const hasExtension = /\.[^/.]+$/.test(item.fileName)
        link.download = hasExtension ? item.fileName : `${item.fileName}.${type}`
        document.body.appendChild(link)
        link.click()
        // 延迟清理和 resolve
        setTimeout(() => {
          cleanup()
          resolve()
        }, 100)
      })
      .catch((error) => {
        console.error('downloadByFetch下载失败：', error)
        cleanup()
        reject(error)
      })
  })
}

/**
 * 通过 StreamSaver 下载单个文件（流式下载，适合大文件，不占内存）
 * 注意：StreamSaver 会打开弹窗，请确保浏览器未拦截弹窗
 * @param {Object} item - 文件对象 {fileUrl, fileName}
 * @param {string} type - 文件类型
 * @param {number} [timeout=10000] - 超时时间（毫秒），超时后降级到 fetch 方式
 * @returns {Promise<void>}
 */
// function downloadByStream(item, type, timeout = 10000) {
//   return new Promise((resolve, reject) => {
//     let writer = null
//     let reader = null
//     let resolved = false
//     let timeoutId = null

//     // 清理函数：释放 writer 和 reader 资源
//     const cleanup = () => {
//       if (timeoutId) {
//         clearTimeout(timeoutId)
//       }
//       if (reader) {
//         reader.cancel().catch(() => {}) // 忽略取消错误
//       }
//       if (writer) {
//         writer.abort().catch(() => {}) // 中止写入流
//       }
//     }

//     // 设置超时，防止 StreamSaver 静默失败（如弹窗被拦截）
//     timeoutId = setTimeout(() => {
//       if (!resolved) {
//         console.warn('StreamSaver 超时，可能是弹窗被拦截，降级到 downloadByFetch')
//         cleanup()
//         downloadByFetch(item, type).then(resolve).catch(reject)
//       }
//     }, timeout)

//     fetch(item.fileUrl)
//       .then((response) => {
//         if (!response.ok) {
//           throw new Error(`HTTP ${response.status}: ${response.statusText}`)
//         }
//         // 如果 fileName 已经包含后缀，则不再拼接 type
//         const hasExtension = /\.[^/.]+$/.test(item.fileName)
//         const fileName = hasExtension ? item.fileName : `${item.fileName}.${type}`

//         const fileStream = StreamSaver.createWriteStream(fileName, {
//           size: response.headers.get('content-length')
//         })

//         const readableStream = response.body

//         // 优先使用现代 Stream API
//         if (window.WritableStream && readableStream.pipeTo) {
//           return readableStream
//             .pipeTo(fileStream)
//             .then(() => {
//               resolved = true
//               clearTimeout(timeoutId)
//               resolve()
//             })
//             .catch((error) => {
//               // 如果 pipeTo 失败，可能是弹窗被拦截
//               console.warn('StreamSaver pipeTo 失败，尝试降级下载:', error)
//               throw error
//             })
//         }

//         // 降级处理
//         writer = fileStream.getWriter()
//         reader = response.body.getReader()

//         const pump = () =>
//           reader
//             .read()
//             .then((res) => {
//               if (res.done) {
//                 writer.close()
//                 resolved = true
//                 clearTimeout(timeoutId)
//                 resolve()
//               } else {
//                 writer.write(res.value).then(pump)
//               }
//             })
//             .catch((error) => {
//               cleanup()
//               reject(error)
//             })

//         pump()
//       })
//       .catch((error) => {
//         console.error('流式下载失败：', error)
//         cleanup()
//         // 如果 StreamSaver 失败，降级到 fetch 方式
//         if (!resolved) {
//           console.log('降级使用 downloadByFetch...')
//           downloadByFetch(item, type).then(resolve).catch(reject)
//         } else {
//           reject(error)
//         }
//       })
//   })
// }
