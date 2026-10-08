import { createApp } from "vue";
import "./styles/reset.css";
import "virtual:uno.css";
import "element-plus/dist/index.css";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import ElementPlus from "element-plus";
import App from "./App.vue";
import router from "./router";

const app = createApp(App);
app.use(router);
app.use(ElementPlus, { locale: zhCn });
app.mount("#app");
