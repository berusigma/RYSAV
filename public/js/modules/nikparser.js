/**
 * nikparser.js — Indonesian NIK (Nomor Induk Kependudukan) Parser & Region Lookup
 */
import { showToast, triggerHaptic } from "../utils/index.js";

class NikProcessor {
  constructor(creatorName = "NIK_Parser_v1.0") {
    this.creatorName = creatorName;
    this.provinces = {};
    this.cities = {};
    this.kecamatans = {};
    this.villages = {};
    this.loadedProvinces = new Set();
    this.loadedCities = new Set();
    this.loadedKecamatanForVillages = new Set();
  }

  async _loadRegionData(id, type) {
    const baseUrl = "https://www.emsifa.com/api-wilayah-indonesia/api/";
    let url = "";
    let loadedSet;
    let targetMap;

    switch (type) {
      case "province":
        url = `${baseUrl}provinces.json`;
        loadedSet = this.loadedProvinces;
        targetMap = this.provinces;
        break;
      case "regency":
        url = `${baseUrl}regencies/${id}.json`;
        loadedSet = this.loadedCities;
        targetMap = this.cities;
        break;
      case "district":
        url = `${baseUrl}districts/${id}.json`;
        loadedSet = this.loadedCities;
        targetMap = this.kecamatans;
        break;
      case "village":
        url = `${baseUrl}villages/${id}.json`;
        loadedSet = this.loadedKecamatanForVillages;
        targetMap = this.villages;
        break;
      default:
        return;
    }

    if (id && loadedSet.has(id)) return;
    if (!id && type !== "province") return;

    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((item) => {
          targetMap[item.id] = item.name;
        });
        loadedSet.add(id || "all_provinces");
      }
    } catch (e) {
      console.warn("[NIK Region Fetch Warning]", e);
    }
  }

  _getZodiac(day, month) {
    if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
    if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "Pisces";
    return "Tidak Diketahui";
  }

  _getJavanese(year, month, day) {
    const pasaranDays = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];
    const westernDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const epoch = new Date(2000, 0, 1); // 2000-01-01 was Sabtu Pon
    const target = new Date(year, month - 1, day);
    const diffTime = target.getTime() - epoch.getTime();
    const daysDiff = Math.floor(diffTime / (1000 * 3600 * 24));

    const westernIndex = ((6 + daysDiff) % 7 + 7) % 7;
    const pasaranIndex = ((2 + daysDiff) % 5 + 5) % 5;
    return `${westernDays[westernIndex]} ${pasaranDays[pasaranIndex]}`;
  }

  async parseNik({ nik }) {
    const cleanNik = String(nik || "").trim();
    if (cleanNik.length !== 16 || !/^\d+$/.test(cleanNik)) {
      return {
        status: "error",
        message: "Format NIK tidak valid. NIK harus terdiri dari 16 digit angka.",
      };
    }

    const provId = cleanNik.substring(0, 2);
    const cityId = cleanNik.substring(0, 4);
    const kecIdPrefix = cleanNik.substring(0, 6);
    const uniqueCode = cleanNik.substring(12, 16);

    await this._loadRegionData(null, "province");
    await this._loadRegionData(provId, "regency");
    await this._loadRegionData(cityId, "district");

    let exactKecamatanId = Object.keys(this.kecamatans).find(
      (id) => id.startsWith(kecIdPrefix) && id.length === 7,
    );
    if (exactKecamatanId) {
      await this._loadRegionData(exactKecamatanId, "village");
    }

    try {
      const dobString = cleanNik.substring(6, 12);
      let day = parseInt(dobString.substring(0, 2), 10);
      const month = parseInt(dobString.substring(2, 4), 10);
      const yearSuffix = parseInt(dobString.substring(4, 6), 10);
      let gender = "Laki-laki";

      if (day > 40) {
        day -= 40;
        gender = "Perempuan";
      }

      if (month < 1 || month > 12 || day < 1 || day > 31) {
        return {
          status: "error",
          message: "Tanggal lahir pada NIK tidak valid.",
        };
      }

      const currentYear = new Date().getFullYear();
      const currentYearTwoDigit = currentYear % 100;
      const fullYear =
        yearSuffix > currentYearTwoDigit + 5 ? 1900 + yearSuffix : 2000 + yearSuffix;

      const birthDate = new Date(fullYear, month - 1, day);
      if (
        birthDate.getFullYear() !== fullYear ||
        birthDate.getMonth() !== month - 1 ||
        birthDate.getDate() !== day
      ) {
        return {
          status: "error",
          message: "Tanggal lahir pada NIK tidak valid.",
        };
      }

      const today = new Date();
      if (birthDate > today) {
        return {
          status: "error",
          message: "Tanggal lahir NIK berada di masa depan.",
        };
      }

      const dobFormatted = `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const provinceName = this.provinces[provId] || "Tidak Diketahui";
      const cityName = this.cities[cityId] || "Tidak Diketahui";
      const kecamatanName = exactKecamatanId
        ? this.kecamatans[exactKecamatanId]
        : "Tidak Diketahui";

      // Age calculation
      let years = today.getFullYear() - birthDate.getFullYear();
      let months = today.getMonth() - birthDate.getMonth();
      let days = today.getDate() - birthDate.getDate();

      if (days < 0) {
        months--;
        const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        days += prevMonthLastDay;
      }
      if (months < 0) {
        years--;
        months += 12;
      }

      const usiaDetail = {
        tahun: years,
        bulan: months,
        hari: days,
        lengkap: `${years} tahun ${months} bulan ${days} hari`,
      };

      // Next Birthday calculation
      const nextBday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
      if (nextBday < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
        nextBday.setFullYear(today.getFullYear() + 1);
      }
      const diffTime = nextBday.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));

      let hitungMundur = "Hari ini! 🎉";
      if (diffDays > 0) {
        const sisaBulan = Math.floor(diffDays / 30.44);
        const sisaHari = Math.round(diffDays % 30.44);
        hitungMundur = sisaBulan > 0 ? `${sisaBulan} bulan ${sisaHari} hari lagi` : `${diffDays} hari lagi`;
      }

      const detailTurunan = {
        pasaranJawa: this._getJavanese(fullYear, month, day),
        usia: usiaDetail,
        ulangTahunBerikutnya: {
          tanggal: `${nextBday.getFullYear()}-${String(nextBday.getMonth() + 1).padStart(2, "0")}-${String(nextBday.getDate()).padStart(2, "0")}`,
          hariSampai: diffDays,
          hitungMundur,
        },
        zodiak: this._getZodiac(day, month),
      };

      const dataLokasi = {
        provinsi: { id: provId, nama: provinceName },
        kota_kabupaten: { id: cityId, nama: cityName },
        kecamatan: { id: exactKecamatanId || kecIdPrefix, nama: kecamatanName },
        daftar_desa_kelurahan: this.villages || {},
      };

      return {
        status: "sukses",
        pemroses: this.creatorName,
        data: {
          nik: cleanNik,
          jenisKelamin: gender,
          tanggalLahir: dobFormatted,
          kodeUnik: uniqueCode,
          lokasi: dataLokasi,
          detailTurunan,
        },
      };
    } catch (err) {
      return {
        status: "error",
        message: `Gagal memproses NIK: ${err.message}`,
      };
    }
  }
}

const processor = new NikProcessor();

export async function processNikParsing(nikString) {
  const resultCard = document.getElementById("nikResultCard");
  const loadingSpinner = document.getElementById("nikLoadingSpinner");

  if (!nikString || String(nikString).trim().length !== 16) {
    showToast("NIK harus 16 digit angka!", "error");
    return;
  }

  if (loadingSpinner) loadingSpinner.classList.remove("hidden");
  if (resultCard) resultCard.classList.add("hidden");

  try {
    const res = await processor.parseNik({ nik: nikString });

    if (res.status !== "sukses") {
      showToast(res.message || "Gagal memproses NIK.", "error");
      return;
    }

    const data = res.data;
    renderNikResult(data);
    triggerHaptic("heavy");
  } catch (err) {
    showToast("Terjadi kesalahan saat memproses NIK.", "error");
  } finally {
    if (loadingSpinner) loadingSpinner.classList.add("hidden");
  }
}

function renderNikResult(d) {
  const resultCard = document.getElementById("nikResultCard");
  if (!resultCard) return;

  const loc = d.lokasi || {};
  const turunan = d.detailTurunan || {};
  const usia = turunan.usia || {};
  const ultah = turunan.ulangTahunBerikutnya || {};

  const villagesList = Object.values(loc.daftar_desa_kelurahan || {});

  resultCard.innerHTML = `
    <div style="padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
        <div>
          <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-secondary);">Nomor Induk Kependudukan</span>
          <h3 style="font-size: 1.4rem; font-weight: 700; font-family: 'Space Mono', monospace;">${escapeHtml(d.nik)}</h3>
        </div>
        <div style="font-size: 2rem;">${d.jenisKelamin === "Perempuan" ? "👩" : "👨"}</div>
      </div>

      <!-- General Info Badges -->
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
        <div class="stat-pill"><span>Gender:</span> <strong>${escapeHtml(d.jenisKelamin)}</strong></div>
        <div class="stat-pill"><span>Tgl Lahir:</span> <strong>${escapeHtml(d.tanggalLahir)}</strong></div>
        <div class="stat-pill"><span>Kode Unik:</span> <strong>${escapeHtml(d.kodeUnik)}</strong></div>
      </div>

      <!-- Region Info Section -->
      <div style="background: var(--surface); border: 1px solid var(--border-color); padding: 14px; border-radius: 14px; margin-bottom: 16px;">
        <h4 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; color: var(--primary);">📍 Informasi Wilayah KTP</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.88rem;">
          <div><span style="color:var(--text-secondary);">Provinsi:</span><br><strong>${escapeHtml(loc.provinsi?.nama || "-")}</strong></div>
          <div><span style="color:var(--text-secondary);">Kota/Kabupaten:</span><br><strong>${escapeHtml(loc.kota_kabupaten?.nama || "-")}</strong></div>
          <div><span style="color:var(--text-secondary);">Kecamatan:</span><br><strong>${escapeHtml(loc.kecamatan?.nama || "-")}</strong></div>
          <div><span style="color:var(--text-secondary);">Kode Wilayah:</span><br><strong>${escapeHtml(loc.kecamatan?.id || "-")}</strong></div>
        </div>

        ${
          villagesList.length > 0
            ? `
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--border-color);">
            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">Daftar Kelurahan/Desa (${villagesList.length}):</span>
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; max-height: 120px; overflow-y: auto;">
              ${villagesList.map((v) => `<span style="font-size: 0.75rem; padding: 3px 8px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 6px; font-weight: 600;">${escapeHtml(v)}</span>`).join("")}
            </div>
          </div>
        `
            : ""
        }
      </div>

      <!-- Derived Details (Age, Pasaran, Zodiac) -->
      <div style="background: var(--surface); border: 1px solid var(--border-color); padding: 14px; border-radius: 14px;">
        <h4 style="font-size: 0.9rem; font-weight: 700; text-transform: uppercase; margin-bottom: 10px; color: var(--primary);">🔮 Detail Turunan & Usia</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.88rem;">
          <div><span style="color:var(--text-secondary);">Usia Saat Ini:</span><br><strong>${escapeHtml(usia.lengkap || "-")}</strong></div>
          <div><span style="color:var(--text-secondary);">Weton / Pasaran:</span><br><strong>${escapeHtml(turunan.pasaranJawa || "-")}</strong></div>
          <div><span style="color:var(--text-secondary);">Zodiak:</span><br><strong>${escapeHtml(turunan.zodiak || "-")}</strong></div>
          <div><span style="color:var(--text-secondary);">Ultah Berikutnya:</span><br><strong>${escapeHtml(ultah.hitungMundur || "-")}</strong></div>
        </div>
      </div>
    </div>
  `;

  resultCard.classList.remove("hidden");
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag));
}

export function initNikParserEvents() {
  const btnParse = document.getElementById("btnNikParse");
  const inputNik = document.getElementById("nikInput");
  const btnPaste = document.getElementById("btnNikPaste");

  if (btnParse && inputNik) {
    btnParse.addEventListener("click", () => {
      processNikParsing(inputNik.value);
    });
    inputNik.addEventListener("keypress", (e) => {
      if (e.key === "Enter") processNikParsing(inputNik.value);
    });
  }

  if (btnPaste && inputNik) {
    btnPaste.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          inputNik.value = text.trim();
          showToast("NIK pasted!");
        }
      } catch (err) {
        showToast("Cannot read clipboard", "error");
      }
    });
  }
}
