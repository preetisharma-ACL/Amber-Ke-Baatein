'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * पासवर्ड दिखाने-छिपाने वाली आँख / the show-hide eye on the password field.
 *
 * ── यह component क्यों है, सीधा बटन क्यों नहीं / why a component at all ───────
 * Payload 3.87 का अपना password खाना यह सुविधा देता ही नहीं. `PasswordInput`
 * (`@payloadcms/ui/dist/fields/Password/input.js`) में `type: "password"` सीधे
 * लिखा हुआ है — न कोई prop, न कोई setting, न लॉगिन के form को बदलने का रास्ता.
 * `BeforeInput`/`AfterInput` slot उसमें हैं, पर लॉगिन का form उन्हें भरता नहीं.
 *
 * Payload 3.87 ships no toggle: `type: "password"` is a literal in its
 * `PasswordInput`, with no prop and no config to change it. The component does
 * accept `BeforeInput`/`AfterInput`, but the login form never passes them, and
 * Payload exposes no slot for replacing the login fields themselves. So the
 * button has to be added from outside — which is what this does.
 *
 * ── DOM छूता है, पर नापकर / it reaches into the DOM, but narrowly ────────────
 * `beforeLogin` वाले component form के अंदर render होते हैं, इसलिए यहाँ से वह
 * खाना ढूँढा जा सकता है. बटन फिर भी React ही बनाता है — `createPortal` सिर्फ़ यह
 * तय करता है कि वह किस जगह जाकर बैठे. इससे उसकी state, उसके event और उसकी सफ़ाई
 * React के पास रहती है; अपने हाथ से `createElement` और `addEventListener` करने
 * पर वे तीनों हमें सँभालने पड़ते.
 *
 * `beforeLogin` components render inside the form, so the field can be found
 * from here. The button is still built by React — `createPortal` only decides
 * where it lands — so its state, its listeners and its teardown stay React's.
 * Hand-rolling it with `createElement` + `addEventListener` would mean owning
 * all three by hand.
 *
 * ⚠️ ── `type` अकेले बदलना काफ़ी नहीं / setting `type` once is not enough ──────
 * ऐसा लगता है कि React सिर्फ़ बदले हुए prop दोबारा लिखेगा, और `type` उसके लिए
 * हमेशा "password" ही है — तो एक बार बदल देना काफ़ी होगा. ब्राउज़र में नापने पर
 * यह ग़लत निकला: पासवर्ड दिखाकर आगे टाइप करते ही खाना चुपचाप वापस छिप जाता था,
 * यानी React हर बार `type` फिर से लिख देता है.
 *
 * इसीलिए यहाँ एक `MutationObserver` बैठा है, जो `type` बदलते ही उसे वापस वही कर
 * देता है जो होना चाहिए. उसकी callback paint से पहले चलती है, इसलिए बीच में
 * बिन्दु झलकते नहीं.
 *
 * ⚠️ It looks as though React would only re-apply props that changed, and from
 * React's side `type` is always "password" — so one imperative set should hold.
 * Measured in a browser, it does not: revealing the password and then typing
 * one more character silently re-hid the field, because React rewrites `type`
 * on the re-render that the keystroke causes.
 *
 * Hence the `MutationObserver`, which puts `type` back whenever something else
 * changes it. Its callback runs as a microtask, before paint, so the reader
 * never sees the dots flicker back. It cannot loop: the callback only writes
 * when the value differs, and its own write then matches.
 */
export const PasswordToggle = () => {
  const [input, setInput] = useState<HTMLInputElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const form = document.querySelector('form')
    /* नाम से ढूँढा, `type` से नहीं / found by name, never by type: once the eye
       is on, the field is `type="text"` and a `input[type="password"]` query
       would stop matching the very field it is controlling. */
    const el = form?.querySelector<HTMLInputElement>('input[name="password"]') ?? null

    setInput(el)

    /* पन्ना छोड़ते वक़्त वापस छिपा हुआ / hidden again on the way out, so a
       navigation cannot leave a readable password behind on screen. */
    return () => {
      if (el) el.type = 'password'
    }
  }, [])

  useEffect(() => {
    if (!input) return

    const want = shown ? 'text' : 'password'
    input.type = want

    /* React के दोबारा लिखने पर वापस / put it back whenever React rewrites it —
       see the note at the top of this file for why that happens. */
    const observer = new MutationObserver(() => {
      if (input.type !== want) input.type = want
    })
    observer.observe(input, { attributeFilter: ['type'], attributes: true })

    return () => observer.disconnect()
  }, [input, shown])

  const toggle = useCallback(() => {
    if (!input) return

    /* ── टाइप करते-करते देखा जा सके / so this can be used mid-typing ──────────
       `type` बदलते ही कई browser caret को खाने के आख़िर में फेंक देते हैं और
       focus बटन पर चला जाता है. इसलिए जगह पहले याद की, फिर वापस रखी.
       Changing `type` moves the caret to the end in several browsers, and the
       click has already taken focus to the button. Remembering the selection
       and restoring it means the reader can reveal what they typed, fix one
       character, and carry on — which is the whole point of the control. */
    const start = input.selectionStart
    const end = input.selectionEnd

    setShown((prev) => !prev)

    window.requestAnimationFrame(() => {
      input.focus()
      if (start !== null && end !== null) {
        try {
          input.setSelectionRange(start, end)
        } catch {
          /* कुछ browser छिपे हुए खाने पर यह मना कर देते हैं / some browsers
             refuse setSelectionRange on a password input; the focus alone is
             still the right outcome. */
        }
      }
    })
  }, [input])

  /* खाना मिला ही नहीं तो चुपचाप कुछ नहीं / nothing at all if the field is not
     there: a login form that works without an eye is a far better failure than
     one that throws while rendering. */
  if (!input?.parentElement) return null

  const label = shown ? 'Hide password' : 'Show password'

  return createPortal(
    <button
      aria-label={label}
      aria-pressed={shown}
      className="amber-eye"
      /* Payload का form Enter पर submit होता है; बिना `type` के हर <button>
         submit ही होता है, तो आँख दबाते ही लॉगिन चल पड़ता.
         Without an explicit type a <button> inside a form submits it — tapping
         the eye would attempt a login. */
      type="button"
      onClick={toggle}
      title={label}
    >
      {/*
        एक ही आँख, ऊपर से एक लकीर / one eye with a line drawn across it, rather
        than two different drawings swapped in and out. दोनों तस्वीरें बदलने पर
        चिह्न झपकता है; लकीर के आने-जाने से यह दिखता है कि *एक* चीज़ बदली है.
        Swapping two icons makes the control blink; drawing the slash in over a
        constant eye shows that one thing changed state, which is what happened.
      */}
      <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
        <path
          d="M2.4 12S6.2 5.4 12 5.4 21.6 12 21.6 12 17.8 18.6 12 18.6 2.4 12 2.4 12Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
        <path
          className="amber-eye__slash"
          d="M4 20 20 4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
    </button>,
    input.parentElement,
  )
}
