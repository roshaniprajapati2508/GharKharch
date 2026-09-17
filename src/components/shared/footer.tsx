import { cn } from "@/lib/utils";

interface FooterCreditProps {
  className?: string;
}

export function FooterCredit({ className }: FooterCreditProps) {
  return (
    <footer className={cn("text-center text-xs text-muted-foreground transition-opacity", className)}>
      <span>Made with </span>
      <span className="text-rose-500" aria-label="love">
        ❤️
      </span>
      <span> by </span>
      <a
        href="https://www.instagram.com/harshprajapatiofficial/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground transition-colors hover:text-brand-primary hover:underline underline-offset-4"
      >
        Harsh Prajapati
      </a>
    </footer>
  );
}
