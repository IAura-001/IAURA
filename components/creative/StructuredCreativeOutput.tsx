"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./CreativeStudio.module.css";

interface StructuredCreativeOutputProps {
  data: unknown;
  fileName: string;
  onFeedback: (message: string, error?: boolean) => void;
  onSaveVersion?: (data: unknown) => boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

function labelFromKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function textFromData(data: unknown, depth = 0): string {
  if (typeof data === "string" || typeof data === "number") {
    return String(data);
  }

  if (Array.isArray(data)) {
    return data
      .map((item) => textFromData(item, depth + 1))
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof data === "object" && data !== null) {
    return Object.entries(data)
      .map(([key, value]) => {
        const body = textFromData(value, depth + 1);
        return body ? `${labelFromKey(key)}\n${body}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

function OutputValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (typeof value === "string" || typeof value === "number") {
    return <p className={styles.outputText}>{String(value)}</p>;
  }

  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "string")) {
      return (
        <ul className={styles.outputList}>
          {value.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      );
    }

    return (
      <div className={styles.outputCollection}>
        {value.map((item, index) => (
          <article className={styles.outputCard} key={index}>
            <OutputValue value={item} depth={depth + 1} />
          </article>
        ))}
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    return (
      <div className={depth === 0 ? styles.outputSections : styles.outputFields}>
        {Object.entries(value).map(([key, nestedValue]) => (
          <section className={styles.outputField} key={key}>
            <h4>{labelFromKey(key)}</h4>
            <OutputValue value={nestedValue} depth={depth + 1} />
          </section>
        ))}
      </div>
    );
  }

  return null;
}

export default function StructuredCreativeOutput({
  data,
  fileName,
  onFeedback,
  onSaveVersion,
  onDirtyChange,
}: StructuredCreativeOutputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(data, null, 2));
  const [copying, setCopying] = useState(false);
  const dirtyCallbackRef = useRef(onDirtyChange);

  useEffect(() => {
    dirtyCallbackRef.current = onDirtyChange;
  }, [onDirtyChange]);

  useEffect(
    () => () => {
      dirtyCallbackRef.current?.(false);
    },
    [],
  );

  function fallbackCopy(text: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  async function copyOutput(): Promise<void> {
    if (copying) return;

    const text = textFromData(data);
    setCopying(true);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else if (!fallbackCopy(text)) {
        throw new Error("Clipboard unavailable");
      }
      onFeedback("Contenido copiado.");
    } catch {
      onFeedback(
        "No se pudo copiar automáticamente. Usa Exportar JSON para conservarlo.",
        true,
      );
    } finally {
      setCopying(false);
    }
  }

  function downloadOutput(): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileName}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    onFeedback("Sistema exportado en JSON.");
  }

  function startEditing(): void {
    setDraft(JSON.stringify(data, null, 2));
    setEditing(true);
    onDirtyChange?.(false);
  }

  function cancelEditing(): void {
    setEditing(false);
    onDirtyChange?.(false);
  }

  function saveEditing(): void {
    try {
      const parsed = JSON.parse(draft) as unknown;
      if (onSaveVersion?.(parsed) !== false) {
        setEditing(false);
        onDirtyChange?.(false);
      }
    } catch {
      onFeedback("El JSON editado no es válido todavía.", true);
    }
  }

  return (
    <section className={styles.structuredOutput} aria-label="Resultado creativo">
      <div className={styles.outputActions}>
        <button
          type="button"
          onClick={copyOutput}
          disabled={copying}
          aria-busy={copying}
        >
          {copying ? "Copiando…" : "Copiar contenido"}
        </button>
        <button type="button" onClick={downloadOutput}>
          Exportar JSON
        </button>
        {onSaveVersion && !editing && (
          <button type="button" onClick={startEditing}>
            Editar contenido
          </button>
        )}
      </div>

      {editing ? (
        <div className={styles.outputEditor}>
          <label htmlFor={`${fileName}-editor`}>Editor estructurado JSON</label>
          <textarea
            id={`${fileName}-editor`}
            value={draft}
            onChange={(event) => {
              const nextDraft = event.target.value;
              setDraft(nextDraft);
              onDirtyChange?.(
                nextDraft !== JSON.stringify(data, null, 2),
              );
            }}
            spellCheck={false}
          />
          <div className={styles.outputActions}>
            <button type="button" onClick={cancelEditing}>
              Cancelar
            </button>
            <button type="button" onClick={saveEditing}>
              Guardar como nueva versión
            </button>
          </div>
        </div>
      ) : (
        <OutputValue value={data} />
      )}
    </section>
  );
}
