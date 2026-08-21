/**
 * stream.js — LK21 Movie & TV Series Streaming Module
 */
import { showToast, triggerHaptic } from "../utils/index.js";

const TMDB_API_KEY = "82524e2faef91706a2d52d52496130ac";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";

const SERVERS = {
  vidsrc: {
    name: "Server 1 (VidSrc)",
    movie: "https://vidsrc.me/embed/movie?tmdb={id}",
    tv: "https://vidsrc.me/embed/tv?tmdb={id}&season={s}&episode={e}",
  },
  embedsu: {
    name: "Server 2 (Embed.su)",
    movie: "https://embed.su/embed/movie/{id}",
    tv: "https://embed.su/embed/tv/{id}/{s}/{e}",
  },
  vidsrcpro: {
    name: "Server 3 (VidSrc Pro)",
    movie: "https://vidsrc.pro/embed/movie/{id}",
    tv: "https://vidsrc.pro/embed/tv/{id}/{s}/{e}",
  },
};

export class LK21Stream {
  async _tmdb(endpoint, params = {}) {
    try {
      const urlParams = new URLSearchParams({
        api_key: TMDB_API_KEY,
        language: "id-ID",
        ...params,
      });
      const res = await fetch(`${TMDB_BASE}${endpoint}?${urlParams.toString()}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error(`TMDB error: ${e.message}`);
      return null;
    }
  }

  async search(query) {
    const data = await this._tmdb("/search/multi", { query, page: 1 });
    if (!data?.results) return [];
    return data.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .map((r) => {
        const title = r.title || r.name;
        const year = (r.release_date || r.first_air_date || "").split("-")[0];
        return {
          id: r.id,
          title,
          year: year || "N/A",
          type: r.media_type,
          rating: r.vote_average ? r.vote_average.toFixed(1) : "N/A",
          poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
          overview: r.overview || "Sinopsis tidak tersedia.",
        };
      });
  }

  async detail(id, type = "movie") {
    const data = await this._tmdb(`/${type}/${id}`);
    if (!data) return null;
    const title = data.title || data.name;
    const releaseDate = data.release_date || data.first_air_date;
    const year = releaseDate ? releaseDate.split("-")[0] : "N/A";
    const runtime = type === "movie" ? data.runtime : data.episode_run_time?.[0];
    const genres = data.genres?.map((g) => g.name) || [];
    const credits = await this._tmdb(`/${type}/${id}/credits`);
    const cast = credits?.cast?.slice(0, 8).map((a) => ({
      name: a.name,
      character: a.character,
      photo: a.profile_path ? `${TMDB_IMG}${a.profile_path}` : null,
    })) || [];

    const servers = {};
    for (const [name, tmpl] of Object.entries(SERVERS)) {
      if (type === "movie") {
        servers[name] = tmpl.movie.replace("{id}", id);
      } else {
        servers[name] = tmpl.tv.replace("{id}", id).replace("{s}", 1).replace("{e}", 1);
      }
    }

    return {
      id,
      title,
      type,
      year,
      rating: data.vote_average ? data.vote_average.toFixed(1) : "N/A",
      runtime: runtime ? `${runtime} mnt` : "N/A",
      genres,
      overview: data.overview || "Sinopsis tidak tersedia.",
      poster: data.poster_path ? `${TMDB_IMG}${data.poster_path}` : null,
      backdrop: data.backdrop_path ? `${TMDB_IMG}${data.backdrop_path}` : null,
      seasons: type === "tv" ? data.number_of_seasons : undefined,
      episodes: type === "tv" ? data.number_of_episodes : undefined,
      cast,
      servers,
      streamUrl: servers.vidsrc,
    };
  }

  getStreamUrl(id, type = "movie", server = "vidsrc", season = 1, episode = 1) {
    const tmpl = SERVERS[server] || SERVERS.vidsrc;
    if (type === "movie") return tmpl.movie.replace("{id}", id);
    return tmpl.tv.replace("{id}", id).replace("{s}", season).replace("{e}", episode);
  }

  async trending() {
    const data = await this._tmdb("/trending/all/week");
    if (!data?.results) return [];
    return data.results
      .filter((r) => r.media_type === "movie" || r.media_type === "tv")
      .slice(0, 20)
      .map((r) => ({
        id: r.id,
        title: r.title || r.name,
        type: r.media_type,
        rating: r.vote_average ? r.vote_average.toFixed(1) : "N/A",
        poster: r.poster_path ? `${TMDB_IMG}${r.poster_path}` : null,
      }));
  }
}

const api = new LK21Stream();
let activeMovie = null;

export async function loadTrendingMovies() {
  const container = document.getElementById("streamMovieGrid");
  const spinner = document.getElementById("streamSpinner");
  if (!container) return;

  if (spinner) spinner.classList.remove("hidden");
  container.innerHTML = "";

  try {
    const movies = await api.trending();
    renderMovieGrid(movies);
  } catch (err) {
    showToast("Gagal memuat film trending.", "error");
  } finally {
    if (spinner) spinner.classList.add("hidden");
  }
}

export async function searchMovies(query) {
  const container = document.getElementById("streamMovieGrid");
  const spinner = document.getElementById("streamSpinner");
  if (!query || !query.trim()) {
    loadTrendingMovies();
    return;
  }

  if (spinner) spinner.classList.remove("hidden");
  if (container) container.innerHTML = "";

  try {
    const results = await api.search(query.trim());
    renderMovieGrid(results);
    triggerHaptic("medium");
  } catch (err) {
    showToast("Gagal mencari film.", "error");
  } finally {
    if (spinner) spinner.classList.add("hidden");
  }
}

function renderMovieGrid(items) {
  const container = document.getElementById("streamMovieGrid");
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 30px; color: var(--text-secondary);">Tidak ada film ditemukan.</div>`;
    return;
  }

  container.innerHTML = items
    .map((item) => `
      <div class="movie-card media-card" data-id="${item.id}" data-type="${item.type}" style="padding: 0; overflow: hidden; cursor: pointer; position: relative; border-radius: 14px; transition: all 0.2s ease;">
        <div style="aspect-ratio: 2/3; width: 100%; background: var(--surface); position: relative; overflow: hidden;">
          ${
            item.poster
              ? `<img src="${item.poster}" alt="${escapeHtml(item.title)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" />`
              : `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-secondary);">No Poster</div>`
          }
          <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.75); color: #f59e0b; padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 800; backdrop-filter: blur(4px);">
            ⭐ ${escapeHtml(item.rating)}
          </div>
          <div style="position: absolute; top: 8px; left: 8px; background: var(--primary); color: var(--on-primary); padding: 2px 6px; border-radius: 6px; font-size: 0.68rem; font-weight: 800; text-transform: uppercase;">
            ${escapeHtml(item.type)}
          </div>
        </div>
        <div style="padding: 10px 12px;">
          <h4 style="font-size: 0.88rem; font-weight: 700; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(item.title)}</h4>
        </div>
      </div>
    `)
    .join("");

  container.querySelectorAll(".movie-card").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-id");
      const type = card.getAttribute("data-type");
      openMovieDetailModal(id, type);
    });
  });
}

export async function openMovieDetailModal(id, type) {
  const modal = document.getElementById("streamPlayerModal");
  const spinner = document.getElementById("streamDetailSpinner");
  const content = document.getElementById("streamDetailContent");

  if (!modal) return;

  modal.classList.remove("hidden");
  if (spinner) spinner.classList.remove("hidden");
  if (content) content.classList.add("hidden");

  try {
    const detail = await api.detail(id, type);
    if (!detail) {
      showToast("Gagal memuat detail film.", "error");
      modal.classList.add("hidden");
      return;
    }

    activeMovie = detail;
    renderMovieDetail(detail);
    triggerHaptic("heavy");
  } catch (err) {
    showToast("Terjadi kesalahan.", "error");
    modal.classList.add("hidden");
  } finally {
    if (spinner) spinner.classList.add("hidden");
    if (content) content.classList.remove("hidden");
  }
}

function renderMovieDetail(d) {
  const content = document.getElementById("streamDetailContent");
  if (!content) return;

  const defaultStreamUrl = api.getStreamUrl(d.id, d.type, "vidsrc", 1, 1);

  content.innerHTML = `
    <!-- Video Player Frame -->
    <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 14px; overflow: hidden; margin-bottom: 16px;">
      <iframe id="streamIframe" src="${defaultStreamUrl}" style="width: 100%; height: 100%; border: none;" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe>
    </div>

    <!-- Server & Episode Selectors -->
    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">
      <div style="flex: 1; min-width: 140px;">
        <label style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--text-secondary); display: block; margin-bottom: 4px;">Pilih Server:</label>
        <select id="streamServerSelect" class="custom-select-input" style="padding: 8px 12px; font-size: 0.8rem;">
          <option value="vidsrc">Server 1 (VidSrc)</option>
          <option value="embedsu">Server 2 (Embed.su)</option>
          <option value="vidsrcpro">Server 3 (VidSrc Pro)</option>
        </select>
      </div>

      ${
        d.type === "tv"
          ? `
        <div style="width: 90px;">
          <label style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--text-secondary); display: block; margin-bottom: 4px;">Season:</label>
          <input type="number" id="streamSeasonInput" value="1" min="1" max="${d.seasons || 10}" class="custom-text-input" style="padding: 8px; font-size: 0.85rem; text-align: center;" />
        </div>
        <div style="width: 90px;">
          <label style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--text-secondary); display: block; margin-bottom: 4px;">Episode:</label>
          <input type="number" id="streamEpisodeInput" value="1" min="1" max="${d.episodes || 100}" class="custom-text-input" style="padding: 8px; font-size: 0.85rem; text-align: center;" />
        </div>
      `
          : ""
      }
    </div>

    <!-- Movie Meta Info -->
    <div style="display: flex; gap: 14px; margin-bottom: 16px;">
      ${
        d.poster
          ? `<img src="${d.poster}" style="width: 80px; height: 120px; object-fit: cover; border-radius: 10px; flex-shrink: 0;" />`
          : ""
      }
      <div>
        <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 4px;">${escapeHtml(d.title)} (${escapeHtml(d.year)})</h3>
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
          <span class="stat-pill" style="font-size: 0.7rem; padding: 2px 8px;">⭐ ${escapeHtml(d.rating)}</span>
          <span class="stat-pill" style="font-size: 0.7rem; padding: 2px 8px;">⏱️ ${escapeHtml(d.runtime)}</span>
          <span class="stat-pill" style="font-size: 0.7rem; padding: 2px 8px;">${escapeHtml(d.type.toUpperCase())}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">Genre: ${escapeHtml(d.genres.join(", "))}</p>
      </div>
    </div>

    <!-- Synopsis -->
    <div style="margin-bottom: 16px;">
      <h4 style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; color: var(--text-secondary);">Sinopsis</h4>
      <p style="font-size: 0.88rem; line-height: 1.5; color: var(--text-main);">${escapeHtml(d.overview)}</p>
    </div>

    <!-- Cast List -->
    ${
      d.cast && d.cast.length > 0
        ? `
      <div>
        <h4 style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; color: var(--text-secondary);">Pemeran Utama</h4>
        <div style="display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px;">
          ${d.cast
            .map(
              (c) => `
            <div style="flex-shrink: 0; text-align: center; width: 70px;">
              ${
                c.photo
                  ? `<img src="${c.photo}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover; margin: 0 auto 4px;" />`
                  : `<div style="width: 50px; height: 50px; border-radius: 50%; background: var(--surface); margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">👤</div>`
              }
              <div style="font-size: 0.7rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.name)}</div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `
        : ""
    }
  `;

  // Server & Episode Change Handler
  const updateIframeSrc = () => {
    const iframe = document.getElementById("streamIframe");
    const server = document.getElementById("streamServerSelect")?.value || "vidsrc";
    const season = document.getElementById("streamSeasonInput")?.value || 1;
    const episode = document.getElementById("streamEpisodeInput")?.value || 1;

    if (iframe) {
      iframe.src = api.getStreamUrl(d.id, d.type, server, parseInt(season), parseInt(episode));
    }
  };

  document.getElementById("streamServerSelect")?.addEventListener("change", updateIframeSrc);
  document.getElementById("streamSeasonInput")?.addEventListener("change", updateIframeSrc);
  document.getElementById("streamEpisodeInput")?.addEventListener("change", updateIframeSrc);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag));
}

export function initStreamEvents() {
  const btnSearch = document.getElementById("btnStreamSearch");
  const inputSearch = document.getElementById("streamSearchInput");
  const btnCloseModal = document.getElementById("btnCloseStreamModal");
  const btnMiniPlayer = document.getElementById("btnMiniPlayer");
  const modal = document.getElementById("streamPlayerModal");

  if (btnSearch && inputSearch) {
    btnSearch.addEventListener("click", () => {
      searchMovies(inputSearch.value);
    });
    inputSearch.addEventListener("keypress", (e) => {
      if (e.key === "Enter") searchMovies(inputSearch.value);
    });
  }

  if (btnMiniPlayer && modal) {
    btnMiniPlayer.addEventListener("click", () => {
      modal.classList.toggle("mini-player-mode");
      const isMini = modal.classList.contains("mini-player-mode");
      btnMiniPlayer.innerHTML = isMini
        ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg> Full`
        : `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="12" y="12" width="6" height="6"></rect></svg> Mini`;
      showToast(isMini ? "Mini Player Aktif" : "Full Screen Player");
    });
  }

  if (btnCloseModal) {
    btnCloseModal.addEventListener("click", () => {
      const iframe = document.getElementById("streamIframe");
      if (iframe) iframe.src = "";
      if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("mini-player-mode");
      }
    });
  }

  loadTrendingMovies();
}
