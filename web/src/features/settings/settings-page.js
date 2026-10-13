import "./settings.css";
import { validateQrOptions } from "../generator/validation.js";
import { getDefaultSettings, loadSettings, resetSettings, saveSettings } from "./settings-store.js";

let controller = null;

export function renderSettingsPage() {
  return `
    <div class="page-heading-row">
      <div>
        <p class="eyebrow"><span class="eyebrow-dot"></span> PREFERENCIAS LOCALES</p>
        <h1 tabindex="-1">Ajustes de LinkQR</h1>
        <p class="page-description">Configura tus valores predeterminados y decide qué resultados se guardan en este navegador.</p>
      </div>
      <span class="local-pill"><span aria-hidden="true"></span> Solo este navegador</span>
    </div>

    <form class="settings-layout" id="settings-form" novalidate>
      <section class="settings-panel" aria-labelledby="settings-qr-title">
        <div class="settings-panel-heading">
          <span class="settings-panel-icon" aria-hidden="true">▦</span>
          <div><h2 id="settings-qr-title">Generación de códigos QR</h2><p>Estos valores se aplican al abrir el generador. Puedes cambiarlos para cada QR antes de generarlo.</p></div>
        </div>
        <div class="settings-fields">
          <div class="form-field">
            <label for="settings-default-kind">Tipo predeterminado</label>
            <select id="settings-default-kind" name="defaultKind">
              <option value="url">Dirección web (URL)</option>
              <option value="text">Texto libre</option>
            </select>
          </div>
          <div class="form-field">
            <label for="settings-size">Tamaño PNG</label>
            <select id="settings-size" name="width">
              <option value="192">192 × 192 px</option>
              <option value="256">256 × 256 px</option>
              <option value="320">320 × 320 px</option>
              <option value="384">384 × 384 px</option>
              <option value="512">512 × 512 px</option>
              <option value="640">640 × 640 px</option>
              <option value="768">768 × 768 px</option>
            </select>
          </div>
          <div class="form-field">
            <label for="settings-dark-color">Color del patrón</label>
            <div class="settings-color-input"><input id="settings-dark-color" type="color" value="#111827" /><output class="settings-color-value" id="settings-dark-value">#111827</output></div>
          </div>
          <div class="form-field">
            <label for="settings-light-color">Color del fondo</label>
            <div class="settings-color-input"><input id="settings-light-color" type="color" value="#FFFFFF" /><output class="settings-color-value" id="settings-light-value">#FFFFFF</output></div>
          </div>
          <div class="form-field">
            <label for="settings-margin">Margen blanco</label>
            <select id="settings-margin" name="margin">
              <option value="4">4 módulos (recomendado)</option>
              <option value="6">6 módulos</option>
              <option value="8">8 módulos</option>
            </select>
          </div>
        </div>
        <p class="settings-validation" id="settings-validation" role="status" aria-live="polite">Se requiere contraste mínimo de 4.5:1.</p>
      </section>

      <section class="settings-panel" aria-labelledby="settings-history-title">
        <div class="settings-panel-heading">
          <span class="settings-panel-icon" aria-hidden="true">◷</span>
          <div><h2 id="settings-history-title">Historial y privacidad</h2><p>Controla si LinkQR registra automáticamente el contenido de los QR en el historial local.</p></div>
        </div>
        <div class="settings-toggle-list">
          <label class="settings-toggle" for="settings-save-generated">
            <input id="settings-save-generated" type="checkbox" checked />
            <span class="settings-toggle-copy"><strong>Guardar QR generados</strong><small>Conserva el contenido de cada QR que generes en el historial local. Si lo desactivas, el PNG seguirá funcionando.</small></span>
          </label>
          <label class="settings-toggle" for="settings-save-scanned">
            <input id="settings-save-scanned" type="checkbox" checked />
            <span class="settings-toggle-copy"><strong>Guardar resultados escaneados</strong><small>Conserva el texto leído desde la cámara o una imagen. El escaneo y la copia siguen disponibles si lo desactivas.</small></span>
          </label>
        </div>
        <p class="settings-data-note">Los ajustes y el historial están separados y se guardan en este navegador. Desactivar el guardado automático no elimina registros que ya existan.</p>
      </section>

      <section class="settings-panel" aria-labelledby="settings-data-title">
        <div class="settings-panel-heading">
          <span class="settings-panel-icon" aria-hidden="true">⌂</span>
          <div><h2 id="settings-data-title">Datos locales</h2><p>Gestiona los datos de LinkQR sin subirlos a un servidor.</p></div>
        </div>
        <p class="settings-data-note">Para crear o restaurar una copia del historial, utiliza las herramientas JSON de la sección Historial. Restablecer ajustes no borrará tus códigos ni tus favoritos.</p>
        <div class="settings-footer-links">
          <a href="#/history">Abrir historial y copias de seguridad ↗</a>
          <a href="#/favorites">Consultar favoritos ↗</a>
        </div>
      </section>

      <p class="settings-validation" id="settings-save-status" role="status" aria-live="polite"></p>
      <div class="settings-actions">
        <button class="button button-primary" type="submit" id="settings-save-button">Guardar ajustes</button>
        <button class="button button-secondary" type="button" id="settings-reset-button">Restablecer valores predeterminados</button>
      </div>
    </form>
  `;
}

export function destroySettingsPage() {
  controller?.abort();
  controller = null;
}

export function initSettingsPage() {
  destroySettingsPage();
  controller = new AbortController();
  const { signal } = controller;
  const form = document.querySelector("#settings-form");
  const kind = document.querySelector("#settings-default-kind");
  const dark = document.querySelector("#settings-dark-color");
  const light = document.querySelector("#settings-light-color");
  const darkValue = document.querySelector("#settings-dark-value");
  const lightValue = document.querySelector("#settings-light-value");
  const width = document.querySelector("#settings-size");
  const margin = document.querySelector("#settings-margin");
  const saveGenerated = document.querySelector("#settings-save-generated");
  const saveScanned = document.querySelector("#settings-save-scanned");
  const feedback = document.querySelector("#settings-validation");
  const status = document.querySelector("#settings-save-status");
  const reset = document.querySelector("#settings-reset-button");

  if (!(form instanceof HTMLFormElement) ||
      !(kind instanceof HTMLSelectElement) ||
      !(dark instanceof HTMLInputElement) ||
      !(light instanceof HTMLInputElement) ||
      !(darkValue instanceof HTMLOutputElement) ||
      !(lightValue instanceof HTMLOutputElement) ||
      !(width instanceof HTMLSelectElement) ||
      !(margin instanceof HTMLSelectElement) ||
      !(saveGenerated instanceof HTMLInputElement) ||
      !(saveScanned instanceof HTMLInputElement) ||
      !(feedback instanceof HTMLParagraphElement) ||
      !(status instanceof HTMLParagraphElement) ||
      !(reset instanceof HTMLButtonElement)) return;

  function apply(settings) {
    kind.value = settings.qr.kind;
    dark.value = settings.qr.dark;
    light.value = settings.qr.light;
    width.value = String(settings.qr.width);
    margin.value = String(settings.qr.margin);
    saveGenerated.checked = settings.history.saveGenerated;
    saveScanned.checked = settings.history.saveScanned;
    updateFeedback();
  }

  function readForm() {
    return {
      qr: {
        kind: kind.value,
        dark: dark.value,
        light: light.value,
        width: width.value,
        margin: margin.value,
      },
      history: {
        saveGenerated: saveGenerated.checked,
        saveScanned: saveScanned.checked,
      },
    };
  }

  function updateFeedback() {
    if (darkValue) darkValue.textContent = dark.value.toUpperCase();
    if (lightValue) lightValue.textContent = light.value.toUpperCase();
    const result = validateQrOptions({ dark: dark.value, light: light.value, width: width.value, margin: margin.value });
    feedback.textContent = result.ok
      ? "Contraste " + result.contrastRatio.toFixed(2) + ":1. Los parámetros son válidos."
      : result.error;
    feedback.classList.toggle("is-error", !result.ok);
  }

  [dark, light, width, margin].forEach((control) => {
    control.addEventListener(control.type === "color" ? "input" : "change", updateFeedback, { signal });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.textContent = "";
    const result = saveSettings(readForm());
    if (!result.ok) {
      status.textContent = result.error;
      status.classList.add("is-error");
      return;
    }
    apply(result.settings);
    status.classList.remove("is-error");
    status.textContent = "Ajustes guardados en este navegador. Se aplicarán la próxima vez que abras el generador o escáner.";
  }, { signal });

  reset.addEventListener("click", () => {
    if (!window.confirm("¿Restablecer los ajustes? El historial y los favoritos no se borrarán.")) return;
    const result = resetSettings();
    if (!result.ok) {
      status.textContent = result.error;
      status.classList.add("is-error");
      return;
    }
    apply(result.settings);
    status.classList.remove("is-error");
    status.textContent = "Ajustes predeterminados restaurados. El historial se conserva.";
  }, { signal });

  const loaded = loadSettings();
  apply(loaded.settings || getDefaultSettings());
  status.classList.remove("is-error");
  status.textContent = loaded.warning || "";
  if (!loaded.ok) status.classList.add("is-error");
}
