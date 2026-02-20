import EcosystemComingSoon from "@/app/components/ecosystemcomingsoon";

export default function TransportPage() {
  return (
    <EcosystemComingSoon
      title="Transport Network"
      subtitle="Host-to-host relocation lanes, driver listings, and route support — built for real RV life."
      bullets={[
        "Driver + rig relocation (future)",
        "Route-based availability and scheduling (future)",
        "Verified partners + safety checks (future)",
      ]}
      interestCollection="transportInterest"
      providerCollection="transportProviders"
    />
  );
}
