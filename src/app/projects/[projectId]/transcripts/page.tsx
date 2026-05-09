import { AppShell } from "@/components/app-shell";
import { PageHead } from "@/components/page-head";
import { TranscriptArchive } from "@/components/transcript-archive";
import { TranscriptUploadForm } from "@/components/transcript-upload-form";
import { requireDbUser } from "@/lib/auth";
import { getNavContext, getProjectTranscripts } from "@/lib/data";

export default async function TranscriptsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [user, nav, { project, isOwner, canRunAnalysis }] =
    await Promise.all([
      requireDbUser(),
      getNavContext({ projectId }),
      getProjectTranscripts(projectId),
    ]);
  const roleLabel = isOwner ? "Owner" : "Member";

  // Slim shape for the client archive — keeps avatars/initials and
  // the "By me" filter working without overfetching.
  const archiveItems = project.transcripts.map((t) => ({
    id: t.id,
    title: t.title,
    meetingAt: t.meetingAt ? t.meetingAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    source: t.source,
    kbEntryCount: t.kbEntryCount,
    uploaderId: t.uploadedBy,
    uploader: {
      name: t.uploader.name,
      email: t.uploader.email,
    },
    matchReports: t.matchReports,
  }));

  return (
    <AppShell
      user={user}
      allGroups={nav.allGroups}
      activeGroup={nav.activeGroup}
      groupProjects={nav.groupProjects}
      currentProject={{
        id: project.id,
        name: project.name,
        deadlineIso: project.deadline?.toISOString() ?? null,
      }}
    >
      <main className="wrap-w" style={{ paddingBottom: 160 }}>
        <PageHead
          eyebrow={`Transcripts · ${project.name}`}
          title={
            project.transcripts.length === 0
              ? "Nothing's been refereed yet."
              : `${project.transcripts.length} meeting${project.transcripts.length === 1 ? "" : "s"} on file.`
          }
          sub="Drop a transcript and the ref drafts a Match Report. Key facts auto-flow into the Knowledge Base."
        />

        <section
          style={{
            padding: "8px 0 56px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div className="label">New transcript</div>
            <span
              className="mute-ink"
              style={{ fontSize: 11, letterSpacing: "0.04em" }}
              title={`You: ${user.email}`}
            >
              You · {roleLabel}
            </span>
          </div>
          {canRunAnalysis ? (
            <TranscriptUploadForm projectId={project.id} />
          ) : (
            <p
              role="alert"
              style={{
                fontSize: 14,
                margin: 0,
                padding: "16px 18px",
                border: "1px solid var(--line)",
                borderRadius: 6,
                background: "var(--paper)",
                maxWidth: 640,
              }}
            >
              You do not have permission to run analysis on this
              project.{" "}
              <span className="mute-ink" style={{ fontSize: 13 }}>
                Ask the project owner to enable{" "}
                <code style={{ fontSize: 12 }}>run_analysis</code> on
                your member row.
              </span>
            </p>
          )}
        </section>

        <TranscriptArchive
          projectId={project.id}
          transcripts={archiveItems}
          viewerId={user.id}
        />
      </main>
    </AppShell>
  );
}
