/**
 * वीडियो का लिंक पहचानिए / work out what a pasted video link actually is.
 *
 * निदेशक जी सिर्फ़ लिंक चिपकाते हैं — YouTube का हो या Instagram reel का। यह
 * तय करना कि वह किस तरह का है, code का काम है, उनका नहीं।
 *
 * The author pastes whatever they copied. Asking them to also declare which
 * platform it came from would be asking them to do work the URL already
 * answers. YouTube alone has five common shapes (watch, youtu.be, /embed/,
 * /shorts/, /live/), and people paste them with tracking parameters attached,
 * so this parses rather than pattern-matches loosely.
 */

/**
 * `posterUrl` — चलाने से पहले दिखने वाली तस्वीर / the still shown before play.
 *
 * YouTube हर वीडियो की तस्वीर एक तय पते पर देता है, इसलिए वह यहीं बन जाती है.
 * Instagram नहीं देता — उसके लिए token वाली oEmbed API चाहिए, जो एक स्थिर साइट
 * के build में नहीं चलानी — इसलिए वहाँ `undefined` रहता है और बुलाने वाला रचना
 * की अपनी तस्वीर लगा लेता है.
 *
 * YouTube publishes a still at a predictable address, so it is derived here.
 * Instagram does not — that needs its token-based oEmbed API, which a static
 * build has no business calling — so it is `undefined` and the caller falls
 * back to the post's own picture.
 */
export type VideoEmbed =
  | {
      provider: 'youtube';
      embedUrl: string;
      watchUrl: string;
      label: string;
      posterUrl: string;
    }
  | {
      provider: 'instagram';
      embedUrl: string;
      watchUrl: string;
      label: string;
      posterUrl?: undefined;
    };

/** YouTube का 11-अक्षरी id / YouTube ids are exactly 11 URL-safe characters. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '');

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? '';
    return YOUTUBE_ID.test(id) ? id : null;
  }

  if (!host.endsWith('youtube.com')) return null;

  // youtube.com/watch?v=<id>
  const fromQuery = url.searchParams.get('v');
  if (fromQuery && YOUTUBE_ID.test(fromQuery)) return fromQuery;

  // youtube.com/{embed,shorts,live,v}/<id>
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0]!)) {
    const id = parts[1]!;
    return YOUTUBE_ID.test(id) ? id : null;
  }

  return null;
}

/**
 * Instagram का shortcode / the code in /reel/<code>/ or /p/<code>/.
 * Reels, posts and TV all embed the same way; only the path segment differs.
 */
function instagramCode(url: URL): { kind: string; code: string } | null {
  if (!url.hostname.replace(/^www\./, '').endsWith('instagram.com')) return null;

  const parts = url.pathname.split('/').filter(Boolean);
  const kindIndex = parts.findIndex((p) => ['reel', 'reels', 'p', 'tv'].includes(p));
  if (kindIndex === -1) return null;

  const code = parts[kindIndex + 1];
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null;

  // "reels" और "reel" दोनों चलते हैं, पर embed हमेशा "reel" पर बनता है.
  const raw = parts[kindIndex]!;
  return { kind: raw === 'reels' ? 'reel' : raw, code };
}

/**
 * लिंक से embed बनाइए / turn a pasted link into something renderable.
 * Returns `null` for anything unrecognised, so the caller shows nothing rather
 * than an empty frame — a broken embed is worse than no embed.
 */
export function parseVideoUrl(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null; // not a URL at all
  }

  const yt = youtubeId(url);
  if (yt) {
    return {
      provider: 'youtube',
      // youtube-nocookie: जब तक कोई चलाए नहीं, tracking नहीं.
      // The no-cookie host does not set tracking cookies until playback starts,
      // which matters on a page someone opened to read a poem.
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
      watchUrl: `https://www.youtube.com/watch?v=${yt}`,
      label: 'YouTube',
      /* hqdefault हर वीडियो पर मिलती है; maxresdefault अक्सर 404 देती है और
         टूटी तस्वीर छोड़ जाती है. `hqdefault` exists for every video, where
         `maxresdefault` is often missing and leaves a broken image. */
      posterUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }

  const ig = instagramCode(url);
  if (ig) {
    return {
      provider: 'instagram',
      embedUrl: `https://www.instagram.com/${ig.kind}/${ig.code}/embed/`,
      watchUrl: `https://www.instagram.com/${ig.kind}/${ig.code}/`,
      label: ig.kind === 'reel' ? 'Instagram reel' : 'Instagram',
    };
  }

  return null;
}
