import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  serial,
  integer,
  text,
  json,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import type { RichContent } from '@wildtrip/shared';
import { users } from './users';

export const protectedAreas = pgTable(
  'protected_areas',
  {
    id: serial('id').primaryKey(),
    status: text('status', {
      enum: ['draft', 'published', 'archived'],
    }).default('draft'),
    slug: text('slug').notNull().unique(),

    name: text('name').notNull(),
    type: text('type', {
      enum: [
        'national_park',
        'national_reserve',
        'natural_monument',
        'nature_sanctuary',
      ],
    }),
    location: json('location'), // GeoJSON data
    area: integer('area'), // In hectares
    creationYear: integer('creation_year'),
    description: text('description'),
    ecosystems: json('ecosystems').$type<string[]>(),
    keySpecies: json('key_species').$type<number[]>(), // References to important species
    visitorInformation: json('visitor_information').$type<{
      schedule?: string;
      contact?: string;
      entranceFee?: string;
      facilities?: string[];
    }>(),
    mainImage: json('main_image').$type<{
      id: string;
      url: string;
      galleryId: number;
    }>(),
    galleryImages: json('gallery_images').$type<
      Array<{
        id: string;
        url: string;
        galleryId: number;
      }>
    >(),
    region: text('region'), // Chilean region

    // Optional content using TinyMCE format
    richContent: json('rich_content').$type<RichContent>(),

    // SEO fields
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    seoKeywords: text('seo_keywords'),

    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),

    // Draft system fields
    draftData: json('draft_data').$type<Record<string, unknown>>(),
    hasDraft: boolean('has_draft').default(false).notNull(),
    draftCreatedAt: timestamp('draft_created_at'),

    // Locking system fields
    lockedBy: integer('locked_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    lockedAt: timestamp('locked_at'),
    lockExpiresAt: timestamp('lock_expires_at'),
  },
  (table) => {
    return {
      statusIdx: index('idx_protected_areas_status').on(table.status),
      slugIdx: index('idx_protected_areas_slug').on(table.slug),
      typeIdx: index('idx_protected_areas_type').on(table.type),
      regionIdx: index('idx_protected_areas_region').on(table.region),
    };
  },
);

export type ProtectedArea = typeof protectedAreas.$inferSelect;
export type NewProtectedArea = typeof protectedAreas.$inferInsert;

// Protected Areas relations
export const protectedAreasRelations = relations(protectedAreas, ({ one }) => ({
  lockedByUser: one(users, {
    fields: [protectedAreas.lockedBy],
    references: [users.id],
  }),
}));
