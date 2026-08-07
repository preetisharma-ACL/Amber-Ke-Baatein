/**
 * साइट की स्थायी जानकारी / site-wide constants.
 * Defined once here and reused by the header, footer, contact page and <head>.
 *
 * ── लेखक का परिचय अब यहाँ से नहीं चलता / the author's identity is not driven
 * from here any more ────────────────────────────────────────────────────────
 * `byline`, `role`, `bio`, `signature`, `portraitCaption`, `portraitDatestamp`
 * और `handle` अब CMS में हैं (`/admin` → परिचय)। नीचे लिखे मान सिर्फ़ आख़िरी
 * सहारा हैं — CMS न पहुँचे तो साइट खाली नाम न दिखाए, इसलिए रखे हैं।
 * **नाम बदलने के लिए यह फ़ाइल मत छेड़िए**, वरना CMS और code अलग हो जाएँगे।
 *
 * Those seven fields now live in the `identity` global in Payload and are read
 * at build time by utils/identity.ts. The values below are only the fallback
 * used if the CMS cannot be read, so the site renders a real name instead of an
 * empty heading. **Do not edit them to change the name** — edit /admin →
 * परिचय, or the two will silently disagree.
 *
 * The rest (`title`, `description`, `ogDescription`, `tagline`, `email`) is the
 * publication's own branding rather than a person's details, and stays here.
 */

export interface NavItem {
  /** मेन्यू में दिखने वाला नाम */
  label: string;
  href: string;
}

export interface SocialLink {
  label: string;
  href: string;
  /** false = अभी लिंक नहीं है (placeholder) */
  live: boolean;
  /** placeholder पर दिखने वाला tooltip */
  title?: string;
}

export const site = {
  title: 'अम्बर की बातें',
  description: 'अम्बर की बातें — कविताएँ और कुछ अधूरी बातें। आलोक कुमार सिंह।',
  ogDescription: 'कुछ कविताएँ, कुछ अधूरी बातें — जो कही नहीं जा सकीं।',
  tagline: ['कुछ कविताएँ, कुछ अधूरी बातें', '— जो कही नहीं जा सकीं'],
  byline: 'आलोक कुमार सिंह',
  role: 'कवि',
  bio: 'यहाँ अपने बारे में दो-तीन पंक्तियाँ लिखिए — आप कहाँ के हैं, कब से लिखते हैं, और क्यों लिखते हैं। ज़्यादा औपचारिक मत कीजिए।',
  signature: 'आलोक',
  portraitCaption: 'अपनी गली में',
  portraitDatestamp: "'२६ ०१ ०८",
  handle: '@ambarkibaatein',
  /**
   * copyright यहाँ नहीं है — नाम से अपने आप बनता है (`© <नाम>`).
   * Deliberately absent: the footer derives `© <byline>` so a name change in
   * the CMS reaches it too. A second hardcoded copy of the name here is exactly
   * what this feature removed. Override it in /admin → परिचय if the line ever
   * needs to say something other than the name.
   */
  email: 'alok@aajneeti.social',
} as const;

export const nav: NavItem[] = [
  { label: 'होम', href: '/' },
  { label: 'रचनाएँ', href: '/posts' },
  { label: 'श्रेणी', href: '/category' },
  { label: 'यह क्यों', href: '/why' },
  { label: 'गैलरी', href: '/gallery' },
  { label: 'संपर्क', href: '/contact' },
];

export const socials: SocialLink[] = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/ambarkibaatein',
    live: true,
  },
  {
    label: 'Facebook',
    href: '#',
    live: false,
    title: 'फ़ेसबुक पेज बनने के बाद लिंक यहाँ लगेगा',
  },
  {
    label: 'YouTube',
    href: 'https://www.youtube.com/@AmbarkiBaatein',
    live: true,
  },
];

/**
 * संपर्क पन्ने की पंक्तियाँ / rows shown on the contact page.
 *
 * ── साथ लगने वाला बटन / the optional action beside a row ────────────────────
 * `action` हो तो पंक्ति के नीचे एक बटन आता है। यह वैकल्पिक है — ईमेल वाली पंक्ति
 * को इसकी ज़रूरत नहीं, पता ख़ुद ही बटन है।
 *
 * `action` adds a button under the row. Optional on purpose: the email row does
 * not need one, since the address is already the thing you click.
 */
export const contactRows = [
  { label: 'ईमेल', text: site.email, href: `mailto:${site.email}`, external: false },
  {
    label: 'Instagram',
    text: '@ambarkibaatein',
    href: 'https://www.instagram.com/ambarkibaatein',
    external: true,
    /**
     * ⚠️ यह बटन ख़ुद फ़ॉलो नहीं करता — कर भी नहीं सकता.
     *
     * Instagram किसी दूसरी साइट से फ़ॉलो करने का कोई रास्ता नहीं देता; न कोई API,
     * न कोई widget. इसलिए यह सिर्फ़ प्रोफ़ाइल खोलता है, जहाँ पाठक Instagram का
     * अपना Follow दबाता है। लिखावट इसीलिए "फ़ॉलो कीजिए" है — "फ़ॉलो करें" नहीं —
     * ताकि बटन वह वादा न करे जो वह निभा नहीं सकता।
     *
     * This cannot follow on the reader's behalf and no button can: Meta exposes
     * no API or widget for it, and anything claiming otherwise would need the
     * reader's password. It opens the profile, where they tap Instagram's own
     * Follow — the same one extra tap either way.
     */
    action: { label: 'Follow', href: 'https://www.instagram.com/ambarkibaatein' },
  },
  {
    label: 'YouTube',
    text: '@AmbarkiBaatein',
    href: 'https://www.youtube.com/@AmbarkiBaatein',
    external: true,
    /**
     * `?sub_confirmation=1` — YouTube का अपना रास्ता / YouTube's own parameter.
     *
     * चैनल खुलते ही subscribe वाली डिबिया सामने आ जाती है; पाठक को चैनल पर बटन
     * ढूँढना नहीं पड़ता, बस "हाँ" दबाना होता है।
     *
     * Opens the channel with the subscribe dialog already showing, so the reader
     * confirms rather than hunts for the button.
     *
     * Google का official subscribe widget यहीं पर लगाया जा सकता था — पन्ना छोड़े
     * बिना subscribe हो जाता। नहीं लगाया: वह third-party cookies पर टिका है, जो
     * अब ज़्यादातर browser रोक देते हैं, इसलिए वह चुपचाप नाकाम होता है — पाठक
     * दबाता है और कुछ नहीं होता, कोई ग़लती भी नहीं दिखती। साथ में Google का
     * tracking script भी आता, इस पन्ने पर जहाँ अभी एक भी नहीं है.
     *
     * Google's official subscribe widget would do this without leaving the page.
     * It is not used because it depends on third-party cookies, which browsers
     * now block by default, so it fails silently — the reader clicks and nothing
     * happens, with no error to explain it. It would also add a Google tracking
     * script to a page that currently loads none. A reliable extra tap beats an
     * unreliable saved one.
     */
    action: {
      label: 'Subscribe',
      href: 'https://www.youtube.com/@AmbarkiBaatein?sub_confirmation=1',
    },
  },
] as const;
