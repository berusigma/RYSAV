import { CHROME_UA } from "../utils/index.js";
import { getCleanUrl } from "../utils/urlUtils.js";
import { scraperFetch, createScraperResult } from "./httpHelper.js";
import { scrapeVidsSave } from "./vidssave.js";

export let _ttSource = "snaptik_tikwm";
export function setTikTokSource(src) {
  _ttSource = src;
}

/**
 * Snaptik Downloader (ajaxSearch)
 */
export async function snaptikDown(url) {
  try {
    const postData = `q=${encodeURIComponent(url)}&lang=en`;
    const response = await scraperFetch(
      {
        url: "https://snaptik.net/api/ajaxSearch",
        method: "POST",
        data: postData,
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "x-requested-with": "XMLHttpRequest",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0",
          origin: "https://snaptik.net",
          referer: "https://snaptik.net/",
        },
        rawResponse: true,
      },
      "Snaptik API",
    );

    const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
    if (!data || data.status !== "ok" || !data.data) {
      throw new Error("Snaptik search failed");
    }

    const html = data.data;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const imgEl = doc.querySelector(".image-tik img");
    const thumbnail = imgEl ? imgEl.getAttribute("src") : null;

    const linkEls = Array.from(doc.querySelectorAll(".tik-button-dl"));
    const links = linkEls.map((el) => el.getAttribute("href")).filter(Boolean);

    return {
      success: true,
      results: {
        thumbnail,
        video: links[0] || links[1] || null,
        hdVideo: links[1] || null,
        audio: links[2] || links.find((l) => l.includes("music") || l.includes("audio")) || null,
        allLinks: links,
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * iPhone17ProMex - Base64 TikWM Metadata Extractor
 */
export async function iPhone17ProMex(i) {
  const y = atob("aHR0cHM6Ly93d3cudGlrd20uY29tL2FwaS8="); // https://www.tikwm.com/api/
  const res = await scraperFetch(
    {
      url: `${y}?url=${encodeURIComponent(i)}&hd=1`,
      headers: { "User-Agent": CHROME_UA },
      rawResponse: true,
    },
    "TikWM Metadata (iPhone17ProMex)",
  );

  const data = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  if (!data || data.code !== 0 || !data.data) {
    throw new Error("Get Metadata failed");
  }

  return data.data;
}

export async function getMeta(url) {
  try {
    const d = await iPhone17ProMex(url);

    return {
      success: true,
      result: {
        title: d.title || "TikTok Video",
        author: d.author?.unique_id || d.author?.nickname || "TikTok User",
        authorHandle: d.author?.unique_id ? `@${d.author.unique_id}` : "",
        authorAvatar: d.author?.avatar || "",
        thumbnail: d.cover || (d.images && d.images[0]) || "",
        caption: d.title,
        stats: {
          views: d.play_count || 0,
          likes: d.digg_count || 0,
          comments: d.comment_count || 0,
          shares: d.share_count || 0,
        },
        video: d.play ? (d.play.startsWith("http") ? d.play : `https://www.tikwm.com${d.play}`) : null,
        hdVideo: d.hdplay ? (d.hdplay.startsWith("http") ? d.hdplay : `https://www.tikwm.com${d.hdplay}`) : null,
        audio: d.music ? (d.music.startsWith("http") ? d.music : `https://www.tikwm.com${d.music}`) : null,
        images: d.images || null,
      },
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function scrapeTikTok(url) {
  try {
    const cleanUrl = getCleanUrl(url).split("?")[0];
    const regexTiktokUrl =
      /https:\/\/(?:m|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;
    if (!regexTiktokUrl.test(cleanUrl)) {
      throw new Error("Must be a valid tiktok url.");
    }

    // Run meta & snaptik download in parallel (efficient CPU & fast response)
    const [metaRes, snapRes] = await Promise.all([
      getMeta(cleanUrl),
      snaptikDown(cleanUrl),
    ]);

    const downloads = [];
    const metaData = metaRes.success ? metaRes.result : {};
    const snapData = snapRes.success ? snapRes.results : {};

    // 1. Add primary downloads (clean labels)
    if (snapData.hdVideo) {
      downloads.push({ type: "VIDEO HD (No Watermark)", url: snapData.hdVideo });
    }
    if (snapData.video && snapData.video !== snapData.hdVideo) {
      downloads.push({ type: "VIDEO Regular (No Watermark)", url: snapData.video });
    }
    if (snapData.audio) {
      downloads.push({ type: "MP3 Sound Track", url: snapData.audio });
    }

    // 2. Add secondary downloads if not already added
    if (metaData.hdVideo && !downloads.some((d) => d.url === metaData.hdVideo)) {
      downloads.push({ type: "VIDEO Ultra HD", url: metaData.hdVideo });
    }
    if (metaData.video && !downloads.some((d) => d.url === metaData.video)) {
      downloads.push({ type: "VIDEO Standard", url: metaData.video });
    }
    if (metaData.audio && !downloads.some((d) => d.url === metaData.audio)) {
      downloads.push({ type: "MP3 Audio Track", url: metaData.audio });
    }
    if (metaData.images && Array.isArray(metaData.images)) {
      metaData.images.forEach((img, idx) => {
        if (img) downloads.push({ type: `PHOTO ${idx + 1}`, url: img });
      });
    }

    // Fallback to VidsSave API if both failed or returned empty downloads
    if (downloads.length === 0) {
      const vidsResult = await scrapeVidsSave(cleanUrl);
      if (vidsResult && vidsResult.success) return vidsResult;
      throw new Error("Gagal mengambil media TikTok. Pastikan URL publik dan coba lagi.");
    }

    return createScraperResult(true, {
      title: metaData.title || metaData.caption || "TikTok Video",
      author: metaData.author || "TikTok Creator",
      authorHandle: metaData.authorHandle || "",
      authorAvatar: metaData.authorAvatar || "",
      thumbnail: metaData.thumbnail || snapData.thumbnail || "",
      stats: metaData.stats || { likes: 0, views: 0, comments: 0, shares: 0 },
      downloads,
      sourceUrl: url,
    });
  } catch (err) {
    // Ultimate Fallback to VidsSave
    try {
      const vidsRes = await scrapeVidsSave(url);
      if (vidsRes && vidsRes.success) return vidsRes;
    } catch (e) {
      // ignore
    }
    return createScraperResult(false, err.message);
  }
}
