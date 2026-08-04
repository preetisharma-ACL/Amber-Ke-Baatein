/**
 * साइट की स्थायी जानकारी / site-wide constants.
 * Defined once here and reused by the header, footer, contact page and <head>.
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
  description: 'अम्बर की बातें — कविताएँ और कुछ अधूरी बातें। अलोक कुमार सिंह।',
  ogDescription: 'कुछ कविताएँ, कुछ अधूरी बातें — जो कही नहीं जा सकीं।',
  tagline: ['कुछ कविताएँ, कुछ अधूरी बातें', '— जो कही नहीं जा सकीं'],
  byline: 'अलोक कुमार सिंह',
  role: 'कवि',
  bio: 'यहाँ अपने बारे में दो-तीन पंक्तियाँ लिखिए — आप कहाँ के हैं, कब से लिखते हैं, और क्यों लिखते हैं। ज़्यादा औपचारिक मत कीजिए।',
  signature: 'अलोक',
  portraitCaption: 'अपनी गली में',
  portraitDatestamp: "'२६ ०१ ०८",
  handle: '@ambarkibaatein',
  copyright: '© अलोक कुमार सिंह',
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

/** संपर्क पन्ने की पंक्तियाँ / rows shown on the contact page. */
export const contactRows = [
  { label: 'ईमेल', text: site.email, href: `mailto:${site.email}`, external: false },
  {
    label: 'Instagram',
    text: '@ambarkibaatein',
    href: 'https://www.instagram.com/ambarkibaatein',
    external: true,
  },
  {
    label: 'YouTube',
    text: '@AmbarkiBaatein',
    href: 'https://www.youtube.com/@AmbarkiBaatein',
    external: true,
  },
] as const;
