import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => [{ id: "legacy", name: "Legacy", description: "", goal: "", createdAt: "2026-08-16T00:00:00.000Z", updatedAt: "2026-08-16T00:00:00.000Z", status: "planning", kind: "general", studios: { branding: false, website: false, app: false, marketing: false, documents: false } }]);
vi.mock("@/core/project/ProjectRepository", () => ({ LocalProjectRepository: class { getProjects() { return structuredClone(fixture); } } }));

import FounderProjectImport from "../FounderProjectImport";

describe("FounderProjectImport", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ sourceCount: 1, matchedCount: 1 }) }));
  });

  it("reaches the import server boundary with local projects and no owner UUID", async () => {
    render(<FounderProjectImport />);
    fireEvent.click(screen.getByRole("button", { name: /Importar proyectos locales/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/projects/import", expect.objectContaining({ method: "POST", body: expect.not.stringContaining("userId") }));
    expect(fixture).toHaveLength(1);
  });

  it("reports a controlled transport failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<FounderProjectImport />);
    fireEvent.click(screen.getByRole("button", { name: /Importar proyectos locales/i }));
    expect(await screen.findByText(/no pudo llegar al servidor local/i)).toBeInTheDocument();
  });
});
