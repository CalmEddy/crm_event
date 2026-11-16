// Reentrancy guard and mutation context for the automation runner.
import { AsyncLocalStorage } from "node:async_hooks";

export type MutationKind = "created" | "updated" | "deleted";

export type RecordMutation = {
  entity: "contact" | "organization" | "event" | "task";
  id: number;
  kind: MutationKind;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type ActionResult = {
  detail: string;
  /** Records mutated by this action — runner dispatches follow-up automations. */
  followUps?: RecordMutation[];
};

type AutomationAls = {
  depth: number;
  runningIds: Set<number>;
  dryRun: boolean;
  /** When true, helpers skip nested onRecordMutation (runner owns chaining). */
  suppressDispatch: boolean;
};

const als = new AsyncLocalStorage<AutomationAls>();

const MAX_DEPTH = 3;

export function getAutomationAls(): AutomationAls | undefined {
  return als.getStore();
}

export function canEnterAutomation(automationId: number): boolean {
  const store = als.getStore();
  if (!store) return true;
  if (store.depth >= MAX_DEPTH) return false;
  if (store.runningIds.has(automationId)) return false;
  return true;
}

export async function runInAutomationContext<T>(
  automationId: number,
  fn: () => Promise<T>,
  options?: { dryRun?: boolean },
): Promise<T> {
  const parent = als.getStore();
  const next: AutomationAls = {
    depth: (parent?.depth ?? 0) + 1,
    runningIds: new Set(parent?.runningIds ?? []),
    dryRun: options?.dryRun ?? parent?.dryRun ?? false,
    suppressDispatch: true,
  };
  next.runningIds.add(automationId);
  return als.run(next, fn);
}

/** True when the current call stack is already inside an automation action. */
export function isInsideAutomation(): boolean {
  return (als.getStore()?.depth ?? 0) > 0;
}

export function isDryRun(): boolean {
  return Boolean(als.getStore()?.dryRun);
}

/** Nested helpers should not re-dispatch; the runner chains explicitly. */
export function shouldSuppressAutomationDispatch(): boolean {
  return Boolean(als.getStore()?.suppressDispatch);
}
