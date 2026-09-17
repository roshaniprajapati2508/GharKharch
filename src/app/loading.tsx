import { LoadingScreen } from "@/components/shared/loading-screen";

// Root-level loading UI: covers the very first paint while the root page's
// auth/membership check resolves, before any redirect to /login, /onboarding,
// or /dashboard fires.
export default function RootLoading() {
  return <LoadingScreen />;
}
