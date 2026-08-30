import Link from "next/link";
import styles from "./Button.module.css";

type Variant = "primary" | "outline" | "ghost";
type Size = "large" | "medium" | "small";

function classesFor(variant: Variant, size: Size, extra?: string) {
  return [styles.button, styles[variant], styles[size], extra]
    .filter(Boolean)
    .join(" ");
}

interface ButtonLinkProps {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "medium",
  className,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={classesFor(variant, size, className)}>
      {children}
    </Link>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "medium",
  className,
  ...rest
}: ButtonProps) {
  return <button {...rest} className={classesFor(variant, size, className)} />;
}
