import { PortfolioCommandCenter } from "@/components/portfolio-command-center";
import { getPortfolioCommandData } from "@/lib/server/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getPortfolioCommandData();
  return (
    <PortfolioCommandCenter
      summary={data.summary}
      trend={data.trend}
      loans={data.loans}
      distribution={data.distribution}
      source={data.source}
    />
  );
}
