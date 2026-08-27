import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntelligenceRecord } from "@/core/intelligence/domain";
import type { IAuraProject } from "@/types/project";

const state = vi.hoisted(() => ({ projects: [] as IAuraProject[], records: [] as IntelligenceRecord[], listeners: new Set<() => void>(), load: vi.fn() }));
vi.mock("@/core/project/ProjectEngine", () => ({ projectEngine: { getProjects: vi.fn(() => structuredClone(state.projects)), subscribe: vi.fn((listener: () => void) => { state.listeners.add(listener); return () => state.listeners.delete(listener); }) } }));
vi.mock("@/core/intelligence/AuthenticatedIntelligenceRepository", () => ({ authenticatedIntelligenceRepository: { loadProjection: state.load } }));

import PersonalIntelligenceCenter from "../PersonalIntelligenceCenter";

const now = "2026-08-22T00:00:00.000Z";
const base = { userId: "user-a", createdAt: now, updatedAt: now };
const project = (id: string, name: string, goal = "Primary objective"): IAuraProject => ({ id, name, description: "", goal, createdAt: now, updatedAt: now, status: "building", kind: "business", studios: { branding: true, website: true, app: false, marketing: true, documents: false } });
const direction = (id: string, content: string, scopeType: "global" | "project" = "global", projectId: string | null = null): IntelligenceRecord => ({ ...base, id, type: "direction", scopeType, projectId, content, status: "active" });
const goal = (id: string, title: string, status: "active" | "completed" | "archived" = "active", scopeType: "global" | "project" = "global", projectId: string | null = null): IntelligenceRecord => ({ ...base, id, type: "goal", scopeType, projectId, title, status, targetDate: null });
const priority = (id: string, title: string, position: number, scopeType: "global" | "project" = "global", projectId: string | null = null): IntelligenceRecord => ({ ...base, id, type: "priority", scopeType, projectId, title, goalId: null, status: "active", position });
const commitment = (id: string, title: string, status: "active" | "paused" = "active"): IntelligenceRecord => ({ ...base, id, type: "recurring_commitment", scopeType: "global", projectId: null, title, status, cadence: "custom", cadenceDetail: "Mon / Wed / Fri" });

const renderCenter = (props: Partial<React.ComponentProps<typeof PersonalIntelligenceCenter>> = {}) => render(<PersonalIntelligenceCenter requestedProjectId={null} onShapeWithAura={vi.fn()} {...props} />);

describe("PersonalIntelligenceCenter", () => {
  beforeEach(() => { state.projects = []; state.records = []; state.listeners.clear(); state.load.mockReset(); state.load.mockImplementation(async () => structuredClone(state.records)); });

  it("uses contextual project surfaces and readable semantic roles", async () => {
    const { container } = renderCenter();
    await screen.findByText("Lo que importa ahora.");
    const surface = container.querySelector('[data-intelligence-surface="contextual"]');
    expect(surface).toBeInTheDocument();
    expect(surface?.className).toContain("--project-surface");
    expect(screen.getByText("Lo que importa ahora.").className).toContain("--project-text");
    expect(screen.getByText(/Una visión clara/).className).toContain("--project-text-secondary");
    expect(screen.getByRole("button", { name: "Dale forma con Aura" }).className).toContain("--project-action");
  });

  it("renders canonical global direction, goals, ordered priorities capped at three, and cadence", async () => {
    state.records = [direction("dir", "Build a disciplined life."), goal("goal", "Launch Intelligence"), priority("p3", "Third", 3), priority("p1", "First", 1), priority("p2", "Second", 2), priority("p4", "Never visible", 4), commitment("c1", "Cybersecurity study")];
    renderCenter();
    expect(await screen.findByText("Build a disciplined life.")).toBeVisible();
    expect(screen.getByText("Launch Intelligence")).toBeVisible();
    expect(screen.getByText("Mon / Wed / Fri")).toBeVisible();
    const items = screen.getByRole("heading", { name: "Prioridades actuales" }).closest("section")!.querySelectorAll("li");
    expect([...items].map((item) => item.textContent)).toEqual(["01First", "02Second", "03Third"]);
    expect(screen.queryByText("Never visible")).not.toBeInTheDocument();
  });

  it("separates a project's primary objective from additional canonical goals", async () => {
    state.projects = [project("a", "Project A", "Ship the product")];
    state.records = [goal("ag", "Global goal"), goal("pg", "Project intelligence goal", "active", "project", "a")];
    renderCenter({ requestedProjectId: "a" });
    await screen.findByText("Global goal");
    fireEvent.click(screen.getByRole("button", { name: "Proyecto" }));
    expect(screen.getByText("Objetivo principal del proyecto").parentElement).toHaveTextContent("Ship the product");
    expect(screen.getByText("Metas adicionales").parentElement).toHaveTextContent("Project intelligence goal");
  });

  it("filters completed goals and paused commitments and never reads legacy Memory", async () => {
    state.records = [goal("done", "Completed legacy-looking goal", "completed"), commitment("paused", "Paused habit", "paused")];
    renderCenter();
    await screen.findByText("Convierte una intención en un resultado concreto.");
    expect(screen.queryByText("Completed legacy-looking goal")).not.toBeInTheDocument();
    expect(screen.queryByText("Paused habit")).not.toBeInTheDocument();
    expect(screen.getByText("Define qué debe seguir ocurriendo.")).toBeVisible();
  });

  it("is global-only without an authenticated active project and shows all empty states", async () => {
    renderCenter({ requestedProjectId: "stale-memory-project" });
    expect(await screen.findByText("Dale a Aura una dirección desde la cual organizar.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Proyecto" })).not.toBeInTheDocument();
    expect(screen.queryByText("stale-memory-project")).not.toBeInTheDocument();
    expect(screen.getByText("Elige qué merece tu atención ahora.")).toBeVisible();
  });

  it("drops project A immediately while exact project B loads and preserves global data", async () => {
    state.projects = [project("a", "Project A"), project("b", "Project B")];
    state.records = [direction("global", "Global direction"), direction("a-dir", "Secret A", "project", "a")];
    const view = renderCenter({ requestedProjectId: "a" });
    await screen.findByText("Global direction");
    fireEvent.click(screen.getByRole("button", { name: "Proyecto" }));
    expect(screen.getByText("Secret A")).toBeVisible();
    state.records = [direction("global", "Global direction"), direction("b-dir", "Direction B", "project", "b")];
    view.rerender(<PersonalIntelligenceCenter requestedProjectId="b" onShapeWithAura={vi.fn()} />);
    expect(screen.queryByText("Secret A")).not.toBeInTheDocument();
    expect(await screen.findByText("Direction B")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Global" }));
    expect(screen.getByText("Global direction")).toBeVisible();
    expect(state.load).toHaveBeenLastCalledWith("b");
  });

  it("bridges management to Aura without directly mutating canonical Intelligence", async () => {
    const onShape = vi.fn();
    renderCenter({ onShapeWithAura: onShape });
    await screen.findByText("Dale a Aura una dirección desde la cual organizar.");
    fireEvent.click(screen.getByRole("button", { name: "Añadir prioridad" }));
    expect(onShape).toHaveBeenCalledWith({
      prompt: expect.stringContaining("Ámbito: global"),
      scopeType: "global",
      projectId: null,
    });
    expect(state.load).toHaveBeenCalledTimes(1);
  });

  it("captures stable project ID authority independently of the display name", async () => {
    const onShape = vi.fn();
    state.projects = [project("stable-a", "Same display name")];
    renderCenter({ requestedProjectId: "stable-a", onShapeWithAura: onShape });
    await screen.findByText("Dale a Aura una dirección desde la cual organizar.");
    fireEvent.click(screen.getByRole("button", { name: "Proyecto" }));
    fireEvent.click(screen.getByRole("button", { name: "Añadir prioridad" }));
    expect(onShape).toHaveBeenCalledWith(expect.objectContaining({ scopeType: "project", projectId: "stable-a" }));
  });

  it("refreshes canonical state only when its parent invalidates it", async () => {
    state.records = [goal("one", "First goal")];
    const view = renderCenter({ refreshKey: 0 });
    await screen.findByText("First goal");
    state.records = [goal("one", "First goal"), goal("two", "Confirmed goal")];
    view.rerender(<PersonalIntelligenceCenter requestedProjectId={null} refreshKey={1} onShapeWithAura={vi.fn()} />);
    expect(await screen.findByText("Confirmed goal")).toBeVisible();
    expect(state.load).toHaveBeenCalledTimes(2);
  });

  it("shows a local error and retries without stale content", async () => {
    state.load.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([direction("dir", "Recovered")]);
    renderCenter();
    expect(await screen.findByText("No se pudo cargar Inteligencia.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText("Recovered")).toBeVisible());
  });

  it("uses Spanish product chrome without translating canonical user content", async () => {
    const canonical = "Launch Visual Intelligence — 原文";
    state.records = [direction("dir", canonical), priority("long", "PrioridadSinEspaciosQueDebePoderAjustarseSinCrearDesbordamientoHorizontal", 1)];
    renderCenter();
    expect(await screen.findByText(canonical)).toHaveTextContent(canonical);
    expect(screen.getByText("Lo que importa ahora.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Dale forma con Aura" })).toBeVisible();
    expect(screen.getByText(/PrioridadSinEspacios/)).toHaveClass("[overflow-wrap:anywhere]");
  });

  it.each([320, 375, 390, 430])("keeps scope and section actions reachable at %ipx", async (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    state.records = [direction("dir", "Dirección canónica"), priority("priority", "Una prioridad extremadamente extensa que debe ajustarse con seguridad", 1), goal("goal", "Meta canónica"), commitment("commitment", "Compromiso canónico")];
    const { container } = renderCenter();
    await screen.findByText("Dirección canónica");

    expect(screen.getByRole("group", { name: "Ámbito de Inteligencia" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Gestionar con Aura" })).toHaveLength(3);
    expect(container.firstElementChild).toHaveClass("max-w-full");
    for (const heading of screen.getAllByRole("heading", { level: 2 })) {
      expect(heading.parentElement).toHaveClass("flex-wrap");
    }
    for (const action of screen.getAllByRole("button", { name: /Aura/ })) {
      expect(action).toHaveClass("max-w-full");
    }
  });
});
