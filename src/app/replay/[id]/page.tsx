import type { Metadata } from "next";
import { ReplayDetail } from "@/features/replay/components/replay-detail";

export const metadata: Metadata = { title: "Inspect a synthetic replay" };
export default async function ReplayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="page-container">
      <ReplayDetail id={id} />
    </div>
  );
}
