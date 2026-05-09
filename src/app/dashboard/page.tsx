import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { requireDbUser } from "@/lib/auth";
import { getMyGroups } from "@/lib/data";
import { createGroup } from "./actions";

// Dashboard is a first-run / no-groups landing page only. Once you
// belong to a group, the URL is the source of truth for the active
// context, and we send you straight into your most recent group so
// every page you load already has a sidebar context.
export default async function DashboardPage() {
  const [user, groups] = await Promise.all([
    requireDbUser(),
    getMyGroups(),
  ]);

  if (groups.length > 0) {
    // getMyGroups returns newest-first, so this is the most recently
    // created/joined group — the closest thing to "last active".
    redirect(`/groups/${groups[0].id}`);
  }

  return (
    <AppShell
      user={user}
      allGroups={[]}
      activeGroup={null}
      groupProjects={[]}
    >
      <main className="wrap-w" style={{ paddingBottom: 120 }}>
        <PageHead
          eyebrow="Welcome"
          title={`Hey, ${user.name?.split(" ")[0] ?? "there"}.`}
          sub="You're not in any groups yet. Create one below — or wait for a teammate to invite you."
        />

        <section style={{ marginTop: 40, maxWidth: 480 }}>
          <div className="label" style={{ marginBottom: 18 }}>
            New group
          </div>
          <form action={createGroup} style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              name="name"
              placeholder="e.g. Capstone Squad"
              required
              maxLength={100}
              className="field"
              style={{ flex: 1 }}
            />
            <button type="submit" className="pill pill-sm">
              Create →
            </button>
          </form>
          <p
            className="mute-ink"
            style={{ fontSize: 13, marginTop: 10 }}
          >
            Groups hold one or more projects. You become the owner.
          </p>
        </section>
      </main>
    </AppShell>
  );
}
