import { createApp } from "vue";
import "./styles/reset.css";
import "./styles/theme.css";
import "virtual:uno.css";
import "element-plus/dist/index.css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import ElementPlus from "element-plus";
import App from "./App.vue";
import router from "./router";

console.info(`[live-web] build time: ${__APP_BUILD_TIME__}`);

const app = createApp(App);
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
