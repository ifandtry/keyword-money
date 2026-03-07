import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageViewLogger } from "@/components/workspace/PageViewLogger";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PageViewLogger />
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
