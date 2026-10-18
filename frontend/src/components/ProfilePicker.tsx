import { PROFILES } from "../config";
import type { Profile } from "../types";
import { Icon, PROFILE_ICON } from "./Icon";

export function ProfilePicker({
  profile,
  onChange,
  compact = false,
  legend = "How do you get around?",
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  compact?: boolean;
  legend?: string;
}) {
  return (
    <fieldset className={compact ? "segmented compact" : "segmented"}>
      <legend className={compact ? "visually-hidden" : undefined}>{legend}</legend>
      {PROFILES.map((p) => (
        <label key={p.id} className="segment">
          <input type="radio" name="profile" value={p.id} checked={profile === p.id} onChange={() => onChange(p.id)} />
          <span className="segment-body">
            <span className="segment-icon">
              <Icon name={PROFILE_ICON[p.id]} size={compact ? 20 : 26} />
            </span>
            <span className="segment-label">{p.label}</span>
            {!compact && <span className="segment-hint">{p.hint}</span>}
            <span className="segment-check">
              <Icon name="check" size={16} />
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
