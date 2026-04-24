import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const chapters = defineCollection({
  loader: glob({ pattern: 'ch*.md', base: '../book' }),
});

const chaptersEn = defineCollection({
  loader: glob({ pattern: 'ch*.md', base: '../book-en' }),
});

export const collections = { chapters, chaptersEn };
