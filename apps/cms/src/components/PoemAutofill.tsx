'use client'

import { useForm } from '@payloadcms/ui'
import React, { useState } from 'react'

/**
 * "कविता से भरिए" — रचना चिपकाइए, बाक़ी खाने अपने-आप भर जाएँ.
 *
 * Posts के edit पन्ने पर सबसे ऊपर बैठता है. Calls POST /api/draft-from-poem and
 * writes the result into the surrounding form.
 *
 * ── भरता है, चुपचाप मिटाता नहीं / it fills, it never silently overwrites ────
 * If the form already has a title or a body, the button does not apply
 * anything — it asks first. Replacing what someone typed while they were
 * mid-edit is the fastest way to make them stop trusting the tool, and the
 * cost of one extra click is nothing against that.
 */

type Draft = {
  title: string
  slug: string
  excerpt: string
  categoryId: number | null
  categoryName: string | null
  displayDate: string
  publishedAt: string
  order: number
  content: unknown
  summary: Record<string, number>
}

const KIND_LABELS: Record<string, string> = {
  paragraph: 'गद्य / prose',
  verse: 'कविता / verse',
  lyric: 'उद्धरण / quoted',
  center: 'बीचोंबीच / centred',
}

export const PoemAutofill: React.FC = () => {
  const { dispatchFields, getData, setModified } = useForm()

  const [poem, setPoem] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  /** भरा हुआ draft, जो पुष्टि का इंतज़ार कर रहा है / a draft awaiting confirmation. */
  const [pending, setPending] = useState<Draft | null>(null)

  const apply = (draft: Draft) => {
    const set = (path: string, value: unknown) => dispatchFields({ type: 'UPDATE', path, value })

    set('title', draft.title)
    set('slug', draft.slug)
    set('excerpt', draft.excerpt)
    set('displayDate', draft.displayDate)
    set('publishedAt', draft.publishedAt)
    set('order', draft.order)
    set('content', draft.content)
    if (draft.categoryId !== null) set('category', draft.categoryId)

    setModified(true)
    setPending(null)

    const parts = Object.entries(draft.summary)
      .map(([kind, n]) => `${n} ${KIND_LABELS[kind] ?? kind}`)
      .join(', ')
    setNote(
      `भर दिया — ${parts}.` +
        (draft.categoryName ? ` श्रेणी: ${draft.categoryName}.` : ' श्रेणी ख़ुद चुनिए।') +
        ' नीचे पढ़कर ठीक कर लीजिए, फिर Publish दबाइए।',
    )
  }

  const run = async () => {
    setError(null)
    setNote(null)
    setPending(null)
    setBusy(true)

    try {
      const res = await fetch('/api/draft-from-poem', {
        method: 'POST',
        // Payload का auth cookie भेजना ज़रूरी है / the endpoint requires the session.
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poem }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(String(data?.error ?? `HTTP ${res.status}`))
        return
      }

      // पहले से कुछ लिखा है? तो पूछिए / anything already written? ask first.
      const current = (getData?.() ?? {}) as Record<string, unknown>
      const hasTitle = typeof current.title === 'string' && current.title.trim().length > 0
      const bodyChildren = (current.content as { root?: { children?: unknown[] } } | undefined)?.root
        ?.children
      const hasBody = Array.isArray(bodyChildren) && bodyChildren.length > 0

      if (hasTitle || hasBody) {
        setPending(data as Draft)
        return
      }

      apply(data as Draft)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="poem-autofill">
      <div className="poem-autofill__head">
        <span className="poem-autofill__title">कविता से भरिए / Fill from poem</span>
        <span className="poem-autofill__hint">
          पूरी रचना यहाँ चिपकाइए — शीर्षक, पता, झलक, श्रेणी और रचना अपने-आप भर जाएँगे।
        </span>
      </div>

      <textarea
        className="poem-autofill__input"
        value={poem}
        onChange={(e) => setPoem(e.target.value)}
        placeholder={'कविता या संस्मरण यहाँ चिपकाइए…\n\nPaste the whole piece — title line included, if it has one.'}
        rows={8}
        disabled={busy}
      />

      <div className="poem-autofill__actions">
        {/*
          ⚠️ `btn--size-medium` ज़रूरी है, सजावट नहीं.

          Payload का `.btn` चारों padding को 0 रखता है; असली padding सिर्फ़ नाप
          वाली class से आती है (`.btn--size-medium` वग़ैरह — देखिए
          @payloadcms/ui/dist/elements/Button/index.scss). बिना उसके लिखावट
          बटन के किनारों से चिपक जाती है — देवनागरी में यह और बुरा लगता है,
          क्योंकि मात्राएँ ऊपर-नीचे दोनों तरफ़ निकलती हैं।

          Payload's `.btn` sets all four padding variables to 0; the real padding
          comes only from a size modifier. Payload's own <Button> component
          defaults to size="medium", so hand-written `btn btn--style-primary`
          markup has to say so too or the label sits flush against the edges.
          This is markup these buttons were missing, not a style to override in
          custom.scss.
        */}
        <button
          type="button"
          className="btn btn--style-primary btn--size-medium"
          onClick={run}
          disabled={busy || poem.trim().length < 20}
        >
          {busy ? 'पढ़ रहे हैं…' : 'भरिए / Fill'}
        </button>
        {busy && (
          <span className="poem-autofill__note">
            Claude रचना पढ़ रहा है — दस-बीस सेकंड लग सकते हैं।
          </span>
        )}
      </div>

      {pending && (
        <div className="poem-autofill__warn">
          <strong>पहले से कुछ लिखा हुआ है।</strong> भरने पर वह बदल जाएगा।
          <div className="poem-autofill__actions">
            {/* वही नाप वाली class यहाँ भी / same size class — see the note above. */}
            <button
              type="button"
              className="btn btn--style-primary btn--size-medium"
              onClick={() => apply(pending)}
            >
              हाँ, बदल दीजिए / Replace
            </button>
            <button
              type="button"
              className="btn btn--style-secondary btn--size-medium"
              onClick={() => setPending(null)}
            >
              रहने दीजिए / Cancel
            </button>
          </div>
        </div>
      )}

      {note && <div className="poem-autofill__ok">{note}</div>}
      {error && <div className="poem-autofill__error">{error}</div>}
    </div>
  )
}

export default PoemAutofill
