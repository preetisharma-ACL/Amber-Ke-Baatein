/**
 * वीडियो के लिंक की जाँच / validating a pasted video link.
 *
 * यह जाँच दो जगह चाहिए — रचना के साथ लगने वाले वीडियो पर, और चलचित्र वाले
 * collection पर। दो जगह अलग-अलग लिखने का मतलब होता कि एक दिन एक जगह Instagram
 * चलने लगे और दूसरी जगह नहीं।
 *
 * The same check is needed in two places: the video attached to a post, and the
 * चलचित्र collection. Written twice they would eventually disagree — one
 * accepting a link the other rejects, for no reason anyone could explain.
 *
 * ⚠️ यह जाँच जान-बूझकर ढीली है / this is deliberately loose. It only asks
 * "is this from a platform the site can embed?" The real parsing — which of
 * YouTube's five URL shapes it is, whether the id is valid, stripping tracking
 * parameters — happens on the site in `apps/web/src/utils/embeds.ts`, where the
 * embed is actually built. Duplicating that strictness here would mean the CMS
 * rejecting links the site handles perfectly well.
 */

const SUPPORTED = /(?:youtube\.com|youtu\.be)/i
const INSTAGRAM = /instagram\.com/i

/**
 * खाली भी चलेगा / an empty value passes.
 * Both callers treat the link as optional, and a required check belongs on the
 * field (`required: true`), not buried in here — otherwise a field that says it
 * is optional would fail validation when left blank.
 */
export const validateVideoUrl = (value: string | null | undefined): true | string => {
  if (!value) return true
  return SUPPORTED.test(value) || INSTAGRAM.test(value)
    ? true
    : 'सिर्फ़ YouTube या Instagram का लिंक चलेगा / only a YouTube or Instagram link works here.'
}
