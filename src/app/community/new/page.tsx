"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState, useSyncExternalStore } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { COMMUNITY_CATEGORIES } from "@/lib/community";
import styles from "./page.module.css";

type FormStatus = "idle" | "submitting" | "error";

type DraftForm = {
  title: string;
  category: string;
  body: string;
  region: string;
  rigType: string;
  acknowledged: boolean;
};

const initialForm: DraftForm = {
  title: "",
  category: COMMUNITY_CATEGORIES[0].id,
  body: "",
  region: "",
  rigType: "",
  acknowledged: false,
};

const STORAGE_KEY = "rvnb-community-new-draft";
const DRAFT_EVENT_NAME = "rvnb_community_new_draft_change";

function subscribeDraft(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(DRAFT_EVENT_NAME, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(DRAFT_EVENT_NAME, callback);
  };
}

function getDraftSnapshot(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function getServerDraftSnapshot(): string {
  return "";
}

function saveDraftToStorage(data: DraftForm) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(DRAFT_EVENT_NAME));
  } catch {
    // ignore
  }
}

function clearDraftFromStorage() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(DRAFT_EVENT_NAME));
  } catch {
    // ignore
  }
}

const TITLE_MIN = 8;
const TITLE_MAX = 140;
const BODY_MIN = 20;
const BODY_MAX = 4000;

export default function NewCommunityPostPage() {
  return (
    <Suspense fallback={<main className={styles.page}><div className={styles.shell}>Loading...</div></main>}>
      <NewCommunityPostForm />
    </Suspense>
  );
}

function NewCommunityPostForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const isMounted = useSyncExternalStore(subscribeDraft, () => true, () => false);
  const rawDraft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerDraftSnapshot);

  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState("");

  const form = useMemo<DraftForm>(() => {
    if (!isMounted) return initialForm;
    if (rawDraft) {
      try {
        const parsed = JSON.parse(rawDraft) as Partial<DraftForm>;
        return { ...initialForm, ...parsed };
      } catch {
        return initialForm;
      }
    }
    const presetCategory = searchParams.get("category");
    if (presetCategory && COMMUNITY_CATEGORIES.some((c) => c.id === presetCategory)) {
      return { ...initialForm, category: presetCategory };
    }
    return initialForm;
  }, [isMounted, rawDraft, searchParams]);

  const updateField = <K extends keyof DraftForm>(field: K, value: DraftForm[K]) => {
    saveDraftToStorage({ ...form, [field]: value });
    setStatus("idle");
    setMessage("");
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const title = form.title.trim();
    const body = form.body.trim();
    const region = form.region.trim();
    const rigType = form.rigType.trim();

    if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      setStatus("error");
      setMessage(`Title must be between ${TITLE_MIN} and ${TITLE_MAX} characters.`);
      return;
    }
    if (body.length < BODY_MIN || body.length > BODY_MAX) {
      setStatus("error");
      setMessage(`Body must be between ${BODY_MIN} and ${BODY_MAX} characters.`);
      return;
    }
    if (!COMMUNITY_CATEGORIES.some((c) => c.id === form.category)) {
      setStatus("error");
      setMessage("Select a valid category.");
      return;
    }
    if (!form.acknowledged) {
      setStatus("error");
      setMessage("Acknowledge the Community standards before posting.");
      return;
    }

    if (authLoading || status === "submitting") return;

    if (!user) {
      saveDraftToStorage(form);
      router.push(`/login?next=${encodeURIComponent("/community/new")}`);
      return;
    }

    try {
      setStatus("submitting");

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const rawName = userSnap.exists() ? (userSnap.data().displayName as string | undefined) : undefined;
      const authorDisplayName = rawName && rawName.trim().length > 0 ? rawName : null;

      const now = serverTimestamp();
      const ref = await addDoc(collection(db, "communityPosts"), {
        authorId: user.uid,
        authorDisplayName,
        title,
        body,
        category: form.category,
        region: region || null,
        rigType: rigType || null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });

      clearDraftFromStorage();
      router.push(`/community/posts/${ref.id}`);
    } catch (err) {
      console.error("Community post creation error:", err);
      setStatus("error");
      setMessage("Could not publish your discussion right now. Please check your connection and try again.");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className={styles.topNav} aria-label="Community navigation">
          <Link href="/community" className={styles.backLink}>
            ← Back to Community
          </Link>
        </nav>

        <header className={styles.header}>
          <p className={styles.kicker}>START A DISCUSSION</p>
          <h1>Share something worth knowing.</h1>
          <p>Ask a question, report a road condition, or pass along something you learned on the road.</p>
        </header>

        <div className={styles.tipsCard}>
          <h2>Quick tips</h2>
          <ul>
            <li>Use a specific title — &quot;Steep entrance for 34ft trailer&quot; beats &quot;Question&quot;.</li>
            <li>Include the date when reporting road or access conditions.</li>
            <li>Share rig size or type when it materially affects the advice.</li>
            <li>Do not post someone else&apos;s private information.</li>
            <li>Use emergency services — not Community — for immediate emergencies.</li>
          </ul>
        </div>

        <form className={styles.formCard} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGrid}>
            <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
              <span>Title <span className={styles.required}>Required</span></span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="e.g. Steep entrance question for a long fifth wheel"
                maxLength={TITLE_MAX}
                required
              />
              <span className={styles.charCount}>{form.title.trim().length}/{TITLE_MAX}</span>
            </label>

            <label className={styles.field}>
              <span>Category <span className={styles.required}>Required</span></span>
              <select
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
                required
              >
                {COMMUNITY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Broad region (optional)</span>
              <input
                type="text"
                value={form.region}
                onChange={(e) => updateField("region", e.target.value)}
                placeholder="e.g. Texas and the Southwest"
                maxLength={100}
              />
            </label>

            <label className={styles.field}>
              <span>RV or rig type (optional)</span>
              <input
                type="text"
                value={form.rigType}
                onChange={(e) => updateField("rigType", e.target.value)}
                placeholder="e.g. Fifth wheel"
                maxLength={60}
              />
            </label>

            <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
              <span>Body <span className={styles.required}>Required</span></span>
              <textarea
                value={form.body}
                onChange={(e) => updateField("body", e.target.value)}
                placeholder="Share the details — plain text only."
                rows={8}
                maxLength={BODY_MAX}
                required
              />
              <span className={styles.charCount}>{form.body.trim().length}/{BODY_MAX}</span>
            </label>
          </div>

          <label className={styles.acknowledgment}>
            <input
              type="checkbox"
              checked={form.acknowledged}
              onChange={(e) => updateField("acknowledged", e.target.checked)}
            />
            <span>I have read and will follow the RVNB Community standards.</span>
          </label>

          {message && (
            <p className={styles.errorMessage} role="alert">
              {message}
            </p>
          )}

          <div className={styles.formActions}>
            <button type="submit" className={styles.primaryButton} disabled={status === "submitting"}>
              {status === "submitting" ? "Publishing..." : "Publish Discussion"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
