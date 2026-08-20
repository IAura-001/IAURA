"use client";

import Link from "next/link";
import {
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import type { SupportedLocale } from "@/core/i18n/languages";
import { VAEORA_SUPPORT_URL } from "@/config/support";

import styles from "./VaeoraWorkspaceShell.module.css";

export type WorkspaceView =
  | "presence"
  | "projects"
  | "intelligence";

export type WorkspaceEntryIntent =
  | "voice"
  | "branding";

interface WorkspaceViewCopy {
  label: string;
  eyebrow: string;
  title: string;
  description: string;
}

interface WorkspaceCopy {
  navigation: string;
  workspace: string;
  auraStatus: string;
  views: Record<WorkspaceView, WorkspaceViewCopy>;
}

interface VaeoraWorkspaceShellProps {
  locale: SupportedLocale;
  userName: string;
  initialView?: WorkspaceView;
  activeView?: WorkspaceView;
  onViewChange?: (view: WorkspaceView) => void;
  presence: ReactNode;
  projects: ReactNode;
  intelligence: ReactNode;
}

const VIEW_ORDER: readonly WorkspaceView[] = [
  "presence",
  "projects",
  "intelligence",
];

const WORKSPACE_COPY: Record<SupportedLocale, WorkspaceCopy> = {
  "es-419": {
    navigation: "Navegación del workspace",
    workspace: "Espacio de inteligencia",
    auraStatus: "Aura activa",
    views: {
      presence: {
        label: "Presencia",
        eyebrow: "NÚCLEO DE INTELIGENCIA",
        title: "Piensa con Aura.",
        description:
          "Conversa, organiza una intención y conviértela en una decisión clara.",
      },
      projects: {
        label: "Proyectos",
        eyebrow: "SISTEMA DE CREACIÓN",
        title: "Dale estructura a tus ideas.",
        description:
          "Reúne contexto, identidad y lanzamiento en un mismo espacio de trabajo.",
      },
      intelligence: {
        label: "Inteligencia",
        eyebrow: "MEMORIA Y DIRECCIÓN",
        title: "Tu señal, organizada.",
        description:
          "Observa prioridades, hábitos, misiones y progreso sin perder el foco.",
      },
    },
  },
  "en-US": {
    navigation: "Workspace navigation",
    workspace: "Intelligence workspace",
    auraStatus: "Aura online",
    views: {
      presence: {
        label: "Presence",
        eyebrow: "INTELLIGENCE CORE",
        title: "Think with Aura.",
        description:
          "Converse, organize an intention, and turn it into a clear decision.",
      },
      projects: {
        label: "Projects",
        eyebrow: "CREATION SYSTEM",
        title: "Give your ideas structure.",
        description:
          "Bring context, identity, and launch work into one continuous space.",
      },
      intelligence: {
        label: "Intelligence",
        eyebrow: "MEMORY AND DIRECTION",
        title: "Your signal, organized.",
        description:
          "See priorities, habits, missions, and progress without losing focus.",
      },
    },
  },
  "pt-BR": {
    navigation: "Navegação do workspace",
    workspace: "Espaço de inteligência",
    auraStatus: "Aura ativa",
    views: {
      presence: {
        label: "Presença",
        eyebrow: "NÚCLEO DE INTELIGÊNCIA",
        title: "Pense com Aura.",
        description:
          "Converse, organize uma intenção e transforme-a em uma decisão clara.",
      },
      projects: {
        label: "Projetos",
        eyebrow: "SISTEMA DE CRIAÇÃO",
        title: "Dê estrutura às suas ideias.",
        description:
          "Reúna contexto, identidade e lançamento em um único espaço contínuo.",
      },
      intelligence: {
        label: "Inteligência",
        eyebrow: "MEMÓRIA E DIREÇÃO",
        title: "Seu sinal, organizado.",
        description:
          "Veja prioridades, hábitos, missões e progresso sem perder o foco.",
      },
    },
  },
  "fr-FR": {
    navigation: "Navigation de l’espace de travail",
    workspace: "Espace d’intelligence",
    auraStatus: "Aura active",
    views: {
      presence: {
        label: "Présence",
        eyebrow: "CŒUR D’INTELLIGENCE",
        title: "Pensez avec Aura.",
        description:
          "Échangez, organisez une intention et transformez-la en décision claire.",
      },
      projects: {
        label: "Projets",
        eyebrow: "SYSTÈME DE CRÉATION",
        title: "Structurez vos idées.",
        description:
          "Réunissez contexte, identité et lancement dans un espace continu.",
      },
      intelligence: {
        label: "Intelligence",
        eyebrow: "MÉMOIRE ET DIRECTION",
        title: "Votre signal, organisé.",
        description:
          "Suivez priorités, habitudes, missions et progrès sans perdre le cap.",
      },
    },
  },
};

export default function VaeoraWorkspaceShell({
  locale,
  userName,
  initialView = "presence",
  activeView: controlledActiveView,
  onViewChange,
  presence,
  projects,
  intelligence,
}: VaeoraWorkspaceShellProps) {
  const [internalActiveView, setInternalActiveView] =
    useState<WorkspaceView>(initialView);
  const activeView = controlledActiveView ?? internalActiveView;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const copy = WORKSPACE_COPY[locale];
  const content: Record<WorkspaceView, ReactNode> = {
    presence,
    projects,
    intelligence,
  };

  function selectView(view: WorkspaceView, focus = false) {
    if (controlledActiveView === undefined) {
      setInternalActiveView(view);
    }
    onViewChange?.(view);

    if (focus) {
      const index = VIEW_ORDER.indexOf(view);
      tabRefs.current[index]?.focus();
    }
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % VIEW_ORDER.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = VIEW_ORDER.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    selectView(VIEW_ORDER[nextIndex], true);
  }

  return (
    <main className={styles.shell}>
      <div className={styles.ambient} aria-hidden="true" />

      <header className={styles.chrome}>
        <div className={styles.chromeInner}>
          <Link
            className={styles.brand}
            href="/"
            aria-label="VAEORA"
          >
            <span className={styles.wordmark}>VAEORA</span>
            <span className={styles.workspaceLabel}>{copy.workspace}</span>
          </Link>

          <nav
            className={styles.navigation}
            aria-label={copy.navigation}
          >
            <div className={styles.tabList} role="tablist">
              {VIEW_ORDER.map((view, index) => {
                const selected = activeView === view;

                return (
                  <button
                    key={view}
                    ref={(element) => {
                      tabRefs.current[index] = element;
                    }}
                    id={`vaeora-tab-${view}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={`vaeora-panel-${view}`}
                    tabIndex={selected ? 0 : -1}
                    className={styles.tab}
                    data-active={selected ? "true" : "false"}
                    data-state={selected ? "active" : "inactive"}
                    onClick={() => selectView(view)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                  >
                    <span className={styles.tabIndex} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{copy.views[view].label}</span>
                    <span
                      className={styles.tabSelection}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          <div className={styles.identityStatus}>
            {VAEORA_SUPPORT_URL ? (
              <Link className={styles.supportLink} href="/support">
                Support
              </Link>
            ) : null}
            <span className={styles.statusDot} aria-hidden="true" />
            <span className={styles.statusText}>{copy.auraStatus}</span>
            <span className={styles.userName}>{userName}</span>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        {VIEW_ORDER.map((view) => {
          const viewCopy = copy.views[view];

          return (
            <section
              key={view}
              id={`vaeora-panel-${view}`}
              role="tabpanel"
              aria-labelledby={`vaeora-tab-${view}`}
              hidden={activeView !== view}
              className={styles.panel}
            >
              <header className={styles.panelHeader}>
                <p className={styles.eyebrow}>{viewCopy.eyebrow}</p>
                <div className={styles.panelHeading}>
                  <h1>{viewCopy.title}</h1>
                  <p>{viewCopy.description}</p>
                </div>
              </header>

              <div className={styles.panelBody}>{content[view]}</div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
