/** 火山 TOS 文件信息 / 预览 URL（实现见 fileInfo.js） */

export function getTosPreviewUrl(url: string, width: number, height: number): string;

export function getTosImageInfo(imageUrl: string): Promise<{
  width: number;
  height: number;
  format: string;
  size: number;
}>;

export function getTosVideoInfo(videoUrl: string): Promise<{
  width: number;
  height: number;
  duration: number;
  size: number;
}>;
