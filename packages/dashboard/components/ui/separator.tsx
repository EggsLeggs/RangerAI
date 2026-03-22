import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation === "vertical" ? "vertical" : undefined}
      className={cn(
        "shrink-0 bg-ranger-border",
        orientation === "horizontal" ? "h-px w-full" : "h-4 w-px",
        className
      )}
      {...props}
    />
  );
}

export { Separator };
