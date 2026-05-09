import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 64,
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.6,
    color: "#111",
  },
  header: {
    marginBottom: 40,
    borderBottom: "1.5pt solid #111",
    paddingBottom: 20,
  },
  projectName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerMeta: {
    fontSize: 10,
    color: "#555",
    letterSpacing: 0.3,
  },
  content: {
    marginBottom: 48,
    whiteSpace: "pre-wrap",
  },
  signaturesTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 20,
    color: "#555",
  },
  signatureRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 14,
    borderBottom: "0.5pt solid #ddd",
  },
  signatureName: {
    fontSize: 15,
    fontFamily: "Helvetica-Oblique",
    color: "#111",
  },
  signatureMeta: {
    fontSize: 9,
    color: "#888",
    textAlign: "right",
  },
  unsignedRow: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottom: "0.5pt solid #eee",
  },
  unsignedName: {
    fontSize: 11,
    color: "#999",
  },
  unsignedLabel: {
    fontSize: 9,
    color: "#bbb",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 64,
    right: 64,
    fontSize: 8,
    color: "#aaa",
    textAlign: "center",
  },
});

type Signature = {
  userId: string;
  userName: string;
  signedAt: string;
};

type Member = {
  userId: string;
  name: string;
  role: string;
};

export async function renderContractPdf({
  projectName,
  deadline,
  content,
  members,
  signatures,
  generatedAt,
}: {
  projectName: string;
  deadline: string | null;
  content: string;
  members: Member[];
  signatures: Signature[];
  generatedAt: string;
}): Promise<Buffer> {
  const signedMap = new Map(signatures.map((s) => [s.userId, s]));

  const doc = (
    <Document
      title={`${projectName} — Group Contract`}
      author="GPR · Group Project Referee"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.projectName}>{projectName}</Text>
          <Text style={styles.headerMeta}>
            Group Project Contract
            {deadline ? `  ·  Deadline: ${deadline}` : ""}
            {"  ·  Generated: "}
            {generatedAt}
          </Text>
        </View>

        {/* Contract body */}
        <View style={styles.content}>
          <Text>{content}</Text>
        </View>

        {/* Signatures */}
        <View>
          <Text style={styles.signaturesTitle}>Signatures</Text>
          {members.map((m) => {
            const sig = signedMap.get(m.userId);
            if (sig) {
              return (
                <View key={m.userId} style={styles.signatureRow}>
                  <Text style={styles.signatureName}>{sig.userName}</Text>
                  <Text style={styles.signatureMeta}>
                    {m.role}
                    {"  ·  Signed "}
                    {new Date(sig.signedAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              );
            }
            return (
              <View key={m.userId} style={styles.unsignedRow}>
                <Text style={styles.unsignedName}>{m.name}</Text>
                <Text style={styles.unsignedLabel}>Pending</Text>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          GPR · Group Project Referee · This document was generated automatically
          and constitutes a binding group accountability agreement.
        </Text>
      </Page>
    </Document>
  );

  return Buffer.from(await renderToBuffer(doc));
}
