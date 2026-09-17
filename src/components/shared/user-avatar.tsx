import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Shared avatar-with-initials-fallback used throughout the app (spec item 51). */
export function UserAvatar({
  name,
  avatarUrl,
  className,
  textClassName,
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  /** Overrides the fallback initials' text size - AvatarFallback hardcodes `text-sm`, which doesn't inherit from a larger `className` on the wrapper. */
  textClassName?: string;
}) {
  return (
    <Avatar className={cn(className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className={textClassName}>{initialsOf(name)}</AvatarFallback>
    </Avatar>
  );
}
