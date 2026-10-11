import QRCode from "qrcode";
import { MAX_QR_PAYLOAD_BYTES, validateQrInput } from "./validation.js";

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
            <span><strong>Nivel L</strong><small>Corrección de errores</small></span>
          </div>
          <p class="qr-export-note">La personalización y descarga del archivo se incorporarán en la Fase 6.</p>
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
    !(resultPayload instanceof HTMLParagraphElement)
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
    resultPanel.hidden = true;
    emptyState.hidden = false;
    statusElement.textContent = message;
  }

  function clearError() {
    errorElement.hidden = true;
    errorElement.textContent = "";
    payloadField.removeAttribute("aria-invalid");
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

    const currentSequence = ++generationSequence;
    generateButton.disabled = true;
    typeSelect.disabled = true;
    payloadField.disabled = true;
    clearButton.disabled = true;
    generateButton.setAttribute("aria-busy", "true");
    generateButton.textContent = "Generando…";
    form.setAttribute("aria-busy", "true");

    try {
      const dataUrl = await QRCode.toDataURL(validation.payload, {
        errorCorrectionLevel: "L",
        margin: 4,
        width: 320,
        color: {
          dark: "#111827",
          light: "#FFFFFF",
        },
      });

      if (currentSequence !== generationSequence || signal.aborted) return;

      previewImage.src = dataUrl;
      resultTitle.textContent = validation.kind === "url" ? "Código QR de URL" : "Código QR de texto";
      resultPayload.textContent = validation.payload.length > 180
        ? `${validation.payload.slice(0, 177)}…`
        : validation.payload;
      resultPayload.title = validation.payload;
      resultKind.textContent = validation.kind === "url" ? "URL" : "Texto";
      resultBytes.textContent = `${validation.bytes.toLocaleString()} bytes`;
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
        typeSelect.disabled = false;
        payloadField.disabled = false;
        clearButton.disabled = false;
        generateButton.removeAttribute("aria-busy");
        generateButton.innerHTML = '<span aria-hidden="true">▦</span> Generar código QR <span aria-hidden="true">→</span>';
        form.removeAttribute("aria-busy");
      }
    }
  }, { signal });

  updateContentType();
  updateCounter();
}
