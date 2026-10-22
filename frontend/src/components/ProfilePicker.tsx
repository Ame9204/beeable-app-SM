import { PROFILES } from "../config";
import type { Profile } from "../types";
import type { Language } from "../account";
import { useT } from "../i18n";
import { Icon, PROFILE_ICON } from "./Icon";

export function ProfilePicker({
  profile,
  onChange,
  compact = false,
  legend,
  lang,
}: {
  profile: Profile;
  onChange: (p: Profile) => void;
  compact?: boolean;
  legend?: string;
  /** Override the app language (the setup screen previews the language being picked). */
  lang?: Language;
}) {
  const { t } = useT(lang);
  return (
    <fieldset className={compact ? "segmented compact" : "segmented"}>
      <legend className={compact ? "visually-hidden" : undefined}>{legend ?? t("profile.legend")}</legend>
      {PROFILES.map((p) => (
        <label key={p.id} className="segment">
          <input type="radio" name="profile" value={p.id} checked={profile === p.id} onChange={() => onChange(p.id)} />
          <span className="segment-body">
            <span className="segment-icon">
              <Icon name={PROFILE_ICON[p.id]} size={compact ? 20 : 26} />
            </span>
            <span className="segment-label">{t(`profile.${p.id}.label`)}</span>
            {!compact && <span className="segment-hint">{t(`profile.${p.id}.hint`)}</span>}
            {!compact && <span className="segment-example">{t(`profile.${p.id}.example`)}</span>}
            <span className="segment-check">
              <Icon name="check" size={16} />
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
