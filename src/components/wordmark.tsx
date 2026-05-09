export function Wordmark({ small }: { small?: boolean }) {
  return (
    <span
      className="inline-flex items-baseline gap-1.5"
      style={{ lineHeight: 1 }}
    >
      <span
        style={{
          fontWeight: 600,
          fontSize: small ? 18 : 22,
          letterSpacing: "-0.02em",
        }}
      >
        GPR
      </span>
      <span
        className="inline-block"
        style={{
          width: 4,
          height: 4,
          background: "var(--red)",
          marginBottom: small ? 3 : 4,
        }}
      />
    </span>
  );
}
