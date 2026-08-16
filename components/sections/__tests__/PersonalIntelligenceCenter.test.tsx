import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IAuraProject } from "@/types/project";

const state = vi.hoisted(() => ({ projects: [] as IAuraProject[], listeners: new Set<() => void>() }));
vi.mock("@/core/project/ProjectEngine", () => ({ projectEngine: {
  getProjects: vi.fn(() => structuredClone(state.projects)),
  subscribe: vi.fn((listener: () => void) => { state.listeners.add(listener); return () => state.listeners.delete(listener); }),
} }));

import PersonalIntelligenceCenter from "../PersonalIntelligenceCenter";

const project = (id: string, name: string): IAuraProject => ({ id, name, description: "", goal: "Crear con claridad", createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T01:00:00.000Z", status: "building", kind: "business", studios: { branding: true, website: true, app: false, marketing: true, documents: false } });

describe("PersonalIntelligenceCenter", () => {
  beforeEach(() => { state.projects = []; state.listeners.clear(); });

  it("shows only a project present in the authenticated repository", () => {
    state.projects = [project("safe", "Proyecto seguro")];
    const { rerender } = render(<PersonalIntelligenceCenter requestedProjectId="stale-local" onResetMemory={vi.fn()} />);
    expect(screen.queryByText("stale-local")).not.toBeInTheDocument();
    expect(screen.getByText("Proyecto seguro")).toBeVisible();
    rerender(<PersonalIntelligenceCenter requestedProjectId="safe" onResetMemory={vi.fn()} />);
    expect(screen.getByText("Crear con claridad")).toBeVisible();
  });

  it("keeps memory reset available only inside secondary management", () => {
    const onResetMemory = vi.fn();
    render(<PersonalIntelligenceCenter requestedProjectId={null} onResetMemory={onResetMemory} />);
    fireEvent.click(screen.getByText("04 · Gestión local"));
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar memoria local" }));
    expect(onResetMemory).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Local · pendiente")).toHaveLength(2);
  });
});
