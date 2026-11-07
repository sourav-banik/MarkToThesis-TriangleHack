import type { Metadata } from "next";
import { ClaimWorkbench } from "@/features/claims/components/claim-workbench";

export const metadata: Metadata = { title: "Shape a claim" };

export default function NewClaimPage() {
  return (
    <div className="page-container">
      <div className="page-heading">
        <span className="eyebrow">CLARITY BEFORE CONVICTION</span>
        <h1>
          Make your view <em>testable.</em>
        </h1>
        <p>A comparison, a range, or a position. Give the next reader the terms.</p>
      </div>
      <ClaimWorkbench />
    </div>
  );
}
