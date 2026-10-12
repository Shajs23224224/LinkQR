import { BrowserQRCodeReader } from "@zxing/browser";
import {
  classifyScannedValue,
  MAX_SCANNER_IMAGE_BYTES,
  validateScannerImage,
} from "./scanner-validation.js";

let activeController = null;
let activeReader = null;
let activeControls = null;
let activeVideoElement = null;
let activeStartButton = null;
let activeStopButton = null;
let activeFileInput = null;
let activeCameraPlaceholder = null;
let activeImageUrl = null;
let scanSequence = 0;

export function renderQrScanner() {
  return [
    '<div class="page-heading-row">',
    '  <div>',
    '    <p class="eyebrow"><span class="eyebrow-dot"></span> LECTOR QR</p>',
    '    <h1 tabindex="-1">Escanear un código QR</h1>',
    '    <p class="page-description">Lee un QR con la cámara o selecciona una imagen. El contenido se procesa localmente y no se envía al backend.</p>',
    '  </div>',
    '  <span class="phase-pill">Escaneo local</span>',
    '</div>',
    '<div class="scanner-layout">',
    '  <section class="scanner-panel" aria-labelledby="scanner-camera-title">',
    '    <div class="generator-panel-heading">',
    '      <span class="generator-step">01</span>',
    '      <div><h2 id="scanner-camera-title">Cámara</h2><p>Permite el acceso solo cuando pulses iniciar.</p></div>',
    '    </div>',
    '    <div class="scanner-video-frame">',
    '      <div class="scanner-camera-placeholder" id="scanner-camera-placeholder">',
    '        <span class="scanner-camera-symbol" aria-hidden="true">⌗</span>',
    '        <strong>La cámara está detenida</strong>',
    '        <p>Usa la cámara trasera cuando el dispositivo lo permita.</p>',
    '      </div>',
    '      <video id="scanner-video" class="scanner-video" aria-label="Vista previa de la cámara para escanear códigos QR" autoplay muted playsinline hidden></video>',
    '    </div>',
    '    <div class="scanner-camera-actions">',
    '      <button class="button button-primary" id="scanner-start-button" type="button"><span aria-hidden="true">◉</span> Iniciar cámara</button>',
    '      <button class="button button-secondary" id="scanner-stop-button" type="button" disabled>Detener</button>',
    '    </div>',
    '    <p class="scanner-status" id="scanner-camera-status" role="status" aria-live="polite">La cámara está apagada.</p>',
    '    <div class="scanner-divider"><span>O escanea desde un archivo</span></div>',
    '    <div class="form-field">',
    '      <label for="scanner-image-file">Selecciona una imagen con un QR</label>',
    '      <input id="scanner-image-file" class="scanner-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif" />',
    '      <p class="scanner-help">Formatos PNG, JPEG, WebP, GIF, BMP o AVIF; máximo 10 MB.</p>',
    '    </div>',
    '    <div class="privacy-note">',
    '      <span class="privacy-icon" aria-hidden="true">⌑</span>',
    '      <p><strong>Escaneo privado.</strong> La cámara y las imágenes se procesan en este navegador. No se cargan archivos ni se envían resultados al servidor.</p>',
    '    </div>',
    '  </section>',
    '  <section class="scanner-panel scanner-result-panel" aria-labelledby="scanner-result-title">',
    '    <div class="generator-panel-heading">',
    '      <span class="generator-step generator-step-muted">02</span>',
    '      <div><h2 id="scanner-result-title">Resultado de lectura</h2><p>El texto detectado aparecerá aquí.</p></div>',
    '    </div>',
    '    <div class="scanner-result-empty" id="scanner-result-empty">',
    '      <span class="scanner-result-icon" aria-hidden="true">▦</span>',
    '      <strong>Esperando un código QR</strong>',
    '      <p>Enfoca un código nítido o carga una imagen donde sea visible.</p>',
    '    </div>',
    '    <div class="scanner-result-content" id="scanner-result-content" hidden>',
    '      <span class="generated-pill"><span aria-hidden="true">✓</span> QR leído</span>',
    '      <pre class="scanner-result-text" id="scanner-result-text" tabindex="0"></pre>',
    '      <div class="scanner-result-actions">',
    '        <button class="button button-primary" id="scanner-copy-button" type="button">Copiar contenido</button>',
    '        <a class="button button-secondary" id="scanner-open-link" href="#" target="_blank" rel="noopener noreferrer" hidden>Abrir enlace seguro ↗</a>',
    '      </div>',
    '    </div>',
    '    <p class="scanner-result-status" id="scanner-result-status" role="status" aria-live="polite"></p>',
    '  </section>',
    '</div>',
  ].join("\n");
}

function stopCameraElements(controlsOverride = null) {
  const controls = controlsOverride || activeControls;
  activeControls = null;

  try {
    controls?.stop();
  } catch {
    // The stream may already have ended because the browser revoked access.
  }

  const stream = activeVideoElement?.srcObject;
  if (stream && typeof stream === "object" && "getTracks" in stream && typeof stream.getTracks === "function") {
    stream.getTracks().forEach((track) => track.stop());
  }
  if (activeVideoElement) {
    activeVideoElement.pause();
    activeVideoElement.srcObject = null;
    activeVideoElement.hidden = true;
  }
  if (activeCameraPlaceholder) activeCameraPlaceholder.hidden = false;
  if (activeStartButton) activeStartButton.disabled = false;
  if (activeStopButton) activeStopButton.disabled = true;
  if (activeFileInput) activeFileInput.disabled = false;
}

export function destroyQrScanner() {
  scanSequence += 1;
  activeController?.abort();
  activeController = null;
  stopCameraElements();
  try {
    activeReader?.reset();
  } catch {
    // Ignore reset errors while leaving a route.
  }
  activeReader = null;

  if (activeImageUrl) {
    URL.revokeObjectURL(activeImageUrl);
    activeImageUrl = null;
  }

  activeVideoElement = null;
  activeStartButton = null;
  activeStopButton = null;
  activeFileInput = null;
  activeCameraPlaceholder = null;
}

function cameraErrorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "El acceso a la cámara fue denegado. Habilita el permiso de cámara en el navegador e inténtalo de nuevo.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No se encontró una cámara disponible. Puedes escanear desde una imagen.";
    case "NotReadableError":
    case "TrackStartError":
      return "La cámara está ocupada por otra aplicación o no se puede iniciar.";
    case "OverconstrainedError":
      return "No se encontró una cámara compatible. Comprueba el dispositivo e inténtalo de nuevo.";
    case "SecurityError":
      return "El navegador bloqueó el acceso a la cámara. Abre LinkQR mediante HTTPS y revisa los permisos.";
    default:
      return "No se pudo iniciar la cámara. Comprueba los permisos o usa la opción de imagen.";
  }
}

export function initQrScanner() {
  destroyQrScanner();
  activeController = new AbortController();
  const { signal } = activeController;
  const cameraStatus = document.querySelector("#scanner-camera-status");
  const resultStatus = document.querySelector("#scanner-result-status");
  const startButton = document.querySelector("#scanner-start-button");
  const stopButton = document.querySelector("#scanner-stop-button");
  const video = document.querySelector("#scanner-video");
  const cameraPlaceholder = document.querySelector("#scanner-camera-placeholder");
  const fileInput = document.querySelector("#scanner-image-file");
  const resultEmpty = document.querySelector("#scanner-result-empty");
  const resultContent = document.querySelector("#scanner-result-content");
  const resultText = document.querySelector("#scanner-result-text");
  const copyButton = document.querySelector("#scanner-copy-button");
  const openLink = document.querySelector("#scanner-open-link");

  if (
    !(cameraStatus instanceof HTMLParagraphElement) ||
    !(resultStatus instanceof HTMLParagraphElement) ||
    !(startButton instanceof HTMLButtonElement) ||
    !(stopButton instanceof HTMLButtonElement) ||
    !(video instanceof HTMLVideoElement) ||
    !(cameraPlaceholder instanceof HTMLElement) ||
    !(fileInput instanceof HTMLInputElement) ||
    !(resultEmpty instanceof HTMLElement) ||
    !(resultContent instanceof HTMLElement) ||
    !(resultText instanceof HTMLPreElement) ||
    !(copyButton instanceof HTMLButtonElement) ||
    !(openLink instanceof HTMLAnchorElement)
  ) {
    return;
  }

  activeReader = new BrowserQRCodeReader();
  activeVideoElement = video;
  activeStartButton = startButton;
  activeStopButton = stopButton;
  activeFileInput = fileInput;
  activeCameraPlaceholder = cameraPlaceholder;

  function showResult(value) {
    const classified = classifyScannedValue(value);
    resultText.textContent = classified.text;
    resultContent.hidden = false;
    resultEmpty.hidden = true;
    copyButton.disabled = false;

    if (classified.isHttpUrl) {
      openLink.href = classified.url;
      openLink.hidden = false;
    } else {
      openLink.removeAttribute("href");
      openLink.hidden = true;
    }
  }

  function stopCameraWithStatus(message) {
    scanSequence += 1;
    stopCameraElements();
    try {
      activeReader?.reset();
    } catch {
      // A stopped camera does not prevent using the image scanner.
    }
    cameraStatus.textContent = message;
  }

  startButton.addEventListener("click", async () => {
    if (startButton.disabled || signal.aborted) return;

    if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      cameraStatus.textContent = "La cámara requiere una conexión HTTPS o localhost. Puedes escanear desde una imagen.";
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      cameraStatus.textContent = "Este navegador no permite acceder a la cámara. Escanea desde una imagen.";
      return;
    }

    const sequence = ++scanSequence;
    startButton.disabled = true;
    stopButton.disabled = false;
    fileInput.disabled = true;
    cameraStatus.textContent = "Solicitando permiso para acceder a la cámara…";
    resultStatus.textContent = "";

    try {
      const reader = activeReader;
      const controls = await reader.decodeFromVideoDevice(undefined, video, (result, _error, callbackControls) => {
        if (!result || sequence !== scanSequence || signal.aborted) return;

        scanSequence += 1;
        stopCameraElements(callbackControls);
        try {
          reader.reset();
        } catch {
          // The detected result is already available.
        }
        showResult(result.getText());
        cameraStatus.textContent = "Código QR detectado. La cámara se ha detenido.";
        resultStatus.textContent = "Lectura completada. Puedes copiar el contenido o abrir el enlace si es HTTP/HTTPS.";
      });

      if (sequence !== scanSequence || signal.aborted) {
        controls.stop();
        return;
      }

      activeControls = controls;
      video.hidden = false;
      cameraPlaceholder.hidden = true;
      startButton.disabled = true;
      stopButton.disabled = false;
      fileInput.disabled = true;
      cameraStatus.textContent = "Cámara activa. Mantén el código QR dentro de la imagen.";
    } catch (error) {
      if (sequence !== scanSequence || signal.aborted) return;
      stopCameraElements();
      cameraStatus.textContent = cameraErrorMessage(error);
    }
  }, { signal });

  stopButton.addEventListener("click", () => {
    stopCameraWithStatus("Cámara detenida.");
  }, { signal });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const validation = validateScannerImage(file);
    if (!validation.ok) {
      resultStatus.textContent = validation.error;
      fileInput.value = "";
      return;
    }

    stopCameraElements();
    try {
      activeReader?.reset();
    } catch {
      // Continue with a fresh still-image decode attempt.
    }

    const sequence = ++scanSequence;
    const objectUrl = URL.createObjectURL(file);
    activeImageUrl = objectUrl;
    resultStatus.textContent = "Leyendo imagen: " + file.name;
    cameraStatus.textContent = "Escaneando desde una imagen local.";

    try {
      const reader = activeReader;
      const result = await reader.decodeFromImageUrl(objectUrl);
      if (sequence !== scanSequence || signal.aborted) return;

      showResult(result.getText());
      resultStatus.textContent = "QR leído correctamente desde la imagen.";
      cameraStatus.textContent = "Escaneo desde archivo completado.";
    } catch {
      if (sequence !== scanSequence || signal.aborted) return;
      resultStatus.textContent = "No se encontró un QR legible. Prueba con una imagen más nítida, mejor iluminada o con el código completo visible.";
    } finally {
      if (activeImageUrl === objectUrl) {
        URL.revokeObjectURL(objectUrl);
        activeImageUrl = null;
      }
      fileInput.value = "";
    }
  }, { signal });

  copyButton.addEventListener("click", async () => {
    const value = resultText.textContent || "";
    if (!value) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(value);
      resultStatus.textContent = "Contenido copiado al portapapeles.";
    } catch {
      resultStatus.textContent = "No se pudo copiar automáticamente. Selecciona el texto del resultado y cópialo manualmente.";
      resultText.focus();
    }
  }, { signal });
}
