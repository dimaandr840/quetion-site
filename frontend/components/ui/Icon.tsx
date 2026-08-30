import Image from "next/image";

const SIZES = {
  14: 14,
  16: 16,
  18: 18,
  20: 20,
  24: 24,
  28: 28,
  32: 32,
} as const;

export type IconName =
  | "search"
  | "sun"
  | "arrow-right"
  | "chevron-down"
  | "chevron-up"
  | "check"
  | "check-circle"
  | "alert-triangle"
  | "copy"
  | "loader"
  | "github"
  | "share-2"
  | "twitter"
  | "help-circle"
  | "briefcase"
  | "grid"
  | "users"
  | "bar-chart-2"
  | "plus"
  | "edit-2"
  | "trash-2"
  | "chevron-left"
  | "chevron-right"
  | "log-out"
  | "x"
  | "list"
  | "list-ordered"
  | "code"
  | "image"
  | "link"
  | "highlighter"
  | "quote"
  | "table";

interface IconProps {
  name: IconName;
  size?: keyof typeof SIZES;
  className?: string;
  alt?: string;
}

/** Иконки экспортированы из макета Figma в public/icons. */
export function Icon({ name, size = 20, className, alt }: IconProps) {
  const px = SIZES[size];

  return (
    <Image
      src={`/icons/${name}.svg`}
      width={px}
      height={px}
      className={className}
      alt={alt ?? ""}
      aria-hidden={alt ? undefined : true}
      unoptimized
    />
  );
}
