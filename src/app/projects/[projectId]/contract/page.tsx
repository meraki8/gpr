import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { ContractPanel } from "@/components/contract-panel";
import { getNavContext, getProjectContract } from "@/lib/data";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [nav, { project, contract, isOwner, hasSigned, user }] =
    await Promise.all([
      getNavContext({ projectId }),
      getProjectContract(projectId),
    ]);

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{ id: project.id, name: project.name }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Contract · ${project.name}`}
          title={contract ? "Group Contract" : "No contract yet."}
          sub={
            contract
              ? `${contract.signatures.length} of ${project.members.length} member${project.members.length === 1 ? "" : "s"} signed.`
              : isOwner
                ? "Generate an AI contract based on your project brief and members."
                : "The project owner hasn't generated a contract yet."
          }
        />

        <ContractPanel
          projectId={projectId}
          contract={
            contract
              ? {
                  id: contract.id,
                  content: contract.content,
                  createdAt: contract.createdAt.toISOString(),
                  signatures: contract.signatures.map((s) => ({
                    userId: s.userId,
                    signedAt: s.signedAt.toISOString(),
                    userName: s.user.name ?? s.user.email,
                  })),
                }
              : null
          }
          members={project.members.map((m) => ({
            userId: m.userId,
            name: m.user.name ?? m.user.email,
            role: m.role,
          }))}
          isOwner={isOwner}
          hasSigned={hasSigned}
          currentUserId={user.id}
          currentUserName={user.name ?? null}
          currentUserEmail={user.email}
        />
      </main>
    </AppShell>
  );
}
