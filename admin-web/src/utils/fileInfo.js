// 图片类型
const IMAGE_TYPES = [
  'bmp',
  'jpg',
  'jpeg',
  'png',
  'jfif',
  'tif',
  'gif',
  'pcx',
  'tga',
  'exif',
  'fpx',
  'svg',
  'webp',
  'avif',
  'apng',
  'raw',
  'ico',
  'wmf',
  'tiff'
]

// 视频类型
const VIDEO_TYPES = [
  'mp4',
  'mov',
  'avi',
  'mkv',
  'flv',
  'wmv',
  'webm',
  'm4v',
  '3gp',
  'asf',
  'asx',
  'rm',
  'rmvb',
  'mpg',
  'mpeg',
  'mpe',
  'dat',
  'vob',
  'qt'
]

// 音频类型
const AUDIO_TYPES = ['mp3']

// 3D模型类型
const THREE_D_TYPES = ['fbx', 'obj']

// 设计文件类型
const DESIGN_TYPES = ['psd', 'ai', 'aep', 'prproj', 'cdr', 'dxf', 'eps', 'ufo', 'pcd']

// 文档类型
const DOCUMENT_TYPES = ['pdf', 'doc', 'docx']

// 表格类型
const SPREADSHEET_TYPES = ['xls', 'xlsx']

// 压缩包类型
const ARCHIVE_TYPES = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2']
const isDev = import.meta.env.VITE_APP_ENV === 'dev'
/**
 * 从 URL 中提取文件后缀（扩展名）
 * @param {string} url - 文件 URL
 * @returns {string} 文件后缀（小写），如 'jpg'、'mp4' 等，如果无法提取则返回空字符串
 * @example
 * getFileExtension('https://example.com/image.jpg') // 'jpg'
 * getFileExtension('https://example.com/video.mp4?x-tos-process=...') // 'mp4'
 * getFileExtension('https://example.com/file.JPG') // 'jpg'
 */
function getFileExtension(url) {
  if (!url || typeof url !== 'string') return ''

  // 移除查询参数
  const urlWithoutQuery = url.split('?')[0]

  // 提取最后一个点之后的部分作为扩展名
  const lastDotIndex = urlWithoutQuery.lastIndexOf('.')
  if (lastDotIndex === -1) return ''

  const extension = urlWithoutQuery.substring(lastDotIndex + 1).toLowerCase()
  return extension
}

/**
 * 判断是否为视频类型
 * @param {File|string} source - File对象或文件URL
 * @returns {boolean} 是否为视频类型
 */
function isVideo(source) {
  // File对象：通过type或name判断
  if (source instanceof File) {
    return (
      source.type.startsWith('video/') ||
      new RegExp(`\\.(${VIDEO_TYPES.join('|')})$`, 'i').test(source.name)
    )
  }
  // URL字符串：通过后缀判断（兼容带查询参数的情况）
  if (typeof source === 'string') {
    return new RegExp(`\\.(${VIDEO_TYPES.join('|')})(\\?|$)`, 'i').test(source)
  }
  return false
}

/**
 * 判断是否为图片类型
 * @param {File|string} source - File对象或文件URL
 * @returns {boolean} 是否为图片类型
 */
function isImage(source) {
  // File对象：通过type或name判断
  if (source instanceof File) {
    return (
      source.type.startsWith('image/') ||
      new RegExp(`\\.(${IMAGE_TYPES.join('|')})$`, 'i').test(source.name)
    )
  }
  // URL字符串：通过后缀判断（兼容带查询参数的情况）
  if (typeof source === 'string') {
    return new RegExp(`\\.(${IMAGE_TYPES.join('|')})(\\?|$)`, 'i').test(source)
  }
  return false
}

/**
 * 获取火山云TOS视频的 宽度、高度、时长(秒)、文件大小(字节)
 * @param {string} videoUrl - 视频原地址
 * @returns {Promise<{width:number, height:number, duration:number, size:number}>}
 */
async function getTosVideoInfo(videoUrl) {
  if (!isVideo(videoUrl)) {
    return { width: 0, height: 0, duration: 0, size: 0 }
  }

  try {
    // 拼接URL
    const infoUrl = `${videoUrl}${videoUrl.includes('?') ? '&' : '?'}x-tos-process=video/info`

    const proxyUrl = isDev
      ? infoUrl.replace(import.meta.env.VITE_APP_TOS_CDN_URL, '/cdn-media')
      : infoUrl
    const res = await fetch(proxyUrl)
    const data = await res.json()

    // 找到 streams 里的 video 类型（排除音频）
    const videoStream = data.streams?.find((s) => s.codec_type === 'video')

    // 优先从 format 取时长，若不存在则从视频流取
    const duration =
      Math.round(Number(data.format?.duration)) || Math.round(Number(videoStream?.duration)) || 0
    return {
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      duration, // 时长（秒）
      size: parseInt(data.format?.size) || 0 // 文件大小（字节）
    }
  } catch (err) {
    console.error('获取视频信息失败：', err)
    return { width: 0, height: 0, duration: 0, size: 0 }
  }
}

/**
 * 获取视频信息（时长、宽高）
 * @param {File} file - 视频文件对象
 * @returns {Promise<{duration:number, width:number, height:number}>} 视频信息对象
 */
const getVideoInfo = (file) => {
  return new Promise((resolve) => {
    if (!isVideo(file)) {
      resolve({ duration: 0, width: 0, height: 0 })
      return
    }

    const video = document.createElement('video')
    video.preload = 'none'
    video.muted = true
    video.playsInline = true

    const objectUrl = URL.createObjectURL(file)
    let timeoutId

    const cleanup = () => {
      video.onloadedmetadata = null
      video.onerror = null
      video.src = ''
      video.load()
    }

    timeoutId = setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
      cleanup()
      console.warn('获取视频信息超时:', file.name)
      resolve({ duration: 0, width: 0, height: 0 })
    }, 5000)

    video.onloadedmetadata = () => {
      clearTimeout(timeoutId)
      const result = {
        duration: Math.round(video.duration),
        width: video.videoWidth,
        height: video.videoHeight
      }
      URL.revokeObjectURL(objectUrl)
      cleanup()
      resolve(result)
    }

    video.onerror = () => {
      clearTimeout(timeoutId)
      URL.revokeObjectURL(objectUrl)
      cleanup()
      console.warn('无法获取视频信息:', file.name)
      resolve({ duration: 0, width: 0, height: 0 })
    }

    video.src = objectUrl
  })
}

/**
 * 获取图片宽高
 * @param {File} file - 图片文件对象
 * @returns {Promise<{width:number, height:number}>} 图片宽高信息对象
 */
const getImageInfo = (file) => {
  return new Promise((resolve) => {
    if (!isImage(file)) {
      resolve({ width: 0, height: 0 })
      return
    }
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: 0, height: 0 })
    }
    img.src = objectUrl
  })
}

/**
 * 获取火山云TOS图片信息（宽高、格式、大小）
 * 适配你真实返回格式
 * @param {string} imageUrl - 火山云图片地址
 * @returns {Promise<{width: number, height: number, format: string, size: number}>}
 */
async function getTosImageInfo(imageUrl) {
  if (!isImage(imageUrl)) {
    return { width: 0, height: 0, format: '', size: 0 }
  }

  try {
    const infoUrl = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}x-tos-process=image/info`
    const proxyUrl = isDev
      ? infoUrl.replace(import.meta.env.VITE_APP_TOS_CDN_URL, '/cdn-media')
      : infoUrl
    const res = await fetch(proxyUrl)
    const data = await res.json()

    return {
      width: parseInt(data.ImageWidth?.value) || 0,
      height: parseInt(data.ImageHeight?.value) || 0,
      format: data.Format?.value || '',
      size: parseInt(data.FileSize?.value) || 0 // 单位：字节 Byte
    }
  } catch (err) {
    console.error('获取图片信息失败', err)
    return { width: 0, height: 0, format: '', size: 0 }
  }
}

/**
 * 获取视频封面图（截取指定时间点的帧）
 * @param {File} file - 视频文件
 * @param {number} [timeSeconds=1] - 截取的时间点（秒），默认取第1秒；若超过视频时长一半，则取视频中间位置
 * @returns {Promise<Blob|null>} 返回封面图的 Blob 对象，失败返回 null
 */
function getVideoCover(file, timeSeconds = 1) {
  return new Promise((resolve) => {
    if (!isVideo(file)) {
      resolve(null)
      return
    }

    // 文件大小限制：50MB
    const MAX_FILE_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      console.warn('视频文件过大，跳过封面截取:', file.name)
      resolve(null)
      return
    }

    const video = document.createElement('video')
    video.preload = 'none'
    video.muted = true
    video.playsInline = true
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const objectUrl = URL.createObjectURL(file)
    let timeoutId

    const cleanup = () => {
      video.onloadedmetadata = null
      video.onseeked = null
      video.onerror = null
      video.src = ''
      video.load()
      canvas.width = 0
      canvas.height = 0
    }

    timeoutId = setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
      cleanup()
      console.warn('获取视频封面超时:', file.name)
      resolve(null)
    }, 10000)

    video.onloadedmetadata = () => {
      // 如果指定时间超过视频时长，取视频中间位置
      const targetTime = Math.min(timeSeconds, video.duration / 2)
      video.currentTime = targetTime
    }

    video.onseeked = () => {
      clearTimeout(timeoutId)
      URL.revokeObjectURL(objectUrl)

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          cleanup()
          resolve(blob)
        },
        'image/jpeg',
        0.9
      )
    }

    video.onerror = () => {
      clearTimeout(timeoutId)
      URL.revokeObjectURL(objectUrl)
      cleanup()
      console.warn('无法获取视频封面:', file.name)
      resolve(null)
    }

    video.src = objectUrl
    video.load()
  })
}

// 辅助函数：格式化文件大小（供Vue页面渲染时使用，可选）
const formatFileSize = (size) => {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' MB'
  return (size / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

// 获取指定大小图片或视频封面, 保持原比例，限制最大宽高，避免图片变形
const getTosPreviewUrl = (url, width, height) => {
  if (!url) return url

  // 根据 URL 后缀判断是图片还是视频
  const isVideoFile = isVideo(url)
  const isImageFile = isImage(url)

  if (!isVideoFile && !isImageFile) {
    return url
  }

  // 构建新的处理参数
  const processParam = isVideoFile
    ? `x-tos-process=video/snapshot,w_${width},h_${height},t_0,f_jpg`
    : `x-tos-process=image/resize,w_${width},h_${height}`

  // 如果 URL 中已包含 x-tos-process 参数，需要替换它
  if (url.includes('x-tos-process=')) {
    // 使用正则表达式替换已有的 x-tos-process 参数
    return url.replace(/x-tos-process=[^&]*/, processParam)
  }

  // 如果 URL 中没有 x-tos-process 参数，则追加
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${processParam}`
}

export {
  IMAGE_TYPES,
  VIDEO_TYPES,
  AUDIO_TYPES,
  THREE_D_TYPES,
  DESIGN_TYPES,
  DOCUMENT_TYPES,
  SPREADSHEET_TYPES,
  ARCHIVE_TYPES,
  isVideo,
  isImage,
  getFileExtension,
  getVideoInfo,
  getImageInfo,
  getVideoCover,
  formatFileSize,
  getTosVideoInfo,
  getTosImageInfo,
  getTosPreviewUrl
}
