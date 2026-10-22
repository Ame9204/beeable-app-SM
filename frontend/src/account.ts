// Optional on-device account + profile. Nothing here is sent to the server:
// the MVP has no server accounts, and reports never carry the reporter's identity.
import type { Profile } from "./types";

export type Language = "ms" | "en";
export type Need = "wheelchair" | "stroller" | "elderly" | "low_vision";

export interface Account {
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  language: Language;
  mobility: Profile;
  needs: Need[];
}

/** "user" = logged in to the account on this device; "guest" = chose to continue without one. */
export type Session = "user" | "guest" | null;
export type OnboardingState = "landing" | "profile" | "done";

// The app's own text comes in these two (src/i18n.ts). `speech` is the voice used for spoken directions.
export const LANGUAGES: { id: Language; label: string; speech: string }[] = [
  { id: "ms", label: "Bahasa Melayu", speech: "ms-MY" },
  { id: "en", label: "English", speech: "en-MY" },
];
const isLanguage = (x: unknown): x is Language => x === "ms" || x === "en";

// Same vocabulary as the AI intake `affects` field. Labels live in i18n.ts (need.<id>).
export const NEEDS: Need[] = ["wheelchair", "stroller", "elderly", "low_vision"];

const ACCOUNT_KEY = "beeable.account";
const SESSION_KEY = "beeable.session";
const PROFILE_KEY = "beeable.userProfile";
// App language before a profile exists (welcome / log-in screens); the profile's language wins after that.
const LANGUAGE_KEY = "beeable.language";
// Read by NavigatePage to pick the default routing profile.
const ROUTING_PROFILE_KEY = "beeable.profile";

export const MIN_PASSWORD = 6;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    /* storage blocked: the app still works, it just won't remember */
  }
}

function storageAvailable(): boolean {
  try {
    const k = "beeable.probe";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export interface AccountSnapshot {
  account: Account | null;
  session: Session;
  profile: UserProfile | null;
  state: OnboardingState;
  /** Language for the app's own text. */
  language: Language;
}

function readSnapshot(): AccountSnapshot {
  const account = read<Account>(ACCOUNT_KEY);
  let session: Session = null;
  try {
    const s = localStorage.getItem(SESSION_KEY);
    if (s === "user" && account) session = "user";
    else if (s === "guest") session = "guest";
  } catch {
    /* blocked */
  }
  const stored = read<UserProfile>(PROFILE_KEY);
  // Profiles saved before the app dropped 中文/தமிழ் fall back to English.
  const profile = stored && { ...stored, language: isLanguage(stored.language) ? stored.language : "en" };
  let saved: unknown = null;
  try {
    saved = localStorage.getItem(LANGUAGE_KEY);
  } catch {
    /* blocked */
  }
  const language: Language = profile?.language ?? (isLanguage(saved) ? saved : "en");
  let state: OnboardingState;
  // Never lock people out: if we can't store anything, skip onboarding.
  if (!storageAvailable()) state = "done";
  else if (!session) state = "landing";
  else if (!profile) state = "profile";
  else state = "done";
  return { account, session, profile, state, language };
}

// Tiny external store so App and every page see the same state.
let snapshot = readSnapshot();
const listeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getSnapshot() {
  return snapshot;
}
function refresh() {
  snapshot = readSnapshot();
  listeners.forEach((fn) => fn());
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Non-secure context (e.g. live reload over plain http on a LAN IP): FNV-1a fallback.
  let h = 0x811c9dc5;
  for (const b of data) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return `fnv-${h.toString(16)}`;
}

function newSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const normaliseEmail = (e: string) => e.trim().toLowerCase();

export function hasAccount(): boolean {
  return snapshot.account !== null;
}

export async function register(name: string, email: string, password: string): Promise<void> {
  const salt = newSalt();
  const account: Account = {
    name: name.trim(),
    email: normaliseEmail(email),
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  write(ACCOUNT_KEY, account);
  // A new account starts a fresh profile (prefilled with the name on the setup screen).
  write(PROFILE_KEY, null);
  write(SESSION_KEY, "user");
  refresh();
}

export type LogInError = "no_account" | "wrong_details";

/** One account per device; returns an error code instead of throwing. */
export async function logIn(email: string, password: string): Promise<LogInError | null> {
  const account = read<Account>(ACCOUNT_KEY);
  if (!account) return "no_account";
  const hash = await hashPassword(password, account.salt);
  if (normaliseEmail(email) !== account.email || hash !== account.passwordHash) return "wrong_details";
  write(SESSION_KEY, "user");
  refresh();
  return null;
}

export function continueAsGuest() {
  write(SESSION_KEY, "guest");
  refresh();
}

export function logOut() {
  write(SESSION_KEY, null);
  // A guest's profile isn't tied to anything, so clear it; an account's profile stays for next log-in.
  if (snapshot.session === "guest") write(PROFILE_KEY, null);
  refresh();
}

/** Switch the app language now (welcome screen); saving a profile sets it too. */
export function setLanguage(language: Language) {
  write(LANGUAGE_KEY, language);
  refresh();
}

export function saveProfile(profile: UserProfile) {
  write(PROFILE_KEY, profile);
  write(LANGUAGE_KEY, profile.language);
  write(ROUTING_PROFILE_KEY, profile.mobility);
  refresh();
}

