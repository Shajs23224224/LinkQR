import { appConfig } from "./config.js";

const statusElement = document.querySelector("#app-status");

if (statusElement) {
  statusElement.textContent = `${appConfig.appName} Web ${appConfig.appVersion} · inicialización correcta`;
}

document.documentElement.dataset.app = "linkqr";
