"use client";

import { Download, Printer } from "lucide-react";
import { useState, useTransition } from "react";
import type { SerializedProgressReport } from "@/lib/progress-report";

export function ProgressReportActions({
  report,
}: {
  report: SerializedProgressReport;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  const handleDownload = () => {
    setError(null);
    startTransition(async () => {
      try {
        // Dynamic import — keeps @react-pdf/renderer (large) out of
        // the initial bundle. Only loaded when the user actually
        // clicks Download PDF.
        const [{ pdf }, { ProgressReportDocument }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("./progress-report-pdf"),
        ]);
        const instance = pdf(<ProgressReportDocument report={report} />);
        const blob = await instance.toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = buildFileName(report);
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Defer revoke so Safari finishes the download fetch.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        console.error("[progress-report] PDF generation failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to generate PDF",
        );
      }
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={handlePrint}
        className="pill pill-ghost"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <Printer size={14} strokeWidth={2.2} />
        Print
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={pending}
        className="pill pill-red"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          textDecoration: "none",
          cursor: pending ? "wait" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        <Download size={14} strokeWidth={2.2} />
        {pending ? "Generating…" : "Download PDF"}
      </button>
      {error && (
        <span
          role="alert"
          style={{ color: "var(--red)", fontSize: 12, marginLeft: 6 }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

function buildFileName(report: SerializedProgressReport): string {
  const slug =
    report.project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "project";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-progress-report-${date}.pdf`;
}
