// DEMO-ONLY placeholder content. Not stored in Firestore, not real user data.
// These sections have no backing collection yet — see README/audit notes for
// the fields that would be required to make them real (trendingScore, meetups
// collection, contributor rankings, etc.).

export type DemoTrendingTopic = {
  id: string;
  label: string;
  postCount: number;
};

export const DEMO_TRENDING_TOPICS: readonly DemoTrendingTopic[] = [
  { id: "1", label: "Best campgrounds in national parks", postCount: 42 },
  { id: "2", label: "Summer RV travel tips", postCount: 38 },
  { id: "3", label: "RV tire replacement advice", postCount: 31 },
  { id: "4", label: "Boondocking spots in Arizona", postCount: 28 },
  { id: "5", label: "Traveling with pets", postCount: 27 },
];

export type DemoMeetup = {
  title: string;
  dateLabel: string;
  location: string;
  goingCount: number;
};

export const DEMO_MEETUP: DemoMeetup = {
  title: "RVNB Community Meetup",
  dateLabel: "Sat, Apr 26",
  location: "Lake Pleasant, AZ",
  goingCount: 56,
};

export type DemoContributor = {
  id: string;
  name: string;
  helpfulVotes: number;
  badge: "Verified Host" | "Verified Member" | null;
};

export const DEMO_TOP_CONTRIBUTORS: readonly DemoContributor[] = [
  { id: "1", name: "Sarah K.", helpfulVotes: 2100, badge: "Verified Host" },
  { id: "2", name: "Mike D.", helpfulVotes: 1800, badge: "Verified Member" },
  { id: "3", name: "Laura P.", helpfulVotes: 1400, badge: "Verified Member" },
  { id: "4", name: "Chris B.", helpfulVotes: 1100, badge: "Verified Member" },
  { id: "5", name: "Nomad Family", helpfulVotes: 932, badge: "Verified Member" },
];
