"use client";

import { useState, useTransition } from "react";
import { generateContract, updateContract, signContract } from "@/app/projects/[projectId]/actions";

type Signature = {
  userId: string;
  signedAt: string;
  userName: string;
};

type Contract = {
  id: string;
  content: string;
  createdAt: string;
  signatures: Signature[];
};

type Member = {
  userId: string;
  name: string;
  role: string;
};

export function ContractPanel({
  projectId,
  contract,
  members,
  isOwner,
  hasSigned,
  currentUserId,
  currentUserName,
  currentUserEmail,
}: {
  projectId: string;
  contract: Contract | null;
  members: Member[];
  isOwner: boolean;
  hasSigned: boolean;
  currentUserId: string;
  currentUserName: string | null;
  currentUserEmail: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(contract?.content ?? "");
  const [typedName, setTypedName] = useState("");
  const [signed, setSigned] = useState(hasSigned);
  const [error, setError] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      try {
        await generateContract(projectId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to generate contract");
      }
    });
  }

  function handleSaveEdit() {
    setError(null);
    startTransition(async () => {
      try {
        await updateContract(projectId, editContent);
        setIsEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save contract");
      }
    });
  }

  function handleCancelEdit() {
    setEditContent(contract?.content ?? "");
    setIsEditing(false);
  }

  function handleSign() {
    setSignError(null);
    startTransition(async () => {
      try {
        await signContract(projectId, typedName);
        setSigned(true);
        setTypedName("");
      } catch (e) {
        setSignError(e instanceof Error ? e.message : "Failed to sign contract");
      }
    });
  }

  return (
    <div style={{ maxWidth: 780 }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            marginBottom: 24,
            background: "color-mix(in srgb, var(--red) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
            borderRadius: 6,
            fontSize: 14,
            color: "var(--red)",
          }}
        >
          {error}
        </div>
      )}

      {!contract ? (
        isOwner ? (
          <button
            className="pill"
            onClick={handleGenerate}
            disabled={isPending}
          >
            {isPending ? "Generating…" : "Generate Contract"}
          </button>
        ) : (
          <p className="mute-ink" style={{ fontSize: 14, margin: 0 }}>
            The project owner hasn&rsquo;t generated a contract yet. You&rsquo;ll be able to access the project once one is created and you&rsquo;ve signed it.
          </p>
        )
      ) : (
        <>
          {/* Contract text */}
          <section
            style={{
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "40px 48px",
              background: "var(--paper)",
              marginBottom: 32,
            }}
          >
            {isEditing ? (
              <>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="field field-lg"
                  style={{ minHeight: 480 }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    className="pill"
                    onClick={handleSaveEdit}
                    disabled={isPending || !editContent.trim()}
                  >
                    {isPending ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    className="pill pill-ghost"
                    onClick={handleCancelEdit}
                    disabled={isPending}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <pre
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 14,
                    lineHeight: 1.8,
                    margin: 0,
                    fontFamily: "inherit",
                    color: "var(--ink)",
                  }}
                >
                  {contract.content}
                </pre>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 32,
                    paddingTop: 24,
                    borderTop: "1px solid var(--line)",
                    flexWrap: "wrap",
                  }}
                >
                  <a
                    href={`/api/projects/${projectId}/contract-pdf`}
                    className="pill pill-ghost pill-sm"
                    style={{ textDecoration: "none" }}
                  >
                    Download PDF
                  </a>
                  {isOwner && (
                    <>
                      <button
                        className="pill pill-ghost pill-sm"
                        onClick={() => {
                          setEditContent(contract.content);
                          setIsEditing(true);
                        }}
                      >
                        Edit contract
                      </button>
                      <button
                        className="pill pill-ghost pill-sm"
                        onClick={handleGenerate}
                        disabled={isPending}
                      >
                        {isPending ? "Regenerating…" : "Regenerate"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </section>

          {/* Signature status */}
          <section>
            <div className="label" style={{ marginBottom: 20 }}>
              Signatures — {contract.signatures.length} / {members.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map((m) => {
                const sig = contract.signatures.find((s) => s.userId === m.userId);
                return (
                  <div
                    key={m.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 20px",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      background: "var(--paper)",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {m.name}
                      </span>
                      <span className="label" style={{ marginLeft: 10 }}>
                        {m.role}
                      </span>
                    </div>
                    {sig ? (
                      <div style={{ textAlign: "right" }}>
                        <div
                          className="label"
                          style={{ color: "var(--status-good)" }}
                        >
                          Signed
                        </div>
                        <div className="mute-ink num" style={{ fontSize: 11, marginTop: 2 }}>
                          {new Date(sig.signedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    ) : (
                      <span className="label">Pending</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Sign section */}
          {!signed ? (
            <section
              style={{
                marginTop: 40,
                padding: "32px 40px",
                border: "2px solid var(--ink)",
                borderRadius: 8,
                background: "var(--paper)",
              }}
            >
              <div className="label" style={{ marginBottom: 8 }}>
                Sign this contract
              </div>
              <p
                className="mute-ink"
                style={{ fontSize: 13, marginBottom: 24, margin: "8px 0 24px" }}
              >
                Type{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {currentUserName ?? currentUserEmail}
                </strong>{" "}
                exactly to confirm you have read and agree to the terms.
              </p>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <label
                    htmlFor="typed-name"
                    className="label"
                    style={{ display: "block", marginBottom: 8 }}
                  >
                    Full name
                  </label>
                  <input
                    id="typed-name"
                    type="text"
                    value={typedName}
                    onChange={(e) => {
                      setTypedName(e.target.value);
                      if (signError) setSignError(null);
                    }}
                    placeholder={currentUserName ?? currentUserEmail}
                    className="field"
                    style={{
                      fontFamily: "Georgia, serif",
                      fontStyle: "italic",
                      fontSize: 15,
                      borderColor: signError ? "var(--red)" : undefined,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && typedName.trim()) handleSign();
                    }}
                  />
                </div>
                <button
                  className="pill"
                  onClick={handleSign}
                  disabled={isPending || !typedName.trim()}
                  style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {isPending ? "Signing…" : "I agree — sign contract"}
                </button>
              </div>
              {signError && (
                <p
                  role="alert"
                  style={{
                    marginTop: 12,
                    marginBottom: 0,
                    fontSize: 13,
                    color: "var(--red)",
                  }}
                >
                  {signError}
                </p>
              )}
            </section>
          ) : (
            <section
              style={{
                marginTop: 40,
                padding: "24px 32px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--paper)",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--status-good)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                  fontSize: 16,
                }}
              >
                ✓
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--status-good)" }}>
                  You have signed this contract
                </div>
                <div className="mute-ink" style={{ fontSize: 13, marginTop: 2 }}>
                  Your signature has been recorded with a timestamp.
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
