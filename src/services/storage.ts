import { StorageLike } from '../types/index';

export let storage: StorageLike | null = null;

try {
  storage = require("@react-native-async-storage/async-storage").default ?? null;
} catch {
  storage = null;
}

export const DRAFTS_KEY = "picpac.drafts.v1";
