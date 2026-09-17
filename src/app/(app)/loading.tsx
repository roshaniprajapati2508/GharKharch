export default function AppSegmentLoading() {
  return (
    <div className="flex flex-col gap-4 animate-pulse pt-1 pb-10">
      <div className="h-8 w-44 rounded-lg bg-muted/60" />
      <div className="h-10 w-full max-w-sm rounded-xl bg-muted/40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="h-24 rounded-2xl bg-muted/50" />
        <div className="h-24 rounded-2xl bg-muted/50" />
        <div className="h-24 rounded-2xl bg-muted/50" />
        <div className="h-24 rounded-2xl bg-muted/50" />
      </div>
      <div className="h-48 rounded-2xl bg-muted/40" />
    </div>
  );
}
