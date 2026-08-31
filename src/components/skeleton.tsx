import type { CSSProperties, HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLSpanElement> & {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
};

export function Skeleton({
  className = "",
  width,
  height,
  radius,
  style,
  ...props
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      {...props}
    />
  );
}

export function LoadingStatus({ label = "Loading content" }: { label?: string }) {
  return <span className="sr-only" role="status">{label}</span>;
}
