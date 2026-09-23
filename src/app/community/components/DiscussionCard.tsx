"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const isOwner = !!currentUserId && currentUserId === post.authorId;
  const authorName = safeAuthorName(post.authorDisplayName);

  function goToAuthorProfile(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/members/${post.authorId}`);
  }

  return (
    <li className={styles.item}>
      <div className={styles.card}>
        <Link href={`/community/posts/${post.id}`} className={styles.cardLink}>
          <div className={styles.header}>
            <span
              className={styles.avatar}
              role="link"
              tabIndex={0}
              aria-label={`View ${authorName}'s profile`}
              onClick={goToAuthorProfile}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") goToAuthorProfile(e);
              }}
            >
              {initialsFromName(post.authorDisplayName)}
            </span>
            <div className={styles.headerText}>
              <span
                className={styles.author}
                role="link"
                tabIndex={0}
                aria-label={`View ${authorName}'s profile`}
                onClick={goToAuthorProfile}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") goToAuthorProfile(e);
                }}
              >
                {authorName}
              </span>
              <span className={styles.subline}>
                <span className={styles.category}>{categoryLabel(post.category)}</span>
                <span aria-hidden="true"> · </span>
                <span>
                  {formatCommunityDate(post.createdAt)}
                  {wasEdited(post.createdAt, post.updatedAt) ? " · Edited" : ""}
                </span>
              </span>
            </div>
          </div>

          <h3 className={styles.title}>{post.title}</h3>
          <p className={styles.excerpt}>{excerptOf(post.body)}</p>

          <div className={styles.meta}>
            {post.region && <span>{post.region}</span>}
            {post.rigType && <span>{post.rigType}</span>}
          </div>
        </Link>

        <div className={styles.actions}>
          <div
            className={styles.menuWrap}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setMenuOpen(false);
              }
            }}
          >
            <button
              type="button"
              className={styles.menuButton}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`More actions for ${post.title}`}
              onClick={() => setMenuOpen((v) => !v)}
            >
              ⋯
            </button>
            {menuOpen && (
              <ul className={styles.menu} role="menu">
                <li role="none">
                  <Link role="menuitem" href={`/community/posts/${post.id}`} className={styles.menuItem}>
                    Open discussion
                  </Link>
                </li>
                {isOwner && (
                  <li role="none">
                    <Link
                      role="menuitem"
                      href={`/community/posts/${post.id}?edit=1`}
                      className={styles.menuItem}
                    >
                      Edit
                    </Link>
                  </li>
                )}
                {!isOwner && currentUserId && (
                  <li role="none">
                    <Link
                      role="menuitem"
                      href={`/community/posts/${post.id}?report=1`}
                      className={styles.menuItem}
                    >
                      Report
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
