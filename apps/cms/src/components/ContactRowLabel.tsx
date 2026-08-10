'use client'

import { useRowLabel } from '@payloadcms/ui'

/**
 * संपर्क की पंक्ति का नाम, बंद डिब्बे पर / the collapsed row's title.
 *
 * बिना इसके Payload हर पंक्ति को "पंक्तियाँ 01, 02, 03" कहता है। तीन-चार ठिकाने
 * हो जाने पर बंद डिब्बों को देखकर यह बताना नामुमकिन हो जाता है कि कौन-सा
 * Instagram है और कौन-सा YouTube — क्रम बदलने के लिए हर एक को खोलना पड़ता है।
 *
 * Without this Payload labels each row by its position ("पंक्तियाँ 02"), so a
 * collapsed list of four destinations is unreadable and reordering means
 * opening every one to see which is which. Showing the label the author typed
 * costs one small component and removes that entirely.
 *
 * ⚠️ यह component `importMap` से जुड़ता है — नाम या रास्ता बदलने पर
 * `npm run generate:importmap` चलाइए, वरना admin चलते वक़्त रुकता है (build पर
 * नहीं). Wired through the generated import map; renaming it without
 * regenerating fails at runtime, not at build time.
 */
export const ContactRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ label?: string; href?: string }>()

  // जो टाइप किया, वही दिखाइए; कुछ न हो तो गिनती — खाली नाम से नंबर बेहतर है.
  // Fall back through label → link → position, so a half-filled new row still
  // says something rather than rendering an empty strip.
  const typed = data?.label?.trim() || data?.href?.trim()

  return <span>{typed || `पंक्ति ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`}</span>
}
