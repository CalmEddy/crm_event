import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import {
  Badge,
  ButtonLink,
  Field,
  PageHeader,
  Section,
  SubmitButton,
  inputClassName,
} from "@/components/ui";
import {
  contacts,
  eventContacts,
  events,
  getDb,
  organizations,
  taskGroupApplications,
  taskGroups,
  tasks,
} from "@/db";
import {
  addEventLink,
  deleteEvent,
  removeEventLink,
} from "@/lib/actions/events";
import {
  applyTaskGroupToEvent,
  recalculateOpenTasksFromTemplates,
} from "@/lib/actions/task-groups";
import { updateTaskStatus } from "@/lib/actions/tasks";
import {
  EVENT_LINK_ROLES,
  TASK_STATUSES,
  labelize,
} from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatOffsetLabel } from "@/lib/offsets";

export default async function EventDetailPage({
  params,
}: PageProps<"/events/[id]">) {
  await connection();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const db = await getDb();
  const [event] = await db.select().from(events).where(eq(events.id, id));
  if (!event) notFound();

  const [venueOrg] = event.venueOrganizationId
    ? await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, event.venueOrganizationId))
    : [null];

  const links = await db
    .select({
      link: eventContacts,
      contact: contacts,
      organization: organizations,
    })
    .from(eventContacts)
    .leftJoin(contacts, eq(eventContacts.contactId, contacts.id))
    .leftJoin(
      organizations,
      eq(eventContacts.organizationId, organizations.id),
    )
    .where(eq(eventContacts.eventId, id));

  const eventTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.eventId, id))
    .orderBy(asc(tasks.dueOn));

  const groups = await db.select().from(taskGroups).orderBy(asc(taskGroups.name));
  const applications = await db
    .select({
      application: taskGroupApplications,
      group: taskGroups,
    })
    .from(taskGroupApplications)
    .innerJoin(
      taskGroups,
      eq(taskGroupApplications.taskGroupId, taskGroups.id),
    )
    .where(eq(taskGroupApplications.eventId, id));

  const allContacts = await db.select().from(contacts).orderBy(asc(contacts.name));
  const allOrgs = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.name));

  return (
    <div className="space-y-10">
      <PageHeader
        title={event.title}
        description={`${formatDateTime(event.startsAt)} · ${event.venue || event.location || "Venue TBD"}`}
        actions={
          <>
            <ButtonLink href={`/events/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
            <form action={deleteEvent.bind(null, id)}>
              <SubmitButton variant="danger">Delete</SubmitButton>
            </form>
          </>
        }
      />

      <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{labelize(event.status)}</Badge>
          {venueOrg ? (
            <Link href={`/organizations/${venueOrg.id}`}>
              <Badge>{venueOrg.name}</Badge>
            </Link>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap text-sm text-[color:var(--muted)]">
          {event.notes || "No notes."}
        </p>
        <p className="text-xs text-[color:var(--muted)]">
          Changing the event date does not auto-shift existing tasks. Use
          recalculate below for incomplete template-linked tasks only.
        </p>
      </div>

      <Section title="Linked people & orgs">
        {links.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No links yet.</p>
        ) : (
          <ul className="mb-4 divide-y divide-[color:var(--line)] overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
            {links.map(({ link, contact, organization }) => (
              <li
                key={link.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <div className="font-medium">
                    {contact ? (
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="text-[color:var(--accent)]"
                      >
                        {contact.name}
                      </Link>
                    ) : organization ? (
                      <Link
                        href={`/organizations/${organization.id}`}
                        className="text-[color:var(--accent)]"
                      >
                        {organization.name}
                      </Link>
                    ) : (
                      "Unknown"
                    )}
                  </div>
                  <div className="text-[color:var(--muted)]">
                    {link.role}
                    {contact && organization ? ` · ${organization.name}` : ""}
                  </div>
                </div>
                <form action={removeEventLink.bind(null, id, link.id)}>
                  <SubmitButton variant="secondary">Remove</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={addEventLink.bind(null, id)}
          className="grid max-w-3xl gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4 sm:grid-cols-2"
        >
          <Field label="Contact">
            <select className={inputClassName} name="contactId" defaultValue="">
              <option value="">None</option>
              {allContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Organization">
            <select
              className={inputClassName}
              name="organizationId"
              defaultValue=""
            >
              <option value="">None</option>
              {allOrgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role">
            <select className={inputClassName} name="role" defaultValue="contact">
              {EVENT_LINK_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <input className={inputClassName} name="notes" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Add link</SubmitButton>
          </div>
        </form>
      </Section>

      <Section
        title="Tasks"
        actions={
          <form action={recalculateOpenTasksFromTemplates.bind(null, id)}>
            <SubmitButton variant="secondary">
              Recalculate open tasks from templates
            </SubmitButton>
          </form>
        }
      >
        {eventTasks.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No tasks yet. Apply a task group below.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)]">
            <ul className="divide-y divide-[color:var(--line)]">
              {eventTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-medium">{task.title}</div>
                    <div className="text-sm text-[color:var(--muted)]">
                      {formatDate(task.dueOn)} · {labelize(task.kind)}
                    </div>
                  </div>
                  <form
                    action={updateTaskStatus.bind(null, task.id)}
                    className="flex items-center gap-2"
                  >
                    <select
                      className={inputClassName}
                      name="status"
                      defaultValue={task.status}
                    >
                      {TASK_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {labelize(status)}
                        </option>
                      ))}
                    </select>
                    <SubmitButton variant="secondary">Update</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Apply task group">
        {applications.length > 0 ? (
          <p className="mb-3 text-sm text-[color:var(--muted)]">
            Already applied:{" "}
            {applications.map(({ group }) => group.name).join(", ")}. Re-apply
            uses “add missing only” to skip templates that already spawned a
            task.
          </p>
        ) : null}
        <form
          action={applyTaskGroupToEvent.bind(null, id)}
          className="max-w-xl space-y-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--panel)] p-4"
        >
          <Field
            label="Task group"
            hint="dueOn = event date + offsetDays (negative before, positive after)"
          >
            <select className={inputClassName} name="taskGroupId" required>
              <option value="">Select group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mode">
            <select className={inputClassName} name="mode" defaultValue="block">
              <option value="block">Apply once (block if already applied)</option>
              <option value="add_missing">Add missing only</option>
            </select>
          </Field>
          <SubmitButton>Apply to event</SubmitButton>
        </form>
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-[color:var(--muted)]">
            Create a task group first. Example offsets:{" "}
            {formatOffsetLabel(-14)}, {formatOffsetLabel(2)},{" "}
            {formatOffsetLabel(182)}.
          </p>
        ) : null}
      </Section>
    </div>
  );
}
