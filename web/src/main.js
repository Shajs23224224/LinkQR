import { appConfig } from "./config.js";

const statusElement = document.querySelector("#demo-feedback");
const primaryButton = document.querySelector("#demo-primary");
const demoButtons = document.querySelectorAll("[data-demo-message]");

document.documentElement.dataset.app = "linkqr";
document.documentElement.dataset.version = appConfig.appVersion;

if (statusElement) {
  statusElement.textContent = `Sistema visual ${appConfig.appVersion} · cargado correctamente.`;
}

function showDemoMessage(message) {
  if (!statusElement || !message) return;
  statusElement.textContent = message;
}

primaryButton?.addEventListener("click", () => {
  showDemoMessage("Interacción comprobada. Este botón solo demuestra el estilo de acción principal.");
});

demoButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showDemoMessage(button.dataset.demoMessage ?? "Componente de demostración.");
  });
});
