import QRCode from "qrcode";
import { MAX_QR_PAYLOAD_BYTES, validateQrInput, validateQrOptions } from "./validation.js";

let activeController = null;
let generationSequence = 0;

export function renderQrGenerator() {
  return `
    <div class="page-heading-row">
      <div>
        <p class="eyebrow"><span class="eyebrow-dot"></span> GENERADOR QR</p>
        <h1 tabindex="-1">Crear un código QR</h1>
        <p class="page-description">Convierte una dirección web o un texto en un código QR escaneable. La generación ocurre en este navegador.</p>
      </div>
      <span class="phase-pill">Generación local</span>
    </div>

    <div class="generator-layout">
      <section class="generator-panel" aria-labelledby="generator-form-title">
        <div class="generator-panel-heading">
          <span class="generator-step">01</span>
          <div>
            <h2 id="generator-form-title">Contenido del código</h2>
            <p>Elige el tipo y escribe lo que quieres compartir.</p>
          </div>
        </div>

        <form id="qr-generator-form" novalidate>
          <div class="form-field">
            <label for="qr-content-type">Tipo de contenido</label>
            <select id="qr-content-type" name="contentType">
              <option value="url">Dirección web (URL)</option>
              <option value="text">Texto libre</option>
            </select>
          </div>

          <div class="form-field">
            <label id="qr-payload-label" for="qr-payload">Dirección web</label>
            <textarea
              id="qr-payload"
              name="payload"
              rows="5"
              maxlength="2048"
              placeholder="https://ejemplo.com"
              aria-describedby="qr-payload-help qr-payload-counter"
              required
            ></textarea>
            <div class="field-meta">
              <p id="qr-payload-help">Incluye el protocolo, por ejemplo https://</p>
              <p id="qr-payload-counter" aria-live="polite">0 / ${MAX_QR_PAYLOAD_BYTES} bytes</p>
            </div>
          </div>

          <fieldset class="qr-customization" aria-describedby="qr-customization-help qr-contrast-status">
            <legend>Personaliza el diseño</legend>
            <div class="qr-color-grid">
              <div class="form-field">
                <label for="qr-dark-color">Color del patrón</label>
                <div class="qr-color-control">
                  <input id="qr-dark-color" name="darkColor" type="color" value="#111827" />
                  <output class="qr-color-value" id="qr-dark-color-value">#111827</output>
                </div>
              </div>
              <div class="form-field">
                <label for="qr-light-color">Color del fondo</label>
                <div class="qr-color-control">
                  <input id="qr-light-color" name="lightColor" type="color" value="#FFFFFF" />
                  <output class="qr-color-value" id="qr-light-color-value">#FFFFFF</output>
                </div>
              </div>
            </div>
            <div class="qr-options-grid">
              <div class="form-field">
                <label for="qr-size">Tamaño PNG</label>
                <select id="qr-size" name="size">
                  <option value="192">192 × 192 px</option>
                  <option value="256">256 × 256 px</option>
                  <option value="320" selected>320 × 320 px</option>
                  <option value="384">384 × 384 px</option>
                  <option value="512">512 × 512 px</option>
                  <option value="640">640 × 640 px</option>
                  <option value="768">768 × 768 px</option>
                </select>
              </div>
              <div class="form-field">
                <label for="qr-margin">Margen blanco</label>
                <select id="qr-margin" name="margin">
                  <option value="4" selected>4 módulos (recomendado)</option>
                  <option value="6">6 módulos</option>
                  <option value="8">8 módulos</option>
                </select>
              </div>
            </div>
            <p class="qr-customization-help" id="qr-customization-help">El margen crea un área despejada alrededor del patrón. Cuatro módulos es la opción recomendada para facilitar el escaneo.</p>
            <p class="qr-contrast-status" id="qr-contrast-status" role="status" aria-live="polite">Contraste mínimo recomendado: 4.5:1.</p>
          </fieldset>

          <p class="generator-error" id="qr-generator-error" role="alert" hidden></p>

          <div class="generator-actions">
            <button class="button button-primary" id="qr-generate-button" type="submit">
              <span aria-hidden="true">▦</span> Generar código QR <span aria-hidden="true">→</span>
            </button>
            <button class="button button-secondary" id="qr-clear-button" type="button">Limpiar</button>
          </div>
          <p class="generator-status" id="qr-generator-status" role="status" aria-live="polite"></p>
        </form>

        <div class="privacy-note">
          <span class="privacy-icon" aria-hidden="true">⌑</span>
          <p><strong>Tu contenido permanece aquí.</strong> Esta fase genera el código en el navegador; no envía el texto ni la URL al backend.</p>
        </div>
      </section>

      <section class="generator-panel qr-output-panel" aria-labelledby="qr-output-title">
        <div class="generator-panel-heading">
          <span class="generator-step generator-step-muted">02</span>
          <div>
            <h2 id="qr-output-title">Vista previa</h2>
            <p>El resultado aparecerá aquí al generar el código.</p>
          </div>
        </div>

        <div class="qr-empty-state" id="qr-empty-state">
          <div class="qr-empty-symbol" aria-hidden="true">▦</div>
          <strong>Aún no hay un código QR</strong>
          <p>Completa el formulario y selecciona “Generar código QR”.</p>
        </div>

        <div class="qr-result" id="qr-result" hidden>
          <div class="qr-image-frame">
            <img id="qr-preview" alt="Código QR generado para el contenido introducido" width="320" height="320" />
          </div>
          <span class="generated-pill"><span aria-hidden="true">✓</span> QR generado</span>
          <h3 id="qr-result-title">Código listo</h3>
          <p class="qr-result-payload" id="qr-result-payload"></p>
          <div class="qr-result-meta">
            <span><strong id="qr-result-kind">URL</strong><small>Tipo</small></span>
            <span><strong id="qr-result-bytes">0 bytes</strong><small>Contenido UTF-8</small></span>
            <span><strong id="qr-result-size">320 × 320 px</strong><small>Tamaño PNG</small></span>
            <span><strong id="qr-result-margin">4 módulos</strong><small>Margen blanco</small></span>
          </div>
          <a id="qr-download-button" class="button button-primary qr-download-button" href="#" download="linkqr.png">
            <span aria-hidden="true">↓</span> Descargar PNG
          </a>
          <p class="qr-export-note">El archivo se genera en este navegador. No se envía al servidor.</p>
        </div>
      </section>
    </div>
  `;
}

export function destroyQrGenerator() {
  generationSequence += 1;
  activeController?.abort();
  activeController = null;
}

export function initQrGenerator() {
  destroyQrGenerator();
  activeController = new AbortController();
  const { signal } = activeController;

  const form = document.querySelector("#qr-generator-form");
  const typeSelect = document.querySelector("#qr-content-type");
  const payloadField = document.querySelector("#qr-payload");
  const payloadLabel = document.querySelector("#qr-payload-label");
  const payloadHelp = document.querySelector("#qr-payload-help");
  const payloadCounter = document.querySelector("#qr-payload-counter");
  const errorElement = document.querySelector("#qr-generator-error");
  const statusElement = document.querySelector("#qr-generator-status");
  const generateButton = document.querySelector("#qr-generate-button");
  const clearButton = document.querySelector("#qr-clear-button");
  const emptyState = document.querySelector("#qr-empty-state");
  const resultPanel = document.querySelector("#qr-result");
  const previewImage = document.querySelector("#qr-preview");
  const resultTitle = document.querySelector("#qr-result-title");
  const resultPayload = document.querySelector("#qr-result-payload");
  const resultKind = document.querySelector("#qr-result-kind");
  const resultBytes = document.querySelector("#qr-result-bytes");
  const resultSize = document.querySelector("#qr-result-size");
  const resultMargin = document.querySelector("#qr-result-margin");
  const darkColorField = document.querySelector("#qr-dark-color");
  const lightColorField = document.querySelector("#qr-light-color");
  const darkColorValue = document.querySelector("#qr-dark-color-value");
  const lightColorValue = document.querySelector("#qr-light-color-value");
  const sizeSelect = document.querySelector("#qr-size");
  const marginSelect = document.querySelector("#qr-margin");
  const contrastStatus = document.querySelector("#qr-contrast-status");
  const downloadButton = document.querySelector("#qr-download-button");

  if (
    !(form instanceof HTMLFormElement) ||
    !(typeSelect instanceof HTMLSelectElement) ||
    !(payloadField instanceof HTMLTextAreaElement) ||
    !(payloadLabel instanceof HTMLLabelElement) ||
    !(payloadHelp instanceof HTMLParagraphElement) ||
    !(payloadCounter instanceof HTMLParagraphElement) ||
    !(errorElement instanceof HTMLParagraphElement) ||
    !(statusElement instanceof HTMLParagraphElement) ||
    !(generateButton instanceof HTMLButtonElement) ||
    !(clearButton instanceof HTMLButtonElement) ||
    !(emptyState instanceof HTMLElement) ||
    !(resultPanel instanceof HTMLElement) ||
    !(previewImage instanceof HTMLImageElement) ||
    !(resultPayload instanceof HTMLParagraphElement) ||
    !(resultSize instanceof HTMLSpanElement) ||
    !(resultMargin instanceof HTMLSpanElement) ||
    !(darkColorField instanceof HTMLInputElement) ||
    !(lightColorField instanceof HTMLInputElement) ||
    !(darkColorValue instanceof HTMLOutputElement) ||
    !(lightColorValue instanceof HTMLOutputElement) ||
    !(sizeSelect instanceof HTMLSelectElement) ||
    !(marginSelect instanceof HTMLSelectElement) ||
    !(contrastStatus instanceof HTMLParagraphElement) ||
    !(downloadButton instanceof HTMLAnchorElement)
  ) {
    return;
  }

  function updateCounter() {
    const byteLength = new TextEncoder().encode(payloadField.value).byteLength;
    payloadCounter.textContent = `${byteLength.toLocaleString()} / ${MAX_QR_PAYLOAD_BYTES} bytes`;
    payloadCounter.classList.toggle("is-over-limit", byteLength > MAX_QR_PAYLOAD_BYTES);
  }

  function clearResult(message = "") {
    generationSequence += 1;
    previewImage.removeAttribute("src");
    downloadButton.removeAttribute("href");
    resultPanel.hidden = true;
    emptyState.hidden = false;
    statusElement.textContent = message;
  }

  function clearError() {
    errorElement.hidden = true;
    errorElement.textContent = "";
    [payloadField, darkColorField, lightColorField, sizeSelect, marginSelect]
      .forEach((control) => control.removeAttribute("aria-invalid"));
  }

  function updateCustomizationFeedback() {
    darkColorValue.textContent = darkColorField.value.toUpperCase();
    lightColorValue.textContent = lightColorField.value.toUpperCase();

    const validation = validateQrOptions({
      dark: darkColorField.value,
      light: lightColorField.value,
      width: sizeSelect.value,
      margin: marginSelect.value,
    });

    if (validation.ok) {
      contrastStatus.textContent = "Contraste " + validation.contrastRatio.toFixed(2) +
        ":1. Tamaño y margen válidos.";
      contrastStatus.classList.remove("is-invalid");
      [darkColorField, lightColorField, sizeSelect, marginSelect]
        .forEach((control) => control.removeAttribute("aria-invalid"));
    } else {
      contrastStatus.textContent = validation.error;
      contrastStatus.classList.add("is-invalid");
      const focusTargets = {
        dark: darkColorField,
        light: lightColorField,
        width: sizeSelect,
        margin: marginSelect,
      };
      focusTargets[validation.field]?.setAttribute("aria-invalid", "true");
    }
  }

  function onCustomizationChange() {
    clearError();
    updateCustomizationFeedback();
    if (!resultPanel.hidden) {
      clearResult("La personalización cambió. Genera de nuevo para actualizar el código QR.");
    }
  }

  function updateContentType() {
    const isUrl = typeSelect.value === "url";
    payloadLabel.textContent = isUrl ? "Dirección web" : "Texto que quieres compartir";
    payloadField.placeholder = isUrl
      ? "https://ejemplo.com"
      : "Escribe tu texto aquí…";
    payloadHelp.textContent = isUrl
      ? "Incluye el protocolo, por ejemplo https://"
      : "Se conservarán los espacios y saltos de línea que escribas.";
    updateCounter();
  }

  typeSelect.addEventListener("change", () => {
    clearError();
    updateContentType();
    clearResult("El tipo de contenido cambió. Genera un nuevo código para actualizar la vista previa.");
  }, { signal });

  darkColorField.addEventListener("input", onCustomizationChange, { signal });
  lightColorField.addEventListener("input", onCustomizationChange, { signal });
  sizeSelect.addEventListener("change", onCustomizationChange, { signal });
  marginSelect.addEventListener("change", onCustomizationChange, { signal });

  payloadField.addEventListener("input", () => {
    clearError();
    updateCounter();
    if (!resultPanel.hidden) {
      clearResult("El contenido cambió. Genera un nuevo código para actualizar la vista previa.");
    }
  }, { signal });

  clearButton.addEventListener("click", () => {
    typeSelect.value = "url";
    payloadField.value = "";
    clearError();
    updateContentType();
    clearResult("Formulario limpiado.");
    payloadField.focus();
  }, { signal });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();
    statusElement.textContent = "";

    if (generateButton.disabled) return;

    const validation = validateQrInput(payloadField.value, typeSelect.value);
    if (!validation.ok) {
      errorElement.textContent = validation.error;
      errorElement.hidden = false;
      payloadField.setAttribute("aria-invalid", "true");
      payloadField.focus();
      return;
    }

    const optionsValidation = validateQrOptions({
      dark: darkColorField.value,
      light: lightColorField.value,
      width: sizeSelect.value,
      margin: marginSelect.value,
    });
    if (!optionsValidation.ok) {
      errorElement.textContent = optionsValidation.error;
      errorElement.hidden = false;
      contrastStatus.textContent = optionsValidation.error;
      contrastStatus.classList.add("is-invalid");
      const focusTargets = {
        dark: darkColorField,
        light: lightColorField,
        width: sizeSelect,
        margin: marginSelect,
      };
      const focusTarget = focusTargets[optionsValidation.field];
      focusTarget?.setAttribute("aria-invalid", "true");
      focusTarget?.focus();
      return;
    }

    const currentSequence = ++generationSequence;
    generateButton.disabled = true;
    const generationControls = [
      typeSelect, payloadField, clearButton, darkColorField, lightColorField, sizeSelect, marginSelect,
    ];
    generationControls.forEach((control) => { control.disabled = true; });
    generateButton.setAttribute("aria-busy", "true");
    generateButton.textContent = "Generando…";
    form.setAttribute("aria-busy", "true");

    try {
      const dataUrl = await QRCode.toDataURL(validation.payload, {
        errorCorrectionLevel: "L",
        margin: optionsValidation.margin,
        width: optionsValidation.width,
        color: {
          dark: optionsValidation.dark,
          light: optionsValidation.light,
        },
      });

      if (currentSequence !== generationSequence || signal.aborted) return;

      previewImage.src = dataUrl;
      previewImage.width = optionsValidation.width;
      previewImage.height = optionsValidation.width;
      downloadButton.href = dataUrl;
      downloadButton.download = "linkqr-" + validation.kind + "-" + optionsValidation.width + "px.png";
      resultTitle.textContent = validation.kind === "url" ? "Código QR de URL" : "Código QR de texto";
      resultPayload.textContent = validation.payload.length > 180
        ? `${validation.payload.slice(0, 177)}…`
        : validation.payload;
      resultPayload.title = validation.payload;
      resultKind.textContent = validation.kind === "url" ? "URL" : "Texto";
      resultBytes.textContent = validation.bytes.toLocaleString() + " bytes";
      resultSize.textContent = optionsValidation.width + " × " + optionsValidation.width + " px";
      resultMargin.textContent = optionsValidation.margin + " módulos";
      resultPanel.hidden = false;
      emptyState.hidden = true;
      statusElement.textContent = "Código QR generado correctamente en este navegador.";
    } catch (error) {
      if (currentSequence !== generationSequence || signal.aborted) return;
      errorElement.textContent = "No se pudo generar el código. Comprueba el contenido e inténtalo con un texto más corto.";
      errorElement.hidden = false;
      statusElement.textContent = "";
      console.error("QR generation failed:", error);
    } finally {
      if (currentSequence === generationSequence && !signal.aborted) {
        generateButton.disabled = false;
        generationControls.forEach((control) => { control.disabled = false; });
        generateButton.removeAttribute("aria-busy");
        generateButton.innerHTML = '<span aria-hidden="true">▦</span> Generar código QR <span aria-hidden="true">→</span>';
        form.removeAttribute("aria-busy");
      }
    }
  }, { signal });

  updateContentType();
  updateCounter();
  updateCustomizationFeedback();
}
