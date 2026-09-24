import { createApp } from "vue";
import { createPinia } from "pinia";
import "virtual:uno.css";
/** 全量引入 Element Plus 样式；主题色用 theme.css 里的官方 CSS 变量覆盖，勿再按需重复引入样式 */
import "element-plus/dist/index.css";
import "@/styles/theme.css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import ElementPlus from "element-plus";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
