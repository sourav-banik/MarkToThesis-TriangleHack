import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="page-container">
      <EmptyState
        title="That claim isn’t here"
        action={
          <Link href="/" className={buttonClass()}>
            Explore the examples
          </Link>
        }
      >
        <p>The address may be incomplete, or this example may not exist.</p>
      </EmptyState>
    </div>
  );
}
