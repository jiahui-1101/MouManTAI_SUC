import { Button } from "../../../components/ui";

export function RecoveryModeSwitch({ recovery, onChange }: { recovery: boolean; onChange: (value: boolean) => void }) {
  return <div role="group" aria-label="Demo scenario" style={{ display: "flex", gap: 6, marginBottom: 10 }}>
    <Button size="sm" variant={!recovery ? "primary" : "secondary"} aria-pressed={!recovery} onClick={() => onChange(false)}>Normal operations</Button>
    <Button size="sm" variant={recovery ? "primary" : "secondary"} aria-pressed={recovery} onClick={() => onChange(true)}>Supply disruption</Button>
  </div>;
}
