import { relations } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),

    // Clerk integration
    clerkId: varchar('clerk_id', { length: 255 }).notNull().unique(),

    // Basic info
    email: varchar('email', { length: 255 }).notNull(),
    username: varchar('username', { length: 255 }),
    firstName: varchar('first_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }),
    fullName: varchar('full_name', { length: 255 }),

    // Profile
    avatarUrl: text('avatar_url'),
    bio: text('bio'),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    role: varchar('role', { length: 50 }).default('user').notNull(), // admin, content_editor, news_editor, areas_editor, species_editor, user

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => {
    return {
      clerkIdIdx: index('idx_users_clerk_id').on(table.clerkId),
      emailIdx: index('idx_users_email').on(table.email),
    };
  },
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Users relations
export const usersRelations = relations(users, ({}) => ({}));
