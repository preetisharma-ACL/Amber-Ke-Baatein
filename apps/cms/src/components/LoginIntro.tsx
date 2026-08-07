'use client'

import { useEffect } from 'react'

/**
 * लॉगिन के खानों के ऊपर का स्वागत / the welcome above the login fields.
 *
 * ── यह क्यों चाहिए / why this exists ────────────────────────────────────────
 * Payload का लॉगिन form सिर्फ़ दो खाने और एक बटन है. आधे पन्ने के उजले पैनल में
 * वे तीन चीज़ें बीच में तैरती हुई दिखती थीं — पन्ना अधूरा लगता था, और कहीं यह
 * लिखा भी नहीं था कि यह किस चीज़ का दरवाज़ा है.
 *
 * Payload's login form is two fields and a button. Alone in a half-page panel
 * they read as unfinished, and nothing on that side says what the reader is
 * signing into.
 *
 * ── खानों में placeholder / the field placeholders ──────────────────────────
 * Payload अपने लॉगिन के खानों पर `placeholder` नहीं लगाता और उसे बदलने का कोई
 * रास्ता भी नहीं देता — न config में, न किसी slot से. इसलिए यहाँ mount होते ही
 * सीधे DOM पर लगाए जाते हैं.
 *
 * Payload puts no `placeholder` on its login inputs and exposes no way to set
 * one — not through config, not through a slot. So they are applied to the DOM
 * on mount. Imperative, and worth being honest about, but contained: it writes
 * one attribute on two inputs and nothing else.
 *
 * `!el.placeholder` की जाँच इसलिए कि अगर Payload कभी अपना placeholder देने लगे
 * तो हम उसे न मिटाएँ / guarded so that if Payload ever ships its own, this
 * defers to it rather than overwriting it.
 */
export const LoginIntro = () => {
  useEffect(() => {
    const form = document.querySelector('form')
    if (!form) return

    const set = (selector: string, text: string) => {
      const el = form.querySelector<HTMLInputElement>(selector)
      if (el && !el.placeholder) el.placeholder = text
    }

    set('input[type="email"], input[name="email"]', 'you@example.com')
    set('input[type="password"], input[name="password"]', 'Your password')
  }, [])

  /**
   * ── यह हिस्सा अंग्रेज़ी में क्यों / why this side is in English ──────────────
   * बायाँ पैनल साइट की आवाज़ है — वहाँ हिन्दी ही रहेगी. दायाँ पैनल form का हिस्सा
   * है, और Payload के अपने खाने ("Email", "Password", "Forgot password?",
   * "Login") अंग्रेज़ी में हैं. उनके बीच हिन्दी शीर्षक रखने से एक ही डिब्बे में
   * दो भाषाएँ टकराती थीं.
   *
   * The left panel carries the site's own voice and stays in Hindi. This side
   * belongs to the form, whose own labels — Email, Password, Forgot password?,
   * Login — are Payload's and are in English. A Hindi heading above them put
   * two languages inside one box.
   */
  return (
    <div className="amber-login-intro">
      {/*
        भीतर एक और डिब्बा / an inner box, deliberately.
        बाहरी डिब्बा पैनल के बीच में टिकाता है; भीतर वाला खानों जितनी चौड़ाई का
        है, इसलिए शीर्षक, पंक्ति और लकीर — तीनों एक ही बाईं सीध से शुरू होते हैं.
        बिना इसके flex हर बच्चे को अलग-अलग बीच में कर देता था.

        The outer box centres the group in the panel; this one is the width of
        the fields, so the heading, line and rule all start from the same left
        edge as the inputs. Without it the flex column centred each child on its
        own — the text lined up with the inputs while the ornaments floated to
        the middle.
      */}
      <div className="amber-login-intro__inner">
        <h1 className="amber-login-intro__title">
          <span className="amber-login-intro__word">Welcome back</span>
          {/*
            किताब और क़लम, शब्दों के दाईं ओर / the book and quill, to the right
            of the words.

            ⚠️ फ़ाइल `pen-shape-cut.png` है, `pen-shape.png` नहीं. भेजी गई फ़ाइल
            में पारदर्शिता थी ही नहीं — उसमें चौख़ाने (checkerboard) असली pixel
            के रूप में छपे थे, यानी वह किसी पारदर्शी PNG का screenshot थी. जाँचा
            गया: `hasAlpha: false`, पारदर्शी pixel 0%. किनारों से भरकर वे चौख़ाने
            हटाए गए और साफ़ फ़ाइल बनाई गई.

            ⚠️ Points at `pen-shape-cut.png`, not the supplied `pen-shape.png`.
            The original had no transparency at all: the checkerboard was baked
            in as real pixels — it was a screenshot *of* a transparent PNG.
            Measured: `hasAlpha: false`, 0% transparent. The board was removed by
            flood-filling inward from the edges, so only the outside was keyed
            and no white highlight inside the book became a hole.

            `alt=""` इसलिए कि यह सजावट है / decorative: the words beside it
            already say what it says, and announcing both is just noise.
          */}
          <img
            className="amber-login-intro__pen"
            src="/pen-shape-cut.png"
            alt=""
            aria-hidden="true"
          />
        </h1>

        {/* एक पंक्ति में रहने लायक़ छोटा / short enough to hold one line at the
            field width — the longer version wrapped to two. */}
        <p className="amber-login-intro__sub">Sign in to write, edit and publish.</p>

        <span className="amber-login-intro__rule" aria-hidden="true" />
      </div>
    </div>
  )
}
