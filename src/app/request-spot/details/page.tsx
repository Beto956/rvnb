import DetailsPageContent from "./detailspagecontent";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    requestId?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const requestId = params?.requestId ?? "";

  return <DetailsPageContent requestId={requestId} />;
}