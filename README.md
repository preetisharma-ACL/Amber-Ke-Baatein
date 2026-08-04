# अम्बर की बातें

अलोक कुमार सिंह की कविताएँ और कुछ अधूरी बातें।
An [Astro](https://astro.build) site — static, no backend, no CMS.

---

## चलाने के लिए / Running it

```bash
npm install
npm run dev      # http://localhost:4321
```

| कमांड / command | क्या करता है / what it does |
| --- | --- |
| `npm run dev` | डेवलपमेंट सर्वर / dev server with live reload |
| `npm run build` | `dist/` में पूरी साइट बनाता है / builds the static site |
| `npm run preview` | बनी हुई साइट देखने के लिए / serves the built site |
| `npm run check` | टाइप जाँच / typecheck (`astro check`) |

---

## नई रचना कैसे जोड़ें / Adding a new poem

**सिर्फ़ एक फ़ाइल बनानी है।** और कहीं कुछ नहीं बदलना।

1. `src/content/posts/` में एक नई `.md` फ़ाइल बनाइए।
   फ़ाइल का नाम ही पता बन जाता है — `meri-nayi-rachna.md` → `/posts/meri-nayi-rachna`
   इसलिए नाम अंग्रेज़ी अक्षरों में, छोटे, बीच में `-` लगाकर रखिए।

2. सबसे ऊपर दो `---` के बीच यह जानकारी डालिए:

   ```markdown
   ---
   date: '10 अगस्त 2026'
   category: 'कविता'
   title: 'रचना का नाम'
   excerpt: 'सूची में दिखने वाली एक-दो पंक्तियाँ…'
   order: 30
   ---
   ```

3. नीचे रचना लिखिए। बस।

रचना अपने आप **होम पन्ने पर, `/posts` पर, और `/category` पर** आ जाएगी।
नई श्रेणी लिखेंगे तो श्रेणी का बटन भी अपने आप बन जाएगा।

> Create one Markdown file in `src/content/posts/`, fill in the frontmatter,
> write the body. It appears on the homepage, `/posts` and `/category`
> automatically — and its category chip is created automatically too.
> This replaces the old two-step process (edit the `POSTS` array, then paste an
> `<article>` into the HTML) used by the single-file build.

### फ़्रंटमैटर के खाने / Frontmatter fields

| खाना / field | ज़रूरी? | क्या है / what it is |
| --- | --- | --- |
| `date` | हाँ | जैसा लिखेंगे वैसा ही दिखेगा — `'1 अगस्त 2026'` भी, `'आने वाली रचना'` भी। JS Date में नहीं बदला जाता। |
| `category` | हाँ | `'संस्मरण'`, `'कविता'`, `'मार्गदर्शन'` — जो भी हो |
| `title` | हाँ | रचना का नाम |
| `excerpt` | हाँ | सूची में दिखने वाली झलक |
| `order` | नहीं (डिफ़ॉल्ट `0`) | क्रम — **बड़ा नंबर पहले दिखता है**। नई रचना को पिछली से बड़ा नंबर दीजिए। |
| `draft` | नहीं (डिफ़ॉल्ट `false`) | `true` कर दीजिए तो रचना कहीं नहीं दिखेगी |

`date` को क्रम के लिए इस्तेमाल नहीं किया जा सकता, क्योंकि "1 अगस्त 2026" जैसी
हिन्दी तारीख़ को JavaScript पढ़ नहीं सकता — इसीलिए `order` है।

### रचना के अंदर क्या कैसे लिखें / Writing the body

**गद्य / prose** — सादा लिखिए, पैराग्राफ़ के बीच एक खाली पंक्ति:

```markdown
पहला पैराग्राफ़।

दूसरा पैराग्राफ़।
```

**कविता / a poem block** — सीधे HTML लिखिए (Markdown में HTML चलता है):

```html
<div class="verse">
  <div class="stanza">
    पहली पंक्ति<br>
    दूसरी पंक्ति
  </div>
  <div class="stanza">
    अगला बंद
  </div>
</div>
```

**किसी और का गीत / a quoted lyric** — बीच में, तिरछे अक्षरों में:

```html
<p class="lyric">पहली पंक्ति<br>दूसरी पंक्ति</p>
```

**बीचोंबीच एक पंक्ति / a single centred line**:

```html
<p class="center">वो भी यही चाहता होगा न?</p>
```

`✦ ✦ ✦` और "← सारी रचनाएँ" वाला बटन **अपने आप** नीचे लग जाते हैं —
उन्हें हर रचना में लिखने की ज़रूरत नहीं।

---

## नई तस्वीर कैसे जोड़ें / Adding a gallery photo

1. तस्वीर `src/assets/` में रख दीजिए।
2. `src/data/gallery.ts` खोलिए, ऊपर उसे `import` कीजिए, और एक पंक्ति जोड़ दीजिए:

```ts
import meriTasveer from '../assets/meri-tasveer.jpg';

export const gallery: GalleryItem[] = [
  { src: meriTasveer, caption: 'कैप्शन यहाँ' },
  { caption: 'यहाँ एक तस्वीर' }, // src न देने पर खाली फ़्रेम दिखता है
];
```

Astro तस्वीर को बिल्ड के वक़्त अपने आप छोटा और WebP में बदल देता है।

---

## और क्या कहाँ बदलें / Where else to edit

| क्या बदलना है | कहाँ |
| --- | --- |
| साइट का नाम, टैगलाइन, बायो, ईमेल, सोशल लिंक | `src/data/site.ts` |
| मेन्यू की कड़ियाँ | `src/data/site.ts` (`nav`) |
| फ़ेसबुक लिंक (अभी placeholder है) | `src/data/site.ts` (`socials` → `live: true` कर दीजिए) |
| "यह क्यों" वाला गद्य | `src/pages/why.astro` |
| रंग, फ़ॉन्ट, नाप | `src/styles/global.css` (`:root` वाले टोकन) |
| होम की तस्वीरें | `src/assets/kite-sky.jpg`, `src/assets/alok-portrait.jpg` |

---

## ढाँचा / Structure

```
src/
  assets/            तस्वीरें — Astro इन्हें ऑप्टिमाइज़ करता है
  components/        दोहराए जाने वाले टुकड़े
  content/posts/     हर रचना एक .md फ़ाइल
  content.config.ts  रचनाओं का schema
  data/              site.ts (स्थायी जानकारी), gallery.ts
  layouts/           BaseLayout (हर पन्ना), PostLayout (हर रचना)
  pages/             हर फ़ाइल = एक असली पता
  styles/global.css  डिज़ाइन टोकन + साझा शैली
  utils/posts.ts     रचनाएँ छाँटने/लाने के फ़ंक्शन
public/
  favicon.svg
```

### शैली कहाँ लिखी जाती है / Where the CSS lives

- **`src/styles/global.css`** — डिज़ाइन टोकन (`--paper`, `--ink`, `--kite`…),
  base typography, और **रचना के शरीर की शैली** (`.post-body`, `.verse`, `.lyric`)।
  रचना का HTML Markdown से बनता है, इसलिए उसकी शैली scoped नहीं हो सकती।
- **बाकी सब** — उसी `.astro` फ़ाइल के `<style>` में (Astro उसे अपने आप scope कर देता है)।

---

## पुरानी फ़ाइल से क्या बदला / What changed from `ambar-v9.html`

- हैश-रूटिंग (`#posts`, `#p1`) की जगह **असली पते** — `/posts`, `/posts/<slug>`
- `POSTS` array + inline `<article>` की जगह **Markdown content collection**
- base64 में दबी तस्वीरों की जगह **असली फ़ाइलें**, जो बिल्ड पर ऑप्टिमाइज़ होती हैं
- डिज़ाइन जस का तस — रंग, फ़ॉन्ट, नाप, animation सब वही
