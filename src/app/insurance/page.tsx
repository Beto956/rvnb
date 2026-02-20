import EcosystemComingSoon from "@/app/components/ecosystemcomingsoon";

export default function InsurancePage() {
  return (
    <EcosystemComingSoon
      title="Insurance Directory"
      subtitle="Compare RV insurance options, specialized coverage, and trusted providers built for RV living."
      bullets={[
        "Partner directory and plan comparisons (future)",
        "Coverage types + rig-specific guidance (future)",
        "Verified providers with reviews (future)",
      ]}
      interestCollection="insuranceInterest"
      providerCollection="insuranceProviders"
    />
  );
}
