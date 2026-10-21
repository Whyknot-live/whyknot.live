import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const siteSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  tagline: z.string(),
  type: z.string(),
  category: z.string(),
  accent: z.enum(['coral', 'blue', 'green', 'yellow']).default('coral'),
  score: z.number().int().min(0).max(100),
  performance: z.number().int().min(0).max(100),
  // Verified category scores (null until an audit exists)
  accessibility: z.number().int().min(0).max(100).nullish(),
  seo: z.number().int().min(0).max(100).nullish(),
  bestPractices: z.number().int().min(0).max(100).nullish(),
  verified: z.boolean().default(false),
  // Discovery facets (P0 taxonomy; all optional until editorial fills them)
  intent: z.string().optional(),
  industry: z.string().optional(),
  style: z.string().optional(),
  businessModel: z.string().optional(),
  audience: z.string().optional(),
  editorNote: z.string().optional(),
  // Provenance for the curated entry itself
  confidence: z.enum(['low', 'med', 'high']).default('med'),
  scannedAt: z.coerce.date().optional(),
  stack: z.array(z.string()).default([]),
  publishedAt: z.coerce.date(),
});

const launchSchema = z.object({
  name: z.string(),
  tagline: z.string(),
  maker: z.string(),
  makerHandle: z.string().optional(),
  siteSlug: z.string().optional(),
  url: z.string().url().regex(/^https?:\/\//i, 'url must be http or https').optional(),
  votes: z.number().int().nonnegative(),
  comments: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
  badge: z.enum(['New', 'Screened', 'Verified', "Editor's Pick"]),
  verified: z.boolean().default(false),
  // Paid placement — rendered with the Sponsored tag, never as merit
  sponsored: z.boolean().default(false),
  sponsoredUntil: z.coerce.date().optional(),
  slot: z.enum(['launch-boost', 'newsletter', 'pinned-week']).optional(),
  publishedAt: z.coerce.date(),
  // P1 launch-events (winners archive derives from weeklyWinners(), not winnerWeek)
  makerStory: z.string().min(20).max(1200).optional(),
  status: z.enum(['scheduled', 'live', 'archived']).default('live'),
  scheduledAt: z.coerce.date().optional(),
  winnerWeek: z.string().regex(/^\d{4}-W\d{2}$/).optional(),
  relaunchOf: z.string().optional(),
  relaunchCount: z.number().int().nonnegative().default(0),
  version: z.string().optional(),
}).refine((l) => !(l.sponsored === true && l.badge === 'New'), {
  message: 'Sponsored placements require listed + screened badges (never New)',
  path: ['badge'],
});

const makerSchema = z.object({
  name: z.string(),
  bio: z.string(),
  location: z.string().optional(),
  links: z.object({
    website: z.string().url().optional(),
    twitter: z.string().url().optional(),
    github: z.string().url().optional(),
  }).default({}),
  verified: z.boolean().default(false),
  joinedAt: z.coerce.date(),
  // P1 maker-claim (C4: no new badge states — claim marking is separate copy, not a badge)
  claimStatus: z.enum(['unclaimed', 'pending', 'claimed']).default('unclaimed'),
  domain: z.string().optional(),
  editorMaintained: z.boolean().default(true),
});

const topicSchema = z.object({ name: z.string(), description: z.string(), count: z.number().int().nonnegative() });
const collectionSchema = z.object({ name: z.string(), description: z.string(), count: z.number().int().nonnegative(), siteSlugs: z.array(z.string()).default([]) });

export const collections = {
  sites: defineCollection({ loader: file('./src/content/sites.json'), schema: siteSchema }),
  launches: defineCollection({ loader: file('./src/content/launches.json'), schema: launchSchema }),
  makers: defineCollection({ loader: file('./src/content/makers.json'), schema: makerSchema }),
  topics: defineCollection({ loader: file('./src/content/topics.json'), schema: topicSchema }),
  collections: defineCollection({ loader: file('./src/content/collections.json'), schema: collectionSchema }),
};
