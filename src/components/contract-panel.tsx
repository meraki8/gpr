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
}: {
  projectId: string;
  contract: Contract | null;
  members: Member[];
  isOwner: boolean;
  hasSigned: boolean;
  currentUserId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(contract?.content ?? "");
  const [typedName, setTypedName] = useState("");
  const [signed, setSigned] = useState(hasSigned);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
    startTransition(async () => {
      try {
        await signContract(projectId, typedName);
        setSigned(true);
        setTypedName("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to sign contract");
      }
    });
  }

  const signedIds = new Set(contract?.signatures.map((s) => s.userId) ?? []);

  return (
    <div style={{ maxWidth: 780 }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            marginBottom: 24,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 6,
            fontSize: 14,
            color: "#991b1b",
          }}
        >
          {error}
        </div>
      )}

      {!contract ? (
        // No contract yet
        isOwner ? (
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={isPending}
            style={{ marginBottom: 40 }}
          >
            {isPending ? "Generating…" : "Generate Contract"}
          </button>
        ) : null
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
              position: "relative",
            }}
          >
            {isEditing ? (
              <>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: 480,
                    fontSize: 14,
                    lineHeight: 1.7,
                    fontFamily: "inherit",
                    border: "1px solid var(--line)",
                    borderRadius: 4,
                    padding: "16px",
                    resize: "vertical",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button
                    className="btn-primary"
                    onClick={handleSaveEdit}
                    disabled={isPending || !editContent.trim()}
                  >
                    {isPending ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    className="btn-ghost"
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
                    className="btn-ghost"
                    style={{ textDecoration: "none" }}
                  >
                    Download PDF
                  </a>
                  {isOwner && (
                    <>
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          setEditContent(contract.content);
                          setIsEditing(true);
                        }}
                      >
                        Edit contract
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={handleGenerate}
                        disabled={isPending}
                        style={{ color: "var(--mute)" }}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                      background: sig ? "var(--paper)" : "var(--bg)",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {m.name}
                      </span>
                      <span
                        className="mute-ink"
                        style={{ fontSize: 12, marginLeft: 8 }}
                      >
                        {m.role}
                      </span>
                    </div>
                    {sig ? (
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#16a34a",
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                          }}
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
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--mute)",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        Pending
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Sign section — shown to unsigned members */}
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
              <p className="body mute-ink" style={{ fontSize: 13, marginBottom: 24 }}>
                Type your full name below to confirm you have read and agree to the terms of this contract.
              </p>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <label
                    htmlFor="typed-name"
                    style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--mute)", display: "block", marginBottom: 6 }}
                  >
                    Full name
                  </label>
                  <input
                    id="typed-name"
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    placeholder="Type your name exactly"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: 15,
                      fontFamily: "Georgia, serif",
                      fontStyle: "italic",
                      border: "1px solid var(--line)",
                      borderRadius: 4,
                      background: "var(--bg)",
                      color: "var(--ink)",
                      boxSizing: "border-box",
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && typedName.trim()) handleSign();
                    }}
                  />
                </div>
                <button
                  className="btn-primary"
                  onClick={handleSign}
                  disabled={isPending || !typedName.trim()}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {isPending ? "Signing…" : "I agree — sign contract"}
                </button>
              </div>
            </section>
          ) : (
            <section
              style={{
                marginTop: 40,
                padding: "24px 32px",
                border: "1px solid #86efac",
                borderRadius: 8,
                background: "#f0fdf4",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#16a34a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "#fff",
                  fontSize: 18,
                }}
              >
                ✓
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d" }}>
                  You have signed this contract
                </div>
                <div style={{ fontSize: 13, color: "#16a34a", marginTop: 2 }}>
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
