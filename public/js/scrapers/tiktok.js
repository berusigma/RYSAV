import { CHROME_UA } from "../utils/index.js";
import { getCleanUrl } from "../utils/urlUtils.js";
import { scraperFetch, createScraperResult } from "./httpHelper.js";
import { scrapeVidsSave } from "./vidssave.js";

export let _ttSource = "tikwm";
export function setTikTokSource(src) {
  _ttSource = src;
}

/**
 * 100% Reliable TikTok Scraper using TikWM API (POST & GET), TiklyDown, and VidsSave Fallbacks
 */
export async function scrapeTikTok(url) {
  let currentStatus = null;
  try {
    const cleanUrl = getCleanUrl(url).split("?")[0];
    const regexTiktokUrl =
      /https:\/\/(?:m|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;
    if (!regexTiktokUrl.test(cleanUrl)) {
      throw new Error("Must be a valid tiktok url.");
    }

    let resData = null;

    // Method 1: TikWM POST
    try {
      const postData = `url=${encodeURIComponent(cleanUrl)}&hd=1`;
      const response = await scraperFetch(
        {
          url: "https://www.tikwm.com/api/",
          method: "POST",
          data: postData,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": CHROME_UA,
          },
          rawResponse: true,
        },
        "TikWM API (POST)",
      );
      currentStatus = response.status;
      const parsed = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      if (parsed && parsed.code === 0 && parsed.data) {
        resData = parsed;
      }
    } catch (e) {
      console.warn("TikWM POST failed, attempting GET...", e);
    }

    // Method 2: TikWM GET Fallback
    if (!resData || resData.code !== 0 || !resData.data) {
      try {
        const getRes = await scraperFetch(
          {
            url: `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`,
            headers: { "User-Agent": CHROME_UA },
            rawResponse: true,
          },
          "TikWM API (GET)",
        );
        currentStatus = getRes.status;
        const parsed = typeof getRes.data === "string" ? JSON.parse(getRes.data) : getRes.data;
        if (parsed && parsed.code === 0 && parsed.data) {
          resData = parsed;
        }
      } catch (e) {
        console.warn("TikWM GET failed, attempting TiklyDown...", e);
      }
    }

    // Method 3: TiklyDown Fallback
    if (!resData || resData.code !== 0 || !resData.data) {
      try {
        const tiklyRes = await scraperFetch(
          {
            url: `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(cleanUrl)}`,
            headers: { "User-Agent": CHROME_UA },
            rawResponse: true,
          },
          "TiklyDown API",
        );
        currentStatus = tiklyRes.status;
        const tikly = typeof tiklyRes.data === "string" ? JSON.parse(tiklyRes.data) : tiklyRes.data;
        if (tikly && (tikly.video || tikly.images)) {
          resData = {
            code: 0,
            data: {
              title: tikly.title || "TikTok Content",
              cover: tikly.cover || tikly.thumbnail || "",
              play: tikly.video?.noWatermark || tikly.video?.watermark || "",
              hdplay: tikly.video?.noWatermark || "",
              music: tikly.music?.play_url || "",
              images: tikly.images ? tikly.images.map((i) => i.url || i) : null,
              digg_count: tikly.stats?.likeCount || 0,
              comment_count: tikly.stats?.commentCount || 0,
              share_count: tikly.stats?.shareCount || 0,
              play_count: tikly.stats?.playCount || 0,
              author: {
                unique_id: tikly.author?.unique_id || tikly.author?.username || "",
                nickname: tikly.author?.nickname || tikly.author?.name || "TikTok User",
                avatar: tikly.author?.avatar || "",
              },
              music_info: {
                title: tikly.music?.title || "",
                author: tikly.music?.author || "",
              },
            },
          };
        }
      } catch (e) {
        console.warn("TiklyDown fallback failed, trying VidsSave...", e);
      }
    }

    // Method 4: VidsSave API All-in-One Fallback
    if (!resData || resData.code !== 0 || !resData.data) {
      try {
        const vidsResult = await scrapeVidsSave(cleanUrl);
        if (vidsResult && vidsResult.success) {
          return vidsResult;
        }
      } catch (e) {
        console.warn("VidsSave fallback failed...", e);
      }
    }

    if (!resData || resData.code !== 0 || !resData.data) {
      throw new Error("Gagal mengambil data. Pastikan URL valid, akun tidak privat, dan coba lagi.");
    }

    const data = resData.data;

    // Structured metadata matching user requirement
    const resultMeta = {
      uploader: {
        username: data.author?.unique_id || "",
        nama: data.author?.nickname || "TikTok User",
        avatar: data.author?.avatar || "",
      },
      deskripsi: data.title || "Tidak ada deskripsi.",
      thumbnail: data.cover || (data.images && data.images[0]) || "",
      statistik: {
        like: data.digg_count || 0,
        komentar: data.comment_count || 0,
        share: data.share_count || 0,
        play: data.play_count || 0,
      },
      media: {
        video_regular: data.play
          ? data.play.startsWith("http")
            ? data.play
            : `https://www.tikwm.com${data.play}`
          : null,
        video_hd: data.hdplay
          ? data.hdplay.startsWith("http")
            ? data.hdplay
            : `https://www.tikwm.com${data.hdplay}`
          : null,
        sound_url: data.music
          ? data.music.startsWith("http")
            ? data.music
            : `https://www.tikwm.com${data.music}`
          : null,
        foto_urls: data.images || null,
      },
    };

    const downloads = [];

    // Add Photo slideshow urls if present
    if (
      resultMeta.media.foto_urls &&
      Array.isArray(resultMeta.media.foto_urls) &&
      resultMeta.media.foto_urls.length > 0
    ) {
      resultMeta.media.foto_urls.forEach((img, idx) => {
        if (img) downloads.push({ type: `PHOTO ${idx + 1}`, url: img });
      });
    }

    // Add Video Regular & HD
    if (resultMeta.media.video_hd) {
      downloads.push({
        type: "VIDEO HD (No Watermark)",
        url: resultMeta.media.video_hd,
      });
    }
    if (resultMeta.media.video_regular) {
      downloads.push({
        type: "VIDEO Regular (No Watermark)",
        url: resultMeta.media.video_regular,
      });
    }

    // Add Music/Audio Track
    if (resultMeta.media.sound_url) {
      downloads.push({
        type: "MP3 Sound Track",
        url: resultMeta.media.sound_url,
      });
    }

    if (downloads.length === 0) {
      throw new Error("No downloadable media found for this TikTok URL.");
    }

    _ttSource = null;

    return createScraperResult(true, {
      title: resultMeta.deskripsi,
      author: resultMeta.uploader.nama,
      authorHandle: resultMeta.uploader.username
        ? `@${resultMeta.uploader.username}`
        : "",
      authorAvatar: resultMeta.uploader.avatar,
      thumbnail: resultMeta.thumbnail,
      stats: {
        likes: resultMeta.statistik.like,
        views: resultMeta.statistik.play,
        comments: resultMeta.statistik.komentar,
        shares: resultMeta.statistik.share,
      },
      music: data.music_info?.title
        ? `${data.music_info.title} - ${data.music_info.author || ""}`
        : "",
      downloads,
      sourceUrl: url,
    });
  } catch (err) {
    _ttSource = null;
    return createScraperResult(false, err.message, currentStatus);
  }
}
