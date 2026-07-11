import AsyncStorage from "@react-native-async-storage/async-storage";

const DRAFT_KEY = "sidya.mobile.drafts";
const QUEUE_KEY = "sidya.mobile.syncQueue";

export type OfflineAction = {
  id: string;
  type: "order_draft" | "customer_note" | "quote_draft";
  payload: unknown;
  created_at: string;
};

async function readList<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, value: T[]) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function saveDraft(action: OfflineAction) {
  const drafts = await readList<OfflineAction>(DRAFT_KEY);
  await writeList(DRAFT_KEY, [action, ...drafts.filter((item) => item.id !== action.id)]);
}

export async function listDrafts() {
  return readList<OfflineAction>(DRAFT_KEY);
}

export async function enqueueOfflineAction(action: OfflineAction) {
  const queue = await readList<OfflineAction>(QUEUE_KEY);
  await writeList(QUEUE_KEY, [action, ...queue]);
}

export async function listQueuedActions() {
  return readList<OfflineAction>(QUEUE_KEY);
}

export async function clearQueuedAction(id: string) {
  const queue = await readList<OfflineAction>(QUEUE_KEY);
  await writeList(QUEUE_KEY, queue.filter((item) => item.id !== id));
}
