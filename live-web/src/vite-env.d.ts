/// <reference types="vite/client" />

interface VhallSdkInitOptions {
  account: string;
  email: string;
  username: string;
  roomid: string;
  app_key: string;
  signedat: string;
  sign: string;
  videoContent: string;
}

interface VhallSdk {
  init(options: VhallSdkInitOptions): void;
  destroy?(): void;
}

interface Window {
  VHALL_SDK?: VhallSdk;
}
