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
      className={`relative isolate block max-w-full overflow-hidden rounded-lg bg-[#e5d6bc] text-transparent after:absolute after:inset-0 after:translate-x-[-110%] after:animate-[skeleton-shimmer_1.8s_ease-in-out_infinite] after:bg-[linear-gradient(100deg,transparent_15%,#ffffff88_42%,#ffffffbb_50%,#ffffff88_58%,transparent_85%)] after:content-[''] motion-reduce:after:hidden motion-reduce:after:animate-none ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      {...props}
    />
  );
}

export function LoadingStatus({ label = "Loading content" }: { label?: string }) {
  return <span className="sr-only" role="status">{label}</span>;
}
