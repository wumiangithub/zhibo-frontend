/// <reference types="vite/client" />

interface VhallSdkOptions {
  app_key: string;
  signedat: string;
  webinar_id: string | number;
  email: string;
  username: string;
  sign: string;
  sign_type?: number;
  videoContent: string;
  docContent: string;
}

interface VhallSdkInstance {
  $on(event: string, handler: (data: unknown) => void): void;
  destroy?(): void;
}

interface VhallSdkConstructor {
  new (options: VhallSdkOptions): VhallSdkInstance;
}

interface Window {
  VhallSDK?: VhallSdkConstructor;
}
