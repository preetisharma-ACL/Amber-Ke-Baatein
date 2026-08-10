import { contactRows as FALLBACK_ROWS, site } from '../data/site';

/**
 * संपर्क का पन्ना, CMS से / the contact page, from the CMS.
 *
 * ईमेल, Instagram, YouTube — ये तीनों पहले `data/site.ts` में लिखे थे। चौथा
 * ठिकाना जोड़ने के लिए code बदलना पड़ता था। अब ये `/admin` → संपर्क में हैं।
 *
 * These rows used to be a hardcoded array; adding a platform meant editing
 * code. They now come from the `contact` global in Payload.
 * See apps/cms/src/globals/SiteContact.ts.
 */

/** CMS कहाँ चल रहा है / where the CMS lives (root .env, PUBLIC_CMS_URL). */
const CMS_URL = import.meta.env.PUBLIC_CMS_URL ?? 'http://localhost:3456';

export interface ContactAction {
  label: string;
  href: string;
}

export interface ContactRow {
  label: string;
  /** जो पाठक पढ़ता है / what the reader sees, never the raw `mailto:` form. */
  text: string;
  href: string;
  /** नई खिड़की में खुले या नहीं / whether to open in a new tab. Derived, not typed. */
  external: boolean;
  /** पंक्ति के नीचे का बटन / the button under the row, when there is one. */
  action: ContactAction | null;
}

export interface ContactPage {
  heading: string;
  subheading: string;
  rows: ContactRow[];
  /** डिब्बे के नीचे की हल्की पंक्ति / the closing line. `''` renders nothing. */
  note: string;
}

interface CmsContactRow {
  label?: string | null;
  text?: string | null;
  href?: string | null;
  buttonLabel?: string | null;
  buttonHref?: string | null;
}

interface CmsContact {
  heading?: string | null;
  subheading?: string | null;
  rows?: CmsContactRow[] | null;
  note?: string | null;
}

/**
 * ⚠️ ये आख़िरी सहारा हैं, स्रोत नहीं / the last resort, not the source.
 * CMS न पहुँचे तो पन्ना खाली न दिखे — इसलिए वही तीन पंक्तियाँ जो पहले code में
 * थीं। बदलने के लिए `/admin` → संपर्क खोलिए, यह फ़ाइल नहीं।
 */
const FALLBACK: ContactPage = {
  heading: 'संपर्क',
  subheading: 'कुछ कहना हो तो',
  note: 'कोई रचना अच्छी लगे तो बता दीजिएगा — लिखने वाले के लिए इतना ही बहुत होता है।',
  rows: FALLBACK_ROWS.map((row) => ({
    label: row.label,
    text: row.text,
    href: row.href,
    external: row.external,
    action: 'action' in row && row.action ? { ...row.action } : null,
  })),
};

/** खाली को खाली ही मानिए / treat blank and whitespace-only as absent. */
function pick(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** सादा ईमेल पता — बिना scheme के / a bare email address, no scheme. */
const BARE_EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/;

/** पहले से पूरा पता / already carries a scheme (https:, mailto:, tel:, …). */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * जो टाइप किया गया उसे चलने लायक़ पते में बदलिए / turn what was typed into a
 * link a browser will actually follow.
 *
 * निदेशक जी से यह उम्मीद करना ग़लत है कि वे `mailto:` लगाना याद रखें, या यह जानें
 * कि पते के आगे `https://` क्यों चाहिए। इसलिए CMS की जाँच ढीली है और सफ़ाई यहाँ
 * होती है — एक ही जगह, ताकि पुराने और नए दोनों तरह के लिखे पते चलें।
 *
 * The author should not have to know what a URL scheme is. The CMS validator is
 * deliberately loose (see SiteContact.ts) and the cleanup happens here:
 *
 *   alok@aajneeti.social        → mailto:alok@aajneeti.social
 *   instagram.com/ambar         → https://instagram.com/ambar
 *   https://…  /  mailto:…  /  tel:…  /  /page  /  #anchor   → left alone
 *
 * `null` का मतलब है "इसे छापा ही नहीं जा सकता" / `null` means unusable — an
 * empty value. The caller drops the row rather than rendering a dead link.
 */
function href(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // अपने ही पन्ने का पता / an internal path or anchor, left as typed.
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return trimmed;

  if (HAS_SCHEME.test(trimmed)) return trimmed;
  if (BARE_EMAIL.test(trimmed)) return `mailto:${trimmed}`;

  // बचा हुआ मतलब बिना scheme वाला पता / what remains is a schemeless URL.
  // `https` इसलिए कि `http` पर आज कोई platform नहीं रहा, और ग़लत होने पर वे
  // ख़ुद https पर भेज देते हैं — उल्टा नहीं होता.
  return `https://${trimmed}`;
}

/**
 * पते को पढ़ने लायक़ बनाइए / what to print when the author typed no display text.
 * `mailto:alok@…` छापना ग़लत लगता है; पता वैसे ही दिखना चाहिए जैसे लिखा जाता है।
 */
function readable(link: string): string {
  return link
    .replace(/^mailto:/i, '')
    .replace(/^tel:/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

/**
 * एक पंक्ति / one row, or `null` if it cannot be shown.
 *
 * बिना नाम या बिना पते की पंक्ति छोड़ दी जाती है — आधी भरी पंक्ति सहेज दी जाए तो
 * पन्ने पर टूटा हुआ लिंक दिखाने से अच्छा है कि वह पंक्ति ही न दिखे। यही रुख़
 * गैलरी का है (`url` न हो तो तस्वीर छोड़ दो).
 */
function row(entry: CmsContactRow): ContactRow | null {
  const link = href(entry.href);
  const label = entry.label?.trim();
  if (!link || !label) return null;

  const action = entry.buttonLabel?.trim()
    ? {
        label: entry.buttonLabel.trim(),
        // बटन का अपना पता न हो तो पंक्ति वाला ही / a button with no link of its
        // own goes where the row goes, which is what "Follow" usually means.
        href: href(entry.buttonHref) ?? link,
      }
    : null;

  return {
    label,
    text: pick(entry.text, readable(link)),
    href: link,
    /**
     * `external` टाइप नहीं किया जाता, पते से निकलता है / derived, never typed.
     *
     * एक और checkbox रखने का मतलब होता कि लेखक तय करें कि लिंक "बाहर" जाता है या
     * नहीं — और भूल जाने पर ईमेल नई खिड़की में खुलता (जो कुछ नहीं करता) या
     * Instagram उसी में (जो पाठक को साइट से ले जाता है)।
     *
     * A checkbox for this would ask the author to classify their own links, and
     * a wrong answer either opens a blank tab for `mailto:` or navigates the
     * reader off the site. The scheme already says which it is.
     */
    external: /^https?:/i.test(link),
    action,
  };
}

async function fetchContact(): Promise<ContactPage> {
  // depth की ज़रूरत नहीं — यहाँ कोई relationship नहीं है, सिर्फ़ text.
  // No depth parameter: nothing here relates to another collection, so the
  // default of 0 costs one round trip instead of two.
  const url = `${CMS_URL}/api/globals/contact`;

  let doc: CmsContact | null = null;

  try {
    const response = await fetch(url);
    if (response.ok) {
      doc = (await response.json()) as CmsContact;
    } else {
      console.warn(`[contact] CMS returned HTTP ${response.status} — using the built-in rows.`);
    }
  } catch {
    /**
     * यहाँ build रोकना ग़लत होगा / failing the build here would be wrong —
     * वही तर्क जो utils/identity.ts का है। रचनाएँ न मिलें तो साइट खाली छपेगी और
     * build रुकना चाहिए; संपर्क न मिले तो सिर्फ़ पते पुराने दिखेंगे।
     */
    console.warn(`[contact] could not reach the CMS at ${CMS_URL} — using the built-in rows.`);
  }

  // CMS पढ़ा ही न जा सका / the CMS could not be read at all: show the built-in
  // page rather than a heading with nothing under it.
  if (!doc) return FALLBACK;

  /**
   * यहाँ से आगे CMS ही मालिक है — खाली सूची का मतलब खाली सूची.
   *
   * ⚠️ जान-बूझकर: अगर सारी पंक्तियाँ हटाकर Save किया गया है तो पन्ना ख़ाली ही
   * रहेगा। वहाँ पुरानी पंक्तियाँ लौटा देना "हटाना काम ही नहीं करता" जैसा लगता,
   * और हटाई हुई चीज़ का साइट पर बने रहना सबसे बुरी क़िस्म की गड़बड़ है।
   *
   * Past this point the CMS is authoritative, including when it says there are
   * no rows. Falling back on an empty array would mean deletion silently does
   * not work — the worst failure of the three. The fallback above covers the
   * only case it should: the CMS being unreachable.
   */
  const rows = (doc.rows ?? []).map(row).filter((r): r is ContactRow => r !== null);

  return {
    heading: pick(doc.heading, FALLBACK.heading),
    subheading: pick(doc.subheading, FALLBACK.subheading),
    // ⚠️ नीचे की पंक्ति का सहारा `''` है / the closing line falls back to
    // nothing, not to the built-in sentence: an author who clears it means to
    // clear it, and it is decoration rather than information.
    note: pick(doc.note, ''),
    rows,
  };
}

/**
 * एक ही बार पूछिए, पर सिर्फ़ build के समय / fetch once per build.
 * dev में हर बार ताज़ा, वरना बदला हुआ पता dev server दोबारा चलाने तक पुराना ही
 * दिखता रहेगा — वही तर्क जो utils/identity.ts और utils/posts.ts का है।
 */
let cache: Promise<ContactPage> | null = null;

export async function getContact(): Promise<ContactPage> {
  if (import.meta.env.DEV) return fetchContact();

  cache ??= fetchContact();
  return cache;
}

/** पन्ने के <head> के लिए / for the page description; the site's own line. */
export const contactDescription = `${site.title} — कुछ कहना हो तो।`;
