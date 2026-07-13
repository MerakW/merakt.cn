import { defineCollection, z } from 'astro:content';

const fursuitfridayCollection = defineCollection({
  type: 'data',
  schema: z.object({
    time: z.string(),
    caption: z.string(),
    image: z.string().min(1),
    tags: z.array(z.string()),
    source: z.string().url().optional(),
    tweetId: z.string().optional(),
    favoriteCount: z.number().optional(),
  }),
});

export const collections = {
  fursuitfriday: fursuitfridayCollection,
};
