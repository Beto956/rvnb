import EcosystemComingSoon from "@/app/components/ecosystemcomingsoon";

export default function CommunityPage() {
  return (
    <EcosystemComingSoon
      title="Community Discussions"
      subtitle="Spot reviews, safety tips, region threads, and host-to-traveler support — built into the platform."
      bullets={[
        "Reviews + reputation system (future)",
        "Region threads + safety posts (future)",
        "Moderation + profiles (future)",
      ]}
      interestCollection="communityInterest"
      providerCollection="communityProviders"
    />
  );
}
