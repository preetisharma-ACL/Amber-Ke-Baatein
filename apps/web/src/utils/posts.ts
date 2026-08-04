import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

/**
 * सारी रचनाएँ, नई पहले / all posts, newest first.
 *
 * Hindi date strings are not sortable, so ordering comes from the numeric
 * `order` field in frontmatter (higher = newer). Ties fall back to title so
 * the output stays stable between builds.
 */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return posts.sort(
    (a, b) => b.data.order - a.data.order || a.data.title.localeCompare(b.data.title, 'hi')
  );
}

/** होम पन्ने के लिए नई तीन रचनाएँ / latest N posts for the homepage. */
export async function getLatestPosts(limit = 3): Promise<Post[]> {
  return (await getPosts()).slice(0, limit);
}

/**
 * सारी श्रेणियाँ, "सभी" सबसे पहले / every category, with "सभी" first.
 * Derived from the posts themselves, exactly like the original build did.
 */
export async function getCategories(): Promise<string[]> {
  const posts = await getPosts();
  const unique = [...new Set(posts.map((p) => p.data.category))];
  return ['सभी', ...unique];
}

export const ALL_CATEGORIES = 'सभी';
