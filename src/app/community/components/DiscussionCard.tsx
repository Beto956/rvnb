"use client";

import Link from "next/link";
import {
  categoryLabel,
  formatCommunityDate,
  initialsFromName,
  safeAuthorName,
  wasEdited,
} from "@/lib/community";
import styles from "./DiscussionCard.module.css";

export type DiscussionCardData = {
  id: string;
  authorId: string;
  authorDisplayName: string | null;
  title: string;
  body: string;
  category: string;
  region: string | null;
  rigType: string | null;
  createdAt: unknown;
  updatedAt: unknown;
};

function excerptOf(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > 220 ? `${clean.slice(0, 217)}...` : clean;
}

type DiscussionCardProps = {
  post: DiscussionCardData;
  currentUserId: string | null;
};

export default function DiscussionCard({ post, currentUserId }: DiscussionCardProps) {
  const isOwner = !!currentUserId && currentUserId === post.authorId;
  const authorName = safeAuthorName(post.authorDisplayName);
  const dateLabel = formatCommunityDate(post.createdAt);

  return (
    <li className={styles.item}>
      <div className={styles.card}>
        <div className={styles.header}>
            <Link
        className={styles.avatar}
        href={`/members/${encodeURIComponent(post.authorId)}`}
        aria-label={`View ${authorName}'s profile`}
            >
        {initialsFromName(post.authorDisplayName)}
            </Link>
            <div className={styles.headerText}>
        <Link
          className={styles.author}
          href={`/members/${encodeURIComponent(post.authorId)}`}
          aria-label={`View ${authorName}'s profile`}
        >
          {authorName}
        </Link>
        <span className={styles.subline}>
          <span className={styles.category}>{categoryLabel(post.category)}</span>
          {dateLabel && (
            <>
              <span aria-hidden="true"> · </span>
              <span>
                {dateLabel}
                {wasEdited(post.createdAt, post.updatedAt) ? " · Edited" : ""}
              </span>
            </>
          )}
        </span>
            </div>
          </div>

        <Link href={`/community/posts/${encodeURIComponent(post.id)}`} className={styles.cardLink}>
          <h3 className={styles.title}>{post.title}</h3>
          <p className={styles.excerpt}>{excerptOf(post.body)}</p>

          <div className={styles.meta}>
            {post.region && <span>{post.region}</span>}
            {post.rigType && <span>{post.rigType}</span>}
          </div>
        </Link>

        <div className={styles.actions}>
          <details
            className={styles.menuWrap}
            onKeyDown={event => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary
              className={styles.menuButton}
              aria-label={`More actions for ${post.title}`}
            >
              ⋯
            </summary>
            <ul className={styles.menu}>
              <li>
                <Link href={`/community/posts/${encodeURIComponent(post.id)}`} className={styles.menuItem}>
                  Open discussion
                </Link>
              </li>
              {isOwner && (
                <li>
                  <Link
                    href={`/community/posts/${encodeURIComponent(post.id)}?edit=1`}
                    className={styles.menuItem}
                  >
                    Edit
                  </Link>
                </li>
              )}
              {!isOwner && currentUserId && (
                <li>
                  <Link
                    href={`/community/posts/${encodeURIComponent(post.id)}?report=1`}
                    className={styles.menuItem}
                  >
                    Report
                  </Link>
                </li>
              )}
            </ul>
          </details>
        </div>
      </div>
    </li>
  );
}
