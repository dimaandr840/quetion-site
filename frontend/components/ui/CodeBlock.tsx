"use client";

import { useState } from "react";
import type { CodeSample } from "@/lib/types";
import { Icon } from "./Icon";
import styles from "./CodeBlock.module.css";

export function CodeBlock({ sample }: { sample: CodeSample }) {
  const [copied, setCopied] = useState(false);
  const source = sample.lines.join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard API может быть недоступен */
    }
  }

  return (
    <figure className={styles.block}>
      <div className={styles.header}>
        <span className={styles.label}>{sample.title || sample.language}</span>
        <button type="button" onClick={copy} className={styles.copy}>
          <Icon name={copied ? "check" : "copy"} size={14} />
          {copied ? "Скопировано" : "Копировать"}
        </button>
      </div>
      <pre className={styles.pre}>
        <code className={styles.code}>{source}</code>
      </pre>
    </figure>
  );
}
