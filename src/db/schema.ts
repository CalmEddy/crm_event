import { relations } from "drizzle-orm";
import {
  boolean,
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

export const inboundEmailStatusEnum = pgEnum("inbound_email_status", [
  "created",
  "failed",
  "duplicate",
]);

export const notificationKindEnum = pgEnum("notification_kind", [
  "assignment",
  "record_change",
  "task_due",
]);

export const entityTypeEnum = pgEnum("entity_type", [
  "contact",
  "organization",
  "event",
  "task",
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const eventAssignees = pgTable(
  "event_assignees",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("event_assignees_event_user_idx").on(
      table.eventId,
      table.userId,
    ),
  ],
);

export const taskAssignees = pgTable(
  "task_assignees",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("task_assignees_task_user_idx").on(table.taskId, table.userId),
  ],
);

export const notificationLog = pgTable(
  "notification_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    error: text("error"),
  },
  (table) => [
    uniqueIndex("notification_log_dedupe_key_idx").on(table.dedupeKey),
  ],
);

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

export const inboundEmails = pgTable(
  "inbound_emails",
  {
    id: serial("id").primaryKey(),
    providerMessageId: text("provider_message_id").notNull(),
    subject: text("subject"),
    fromAddress: text("from_address"),
    status: inboundEmailStatusEnum("status").notNull(),
    error: text("error"),
    contactId: integer("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    eventId: integer("event_id").references(() => events.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("inbound_emails_provider_message_id_idx").on(
      table.providerMessageId,
    ),
  ],
);

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const noteLinks = pgTable(
  "note_links",
  {
    id: serial("id").primaryKey(),
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("note_links_note_entity_idx").on(
      table.noteId,
      table.entityType,
      table.entityId,
    ),
  ],
);

export const entityLinks = pgTable(
  "entity_links",
  {
    id: serial("id").primaryKey(),
    leftType: entityTypeEnum("left_type").notNull(),
    leftId: integer("left_id").notNull(),
    rightType: entityTypeEnum("right_type").notNull(),
    rightId: integer("right_id").notNull(),
    role: text("role").notNull().default("related"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("entity_links_pair_role_idx").on(
      table.leftType,
      table.leftId,
      table.rightType,
      table.rightId,
      table.role,
    ),
  ],
);

export const usersRelations = relations(users, ({ many }) => ({
  eventAssignments: many(eventAssignees),
  taskAssignments: many(taskAssignees),
  notifications: many(notificationLog),
}));

export const eventAssigneesRelations = relations(eventAssignees, ({ one }) => ({
  event: one(events, {
    fields: [eventAssignees.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventAssignees.userId],
    references: [users.id],
  }),
}));

export const taskAssigneesRelations = relations(taskAssignees, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAssignees.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskAssignees.userId],
    references: [users.id],
  }),
}));

export const notificationLogRelations = relations(notificationLog, ({ one }) => ({
  user: one(users, {
    fields: [notificationLog.userId],
    references: [users.id],
  }),
}));

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
  assignees: many(eventAssignees),
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

export const tasksRelations = relations(tasks, ({ one, many }) => ({
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
  assignees: many(taskAssignees),
}));

export const inboundEmailsRelations = relations(inboundEmails, ({ one }) => ({
  contact: one(contacts, {
    fields: [inboundEmails.contactId],
    references: [contacts.id],
  }),
  event: one(events, {
    fields: [inboundEmails.eventId],
    references: [events.id],
  }),
}));

export const notesRelations = relations(notes, ({ many }) => ({
  links: many(noteLinks),
}));

export const noteLinksRelations = relations(noteLinks, ({ one }) => ({
  note: one(notes, {
    fields: [noteLinks.noteId],
    references: [notes.id],
  }),
}));

export const savedViews = pgTable("saved_views", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  entity: entityTypeEnum("entity").notNull(),
  name: text("name").notNull(),
  query: text("query").notNull().default(""),
  shared: boolean("shared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskGroup = typeof taskGroups.$inferSelect;
export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type InboundEmail = typeof inboundEmails.$inferSelect;
export type User = typeof users.$inferSelect;
export type EventAssignee = typeof eventAssignees.$inferSelect;
export type TaskAssignee = typeof taskAssignees.$inferSelect;
export type NotificationLog = typeof notificationLog.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type NoteLink = typeof noteLinks.$inferSelect;
export type EntityLink = typeof entityLinks.$inferSelect;
export type EntityType = (typeof entityTypeEnum.enumValues)[number];
export type SavedView = typeof savedViews.$inferSelect;
