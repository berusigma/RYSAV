import { CHROME_UA } from "../utils/index.js";
import { scraperFetch, createScraperResult } from "./httpHelper.js";

/**
 * All-in-One Downloader API using Vidssave.com
 */
export async function scrapeVidsSave(url) {
  try {
    const payload = new URLSearchParams({
      auth: "20250901majwlqo",
      domain: "api-ak.vidssave.com",
      origin: "source",
      link: url,
    });

    const res = await scraperFetch(
      {
        url: "https://api.vidssave.com/api/contentsite_api/media/parse",
        method: "POST",
        data: payload.toString(),
        headers: {
          accept: "*/*",
          "accept-language": "id-ID",
          "cache-control": "no-cache",
          "content-type": "application/x-www-form-urlencoded",
          origin: "https://vidssave.com",
          pragma: "no-cache",
          referer: "https://vidssave.com/",
          "user-agent": CHROME_UA,
        },
        rawResponse: true,
      },
      "VidsSave API",
    );

    const resData = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    const data = resData?.data || resData;

    if (!data) throw new Error("VidsSave API returned empty data.");

    // Parse VidsSave response into standard RYSAV result format
    const title = data.title || data.desc || data.description || "Media Content";
    const thumbnail = data.cover || data.thumbnail || data.picture || data.img || "";
    const author = data.author?.name || data.author?.nickname || data.uploader || "Creator";
    const authorAvatar = data.author?.avatar || data.author?.picture || "";
    const authorHandle = data.author?.unique_id ? `@${data.author.unique_id}` : "";

    const downloads = [];

    // Parse video resources
    if (data.media || data.urls || data.download_urls || data.video) {
      const mediaList = data.media || data.urls || data.download_urls || [data.video];
      if (Array.isArray(mediaList)) {
        mediaList.forEach((m, idx) => {
          if (!m) return;
          const downloadUrl = typeof m === "string" ? m : m.url || m.link || m.src;
          const quality = m.quality || m.resolution || m.format || `Video ${idx + 1}`;
          if (downloadUrl) {
            downloads.push({ type: `VIDEO (${quality})`, url: downloadUrl });
          }
        });
      }
    }

    if (data.url || data.video_url || data.play) {
      const vUrl = data.url || data.video_url || data.play;
      if (!downloads.some((d) => d.url === vUrl)) {
        downloads.push({ type: "VIDEO (No Watermark)", url: vUrl });
      }
    }

    if (data.hd_url || data.hdplay) {
      const hdUrl = data.hd_url || data.hdplay;
      if (!downloads.some((d) => d.url === hdUrl)) {
        downloads.push({ type: "VIDEO HD", url: hdUrl });
      }
    }

    if (data.music || data.audio || data.audio_url) {
      const aUrl = data.music || data.audio || data.audio_url;
      downloads.push({ type: "MP3 Audio Track", url: typeof aUrl === "string" ? aUrl : aUrl.url });
    }

    if (data.images && Array.isArray(data.images)) {
      data.images.forEach((img, idx) => {
        const imgUrl = typeof img === "string" ? img : img.url;
        if (imgUrl) downloads.push({ type: `PHOTO ${idx + 1}`, url: imgUrl });
      });
    }

    if (downloads.length === 0) {
      throw new Error("No media downloads found from VidsSave API.");
    }

    return createScraperResult(true, {
      title,
      author,
      authorHandle,
      authorAvatar,
      thumbnail,
      stats: {
        likes: data.like_count || data.digg_count || 0,
        views: data.play_count || data.view_count || 0,
        comments: data.comment_count || 0,
        shares: data.share_count || 0,
      },
      downloads,
      sourceUrl: url,
    });
  } catch (err) {
    return createScraperResult(false, err.message);
  }
}
