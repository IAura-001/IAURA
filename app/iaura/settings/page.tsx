import Link from "next/link";
import AccountDataControls from "@/components/settings/AccountDataControls";
import { getAuthenticatedUser } from "@/core/auth/session";
import { getAuthenticatedProfile } from "@/core/profile/server";
import { listAuthenticatedProjects } from "@/core/project/server";

export default async function SettingsPage() {
  const user = await getAuthenticatedUser(); const profile = user ? await getAuthenticatedProfile(user.id) : null;
  const projects = user ? await listAuthenticatedProjects(user.id) : [];
  return <main className="min-h-screen bg-[#07070d] px-4 py-12 text-white sm:px-6">
    <div className="mx-auto max-w-3xl space-y-6"><header><Link href="/iaura" className="text-sm text-violet-300">← Workspace</Link>
      <h1 className="mt-4 text-3xl font-semibold">Data &amp; privacy</h1><p className="mt-2 text-zinc-400">Control your identity, portable project data, and account lifecycle.</p></header>
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">Identity &amp; security</h2>
        <dl className="mt-3 text-sm text-zinc-400"><div><dt>Display name</dt><dd className="text-white">{profile?.displayName ?? "Not set"}</dd></div><div className="mt-2"><dt>Email</dt><dd className="text-white">{user?.email ?? "Unavailable"}</dd></div></dl>
        <Link className="mt-4 inline-block text-sm text-violet-300" href="/forgot-password">Reset password</Link></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">Project exports</h2>
        <p className="mt-2 text-sm text-zinc-400">Each ZIP contains a versioned JSON manifest and available private asset originals. Missing binaries are identified in the manifest.</p>
        <ul className="mt-4 space-y-2">{projects.map((project) => <li key={project.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><span>{project.name}</span><a href={`/api/projects/${encodeURIComponent(project.id)}/export`} className="text-sm text-violet-300">Download ZIP</a></li>)}</ul>
        {!projects.length ? <p className="mt-3 text-sm text-zinc-500">No projects are available to export.</p> : null}</section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">What VAEORA stores</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-400"><p>Project, conversation, memory, identity, intelligence, Brand System, and creative metadata are stored so your workspace can continue across sessions.</p><p>Creative originals and previews are stored privately in cloud object storage; a device cache may improve speed. Access uses short-lived authorized links.</p><p>AI providers process the prompt, context, image, transcription, or speech input needed for the requested operation. Voice is optional. VAEORA records content-free operational usage and activation events for reliability, cost control, and product decisions.</p><p>This is product-facing disclosure, not an attorney-reviewed privacy policy. Formal Terms and Privacy documents require legal review before paid launch.</p></div></section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"><h2 className="text-lg font-semibold">Beta feedback &amp; support</h2><p className="mt-2 text-sm text-zinc-400">Measured-beta feedback is stored intentionally and separately from product analytics.</p><div className="mt-3 flex gap-4"><Link className="text-sm text-violet-300" href="/iaura/beta-feedback">Share beta feedback</Link><Link className="text-sm text-violet-300" href="/support">Get support</Link></div></section>
      <AccountDataControls />
    </div></main>;
}
