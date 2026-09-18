import axios, { type AxiosRequestConfig } from "axios";

export interface ApiResult<T> {
  code: number;
  msg: string;
  data: T;
}

export class ApiError extends Error {
  code: number;
  constructor(msg: string, code: number) {
    super(msg);
    this.name = "ApiError";
    this.code = code;
  }
}

const instance = axios.create({
  baseURL: "/api",
  timeout: 15000,
});

instance.interceptors.response.use(
  (resp): any => {
    const body = resp.data as ApiResult<unknown>;
    if (body && body.code === 0) {
      return body.data;
    }
    return Promise.reject(
      new ApiError(body?.msg ?? "请求失败", body?.code ?? -1),
    );
  },
  (err) => Promise.reject(new ApiError(err?.message ?? "网络错误", -1)),
);

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return instance.get(url, config) as unknown as Promise<T>;
}

export async function post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return instance.post(url, data, config) as unknown as Promise<T>;
}

export async function put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return instance.put(url, data, config) as unknown as Promise<T>;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return instance.delete(url, config) as unknown as Promise<T>;
}

export default instance;
