import type { PluggableList } from 'unified';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

/**
 * Custom sanitize schema that extends the default to allow
 * `language-*` classes on `code` elements (required for shiki
 * to detect code block languages).
 */
export const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []),
      ['className', /^language-./],
    ],
  },
};

/**
 * Returns the ordered rehype plugin array for react-markdown.
 * Single source of truth for plugin ordering:
 *   1. rehype-sanitize (with custom schema)
 *   2. rehype-slug (heading IDs)
 *   3. rehype-autolink-headings (anchor links)
 */
export function getRehypePlugins(): PluggableList {
  return [
    [rehypeSanitize, customSanitizeSchema],
    rehypeSlug,
    rehypeAutolinkHeadings,
  ];
}
