import { LoadingScreen } from "@/components/shared/loading-screen";

// Shown by Next.js automatically while the (app) segment's async layout data
// (household/profile/membership lookups in layout.tsx) is being fetched on
// navigation — never on every client-side interaction, just real segment loads.
export default function AppSegmentLoading() {
  return <LoadingScreen />;
}
