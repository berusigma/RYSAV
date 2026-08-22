/**
 * hdimager.js — WebAbility AI HD Image Upscaler Module
 */
import { showToast, triggerHaptic } from "../utils/index.js";

const API_URL = "https://www.webability.io/api/upscale-image";

export class WebAbilityUpscaler {
  async generate({ imageUrl, scale = "2", model = "esrgan", mode = "photo" }) {
    if (!imageUrl) throw new Error("Gambar tidak boleh kosong.");

    const payload = {
      image: imageUrl,
      scale: scale.toString(),
      model,
      mode,
    };

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        accept: "*/*",
        "content-type": "application/json",
        origin: "https://www.webability.io",
        referer: "https://www.webability.io/tools/ai-image-upscaler",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || result.success === false) {
      throw new Error(result.error || `Error HTTP ${res.status}`);
    }

    return result;
  }
}

const upscaler = new WebAbilityUpscaler();
let selectedBase64 = null;

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
  });
}

export function autoDownloadImage(url, filename = "hd_upscaled_image.png") {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Gambar HD berhasil diunduh!", "success");
  } catch (err) {
    console.warn("Auto download fallback:", err);
  }
}

export async function processImageUpscale() {
  const fileInput = document.getElementById("hdImageFileInput");
  const scaleSelect = document.getElementById("hdImageScaleSelect");
  const modeSelect = document.getElementById("hdImageModeSelect");
  const spinner = document.getElementById("hdImageSpinner");
  const resultCard = document.getElementById("hdImageResultCard");
  const btnSubmit = document.getElementById("btnHdImageSubmit");

  if (!fileInput || (!fileInput.files[0] && !selectedBase64)) {
    showToast("Pilih foto dari galeri terlebih dahulu.", "error");
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner"></span> Memproses HD Image...';
  }

  if (spinner) spinner.classList.remove("hidden");
  if (resultCard) resultCard.classList.add("hidden");

  try {
    let base64 = selectedBase64;
    if (fileInput.files[0]) {
      base64 = await fileToBase64(fileInput.files[0]);
    }

    const scale = scaleSelect ? scaleSelect.value : "2";
    const mode = modeSelect ? modeSelect.value : "photo";

    const result = await upscaler.generate({
      imageUrl: base64,
      scale,
      model: "esrgan",
      mode,
    });

    const resultUrl = result.image || result.url || result.output_url || result.output;
    if (!resultUrl) {
      throw new Error("API tidak mengembalikan hasil gambar.");
    }

    renderResult(base64, resultUrl);
    triggerHaptic("heavy");
    showToast("Penjelasan HD Selesai!", "success");

    // Auto download result as requested
    autoDownloadImage(resultUrl, `RYSAV_HD_${Date.now()}.png`);
  } catch (err) {
    showToast(err.message || "Gagal memproses gambar.", "error");
  } finally {
    if (spinner) spinner.classList.add("hidden");
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Tingkatkan ke HD (Upscale)`;
    }
  }
}

function renderResult(originalBase64, hdResultUrl) {
  const resultCard = document.getElementById("hdImageResultCard");
  if (!resultCard) return;

  resultCard.innerHTML = `
    <div style="padding: 16px;">
      <h3 style="font-size: 1rem; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        ✨ Hasil HD Image Upscale
      </h3>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="text-align: center;">
          <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--text-secondary); display: block; margin-bottom: 6px;">Sebelum</span>
          <img src="${originalBase64}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border-color);" />
        </div>
        <div style="text-align: center;">
          <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; color: var(--primary); display: block; margin-bottom: 6px;">Sesudah (HD)</span>
          <img src="${hdResultUrl}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 12px; border: 2px solid var(--primary);" />
        </div>
      </div>

      <a href="${hdResultUrl}" download="RYSAV_HD_${Date.now()}.png" id="btnManualDownloadHd" class="btn-primary-main" style="text-decoration: none;">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Unduh Ulang Gambar HD
      </a>
    </div>
  `;

  resultCard.classList.remove("hidden");
}

export function initHdImageEvents() {
  const fileInput = document.getElementById("hdImageFileInput");
  const dropZone = document.getElementById("hdImageDropZone");
  const previewImg = document.getElementById("hdImagePreview");
  const previewContainer = document.getElementById("hdImagePreviewContainer");
  const btnSubmit = document.getElementById("btnHdImageSubmit");

  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedBase64 = await fileToBase64(file);
        if (previewImg) previewImg.src = selectedBase64;
        if (previewContainer) previewContainer.classList.remove("hidden");
      }
    });
  }

  if (dropZone) {
    dropZone.addEventListener("click", () => fileInput && fileInput.click());
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--primary)";
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "var(--border-color)";
    });
    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--border-color)";
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
        selectedBase64 = await fileToBase64(e.dataTransfer.files[0]);
        if (previewImg) previewImg.src = selectedBase64;
        if (previewContainer) previewContainer.classList.remove("hidden");
      }
    });
  }

  if (btnSubmit) {
    btnSubmit.addEventListener("click", () => processImageUpscale());
  }
}
