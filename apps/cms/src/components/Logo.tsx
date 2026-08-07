/**
 * अम्बर की बातें का पतंग / the site's kite mark, inside the admin panel.
 *
 * ── दो जगह, एक ही पतंग / two exports, one drawing ────────────────────────────
 * Payload दो चीज़ें अलग-अलग माँगता है:
 *   `Icon` — बायें nav के सिरे पर छोटा निशान
 *   `Logo` — लॉगिन के पन्ने पर बड़ा
 * दोनों के लिए SVG दो बार लिखने का मतलब होता कि कल पतंग बदलने पर एक जगह बदले
 * और दूसरी जगह पुरानी रह जाए। इसलिए नीचे एक ही `Kite` है, नाप बाहर से आता है।
 *
 * Payload asks for these separately — Icon for the nav, Logo for the login
 * screen — but they are the same drawing at two sizes, so it is defined once
 * here. Duplicating the SVG would guarantee the two drift apart the first time
 * the mark is adjusted.
 *
 * ── रंग theme के हिसाब से / colours follow the admin theme ───────────────────
 * साइट पर यह पतंग हमेशा गहरे रंग पर बैठती है, इसलिए वहाँ पूँछ क्रीम रंग की है
 * (#ece4d6). Admin सफ़ेद भी हो सकता है और गहरा भी — क्रीम पूँछ सफ़ेद पन्ने पर
 * ग़ायब हो जाती। इसलिए यहाँ पूँछ `--theme-elevation-800` से रंग लेती है, जो
 * दोनों theme में पन्ने के उलट रहता है।
 *
 * On the site this mark always sits on the near-black page, so its tail is
 * cream. The admin can be either theme, and a cream tail on a white login page
 * is invisible — so the tail reads from `--theme-elevation-800`, which is dark
 * in the light theme and light in the dark one. The body uses
 * `--amber-terracotta` (custom.scss), which already differs per theme so the
 * red stays legible on both. The cross-spars stay a fixed near-black because
 * they sit *on* the terracotta body, which is terracotta in either theme.
 *
 * रंग custom.scss में तय हैं, यहाँ नहीं — दोनों जगह अलग-अलग न लिखे जाएँ.
 * Fallbacks are inlined so the mark still renders sensibly if custom.scss ever
 * fails to load, rather than disappearing entirely.
 */

const Kite = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path d="M50 10 L76 42 L50 84 L24 42 Z" fill="var(--amber-terracotta, #e0654c)" />
    <path d="M50 10 L50 84 M24 42 L76 42" stroke="#161412" strokeWidth="3" />
    {/*
      पूँछ का रंग बाहर से / the tail colour comes from the surrounding context.
      nav में theme के हिसाब से, लॉगिन के पन्ने पर हमेशा क्रीम — क्योंकि वहाँ
      पीछे तस्वीर है, theme चाहे उजली हो या गहरी.
      In the nav it follows the admin theme; on the login screen it is pinned to
      cream, because there the mark always sits on a dark photograph regardless
      of which theme the admin is in. Set via --amber-kite-tail in custom.scss.
    */}
    <path
      d="M50 84 q8 10 -2 16 q-8 6 -1 13"
      stroke="var(--amber-kite-tail, var(--theme-elevation-800, #211d18))"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
)

/**
 * बायें nav के ऊपर / the small mark at the top of the sidebar.
 * Payload इसे breadcrumb की पट्टी में भी दिखाता है, इसलिए यह छोटा ही रहे.
 * Payload also renders this in the breadcrumb bar, so it stays small.
 */
export const Icon = () => <Kite size={26} />

/**
 * लॉगिन के पन्ने का बायाँ हिस्सा / the left panel of the login screen.
 *
 * ── "Logo" में पूरा पैनल क्यों / why a whole panel lives in the Logo slot ────
 * Payload लॉगिन के पन्ने पर सिर्फ़ तीन चीज़ें अपनी जगह देता है: `Logo`,
 * `beforeLogin`, `afterLogin`. इनमें से `Logo` अकेला है जो form से *पहले* और
 * उसका सहोदर (sibling) होकर बैठता है — यानी CSS grid में उसे दूसरा खाना बनाया
 * जा सकता है। `beforeLogin` form के अंदर आता है, इसलिए उससे बायाँ पैनल नहीं बनता।
 *
 * Payload offers three slots on this screen — Logo, beforeLogin, afterLogin —
 * and Logo is the only one rendered as a *sibling* of the form (verified in the
 * RSC payload: `[div.login__brand, null, LoginForm]`). That sibling position is
 * what lets CSS lay the two out as two columns. `beforeLogin` renders inside
 * the form, so a left panel cannot be built from it.
 *
 * ── पंक्तियाँ साइट की अपनी हैं / the words are the site's own ───────────────
 * यह "यह क्यों" पन्ने की पहली पंक्तियाँ हैं. Taken from the यह क्यों page rather
 * than invented for the login screen, so the one place निदेशक जी sees before
 * working says the same thing the site says to a reader.
 */
export const Logo = () => (
  <div className="amber-login-brand">
    <div className="amber-logo">
      <Kite size={44} />
      <span className="amber-logo__word">अम्बर की बातें</span>
    </div>

    <blockquote className="amber-login-brand__quote">
      <p>
        कुछ बातें कहने के लिए होती हैं,
        <br />
        कुछ सिर्फ़ रख देने के लिए।
      </p>
      <footer>
        <span className="amber-login-brand__name">आलोक कुमार सिंह</span>
        <span className="amber-login-brand__role">कवि</span>
      </footer>
    </blockquote>
  </div>
)
