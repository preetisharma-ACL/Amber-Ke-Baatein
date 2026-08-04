import portrait from '../assets/alok-portrait.jpg';

/**
 * गैलरी / gallery.
 *
 * नई तस्वीर जोड़ने के लिए: तस्वीर `src/assets/` में रखिए, ऊपर import कीजिए,
 * और नीचे एक पंक्ति जोड़ दीजिए — { src: myPhoto, caption: '…' }
 *
 * `src` छोड़ देने पर खाली फ़्रेम ("तस्वीर यहाँ") दिखता है।
 *
 * To add a photo: drop it in `src/assets/`, import it above, then add one
 * line below. Omitting `src` renders the empty "तस्वीर यहाँ" placeholder.
 *
 * `src` is `ImageMetadata` (not a plain string) so Astro can optimize each
 * image at build time via <Image />.
 */
export interface GalleryItem {
  src?: ImageMetadata;
  caption: string;
}

export const gallery: GalleryItem[] = [
  { src: portrait, caption: 'अपनी गली में' },
  { caption: 'यहाँ एक तस्वीर' },
  { caption: 'यहाँ एक तस्वीर' },
];
