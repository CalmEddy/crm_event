import { relations } from "drizzle-orm";
import {
  date,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const organizationTypeEnum = pgEnum("organization_type", [
  "venue",
  "club",
  "agency",
  "promoter",
  "other",
]);

export const eventStatusEnum = pgEnum("event_status", [
  "inquiry",
  "booked",
  "completed",
  "canceled",
]);

export const taskKindEnum = pgEnum("task_kind", [
  "travel",
  "payment",
  "call",
  "email",
  "follow_up",
  "other",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "doing",
  "done",
  "skipped",
]);

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: organizationTypeEnum("type").notNull().default("other"),
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"),
  notes: text("notes"),
  organizationId: integer("organization_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  location: text("location"),
  venue: text("venue"),
  venueOrganizationId: integer("venue_organization_id").references(
    () => organizations.id,
    { onDelete: "set null" },
  ),
  notes: text("notes"),
  status: eventStatusEnum("status").notNull().default("inquiry"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const eventContacts = pgTable("event_contacts", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => contacts.id, {
    onDelete: "cascade",
  }),
  organizationId: integer("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  role: text("role").notNull().default("contact"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskGroups = pgTable("task_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskTemplates = pgTable("task_templates", {
  id: serial("id").primaryKey(),
  taskGroupId: integer("task_group_id")
    .notNull()
    .references(() => taskGroups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: taskKindEnum("kind").notNull().default("other"),
  offsetDays: integer("offset_days").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const taskGroupApplications = pgTable(
  "task_group_applications",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    taskGroupId: integer("task_group_id")
      .notNull()
      .references(() => taskGroups.id, { onDelete: "cascade" }),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("task_group_applications_event_group_idx").on(
      table.eventId,
      table.taskGroupId,
    ),
  ],
);

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  kind: taskKindEnum("kind").notNull().default("other"),
  dueOn: date("due_on").notNull(),
  status: taskStatusEnum("status").notNull().default("todo"),
  notes: text("notes"),
  eventId: integer("event_id").references(() => events.id, {
    onDelete: "cascade",
  }),
  contactId: integer("contact_id").references(() => contacts.id, {
    onDelete: "set null",
  }),
  taskGroupId: integer("task_group_id").references(() => taskGroups.id, {
    onDelete: "set null",
  }),
  taskTemplateId: integer("task_template_id").references(() => taskTemplates.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  contacts: many(contacts),
  events: many(events),
  eventLinks: many(eventContacts),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  eventLinks: many(eventContacts),
  tasks: many(tasks),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  venueOrganization: one(organizations, {
    fields: [events.venueOrganizationId],
    references: [organizations.id],
  }),
  links: many(eventContacts),
  tasks: many(tasks),
  taskGroupApplications: many(taskGroupApplications),
}));

export const eventContactsRelations = relations(eventContacts, ({ one }) => ({
  event: one(events, {
    fields: [eventContacts.eventId],
    references: [events.id],
  }),
  contact: one(contacts, {
    fields: [eventContacts.contactId],
    references: [contacts.id],
  }),
  organization: one(organizations, {
    fields: [eventContacts.organizationId],
    references: [organizations.id],
  }),
}));

export const taskGroupsRelations = relations(taskGroups, ({ many }) => ({
  templates: many(taskTemplates),
  applications: many(taskGroupApplications),
  tasks: many(tasks),
}));

export const taskTemplatesRelations = relations(taskTemplates, ({ one, many }) => ({
  taskGroup: one(taskGroups, {
    fields: [taskTemplates.taskGroupId],
    references: [taskGroups.id],
  }),
  tasks: many(tasks),
}));

export const taskGroupApplicationsRelations = relations(
  taskGroupApplications,
  ({ one }) => ({
    event: one(events, {
      fields: [taskGroupApplications.eventId],
      references: [events.id],
    }),
    taskGroup: one(taskGroups, {
      fields: [taskGroupApplications.taskGroupId],
      references: [taskGroups.id],
    }),
  }),
);

export const tasksRelations = relations(tasks, ({ one }) => ({
  event: one(events, {
    fields: [tasks.eventId],
    references: [events.id],
  }),
  contact: one(contacts, {
    fields: [tasks.contactId],
    references: [contacts.id],
  }),
  taskGroup: one(taskGroups, {
    fields: [tasks.taskGroupId],
    references: [taskGroups.id],
  }),
  taskTemplate: one(taskTemplates, {
    fields: [tasks.taskTemplateId],
    references: [taskTemplates.id],
  }),
}));

export type Organization = typeof organizations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskGroup = typeof taskGroups.$inferSelect;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
