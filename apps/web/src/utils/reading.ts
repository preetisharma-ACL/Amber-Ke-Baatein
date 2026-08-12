/**
 * पढ़ने में कितना समय / how long a रचना takes to read.
 *
 * रचना का शरीर HTML बनकर आता है (lexicalToHtml), इसलिए गिनती यहीं से होती है —
 * CMS में कोई अलग खाना नहीं जोड़ा गया। एक और खाना जोड़ने का मतलब होता कि लेखक को
 * हर बार एक ऐसी संख्या भरनी पड़ती जो कविता से ख़ुद निकाली जा सकती है।
 *
 * The body arrives as rendered HTML, so the estimate is derived from it rather
 * than stored as one more field the author would have to fill in by hand with a
 * number the text already answers.
 *
 * ── गति 160 शब्द प्रति मिनट क्यों / why 160 words a minute ────────────────────
 * गद्य के लिए आमतौर पर 200–250 माना जाता है, पर यहाँ ज़्यादातर कविता है — जो
 * धीरे, रुक-रुककर पढ़ी जाती है। ऊपर से देवनागरी में एक "शब्द" अक्सर पूरा वाक्यांश
 * होता है। इसलिए संख्या जान-बूझकर उदार रखी गई है: कम बताकर पाठक को जल्दबाज़ी में
 * डालने से बेहतर है थोड़ा ज़्यादा बता देना।
 *
 * Prose calculators use 200–250 wpm. Most of what is published here is verse,
 * which is read slowly and re-read; a Devanagari "word" also carries more than
 * an English one. The estimate is deliberately generous — telling a reader a
 * poem takes less time than it does is the worse error.
 */
const WORDS_PER_MINUTE = 160;

/**
 * HTML से सिर्फ़ लिखावट / the words, with the markup taken out.
 *
 * `<[^>]+>` काफ़ी है क्योंकि यह HTML हमारा अपना बनाया हुआ है — बाहर से चिपकाया
 * हुआ नहीं. This is our own renderer's output, not pasted markup, so a plain
 * tag-strip is enough here; it is never used to sanitise anything.
 */
function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** कम से कम एक मिनट / never zero: "0 मिनट" reads as an error, not as "short". */
export function readingMinutes(html: string): number {
  const words = toText(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** मिलान के लिए / for comparison only: no spaces, no punctuation, no dashes. */
function bare(text: string): string {
  return text.replace(/[\s….!?,;:—–\-–"'‘’“”]+/g, '');
}

/**
 * क्या सार वही है जो रचना की पहली पंक्ति / does the excerpt merely repeat the
 * opening line?
 *
 * ── यह जाँच क्यों चाहिए / why this check exists ──────────────────────────────
 * सार दो तरह का लिखा जाता है: कभी वह रचना का परिचय होता है, और कभी — ख़ासकर
 * "कविता से भरिए" वाले रास्ते से — वह पहली दो पंक्तियाँ ही उठा लेता है। पहला
 * शीर्षक के नीचे बहुत अच्छा लगता है; दूसरा वही वाक्य दो बार दिखा देता है, एक
 * बार शीर्षक के नीचे और फिर तुरंत रचना के शुरू में।
 *
 * An excerpt is written one of two ways: as a standfirst that introduces the
 * piece, or — often via the poem-autofill path — as the opening lines lifted
 * verbatim. The first reads beautifully under a title; the second prints the
 * same sentence twice within one screen, which looks like a template bug.
 *
 * इसलिए पन्ना ख़ुद देख लेता है. यह लेखक से एक और खाना भरवाने ("क्या यह दिखाना
 * है?") से बेहतर है — वह सवाल है ही डिज़ाइन का, लिखने वाले का नहीं।
 * So the page decides. The alternative — one more checkbox in the admin — asks
 * the author a question that belongs to the layout, not to the writing.
 *
 * ── 40 अक्षर क्यों / why forty characters ────────────────────────────────────
 * पूरा मिलान काम नहीं करता: सार अक्सर "…" पर कटा होता है और विराम-चिह्न बदल
 * जाते हैं। शुरुआत के 40 अक्षर मिल जाएँ तो वह वही पंक्ति है। 12 से कम पर जाँच
 * नहीं होती, वरना छोटे सार संयोग से मिल सकते हैं।
 *
 * A full match fails: the excerpt is usually truncated with an ellipsis and its
 * punctuation drifts. Forty leading characters is enough to be sure, and short
 * excerpts are left alone because a dozen characters can coincide honestly.
 */
export function echoesOpening(excerpt: string, html: string): boolean {
  const lede = bare(excerpt);
  const length = Math.min(40, lede.length);
  if (length < 12) return false;

  return bare(toText(html)).startsWith(lede.slice(0, length));
}
