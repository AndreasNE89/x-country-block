import { filteringActive, parseSettings, SETTINGS_KEYS } from "../shared/settings.ts";
import type { Settings } from "../shared/types.ts";

type Changes = Record<string, { oldValue?: unknown; newValue?: unknown }>;

export function hasPicks(settings: Settings): boolean {
  return (
    settings.hiddenCountryCodes.length > 0 ||
    settings.hiddenLanguageCodes.length > 0 ||
    settings.hiddenRegionIds.length > 0
  );
}

/** Whether the content script has any matching to do: not paused, not locked, something ticked. */
export function matchingActive(settings: Settings): boolean {
  return filteringActive(settings) && hasPicks(settings);
}

export function sameSettings(a: Settings, b: Settings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The stored settings keys and what they parse to. Changes arrive from storage.onChanged, and
 * refresh() re-parses with the current time so a trial that ends in an open tab takes effect.
 */
export class SettingsState {
  private raw: Record<string, unknown> = {};
  current: Settings;

  constructor(now: number) {
    this.current = parseSettings(this.raw, now);
  }

  /** Replace every settings key (startup). Returns true when the parsed settings changed. */
  load(raw: Record<string, unknown>, now: number): boolean {
    this.raw = {};
    for (const key of SETTINGS_KEYS) {
      if (raw[key] !== undefined) this.raw[key] = raw[key];
    }
    return this.reparse(now);
  }

  /** Apply a storage.onChanged batch. Returns true when a settings key changed the result. */
  applyChanges(changes: Changes, now: number): boolean {
    let touched = false;
    for (const key of SETTINGS_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
      touched = true;
      const next = changes[key]?.newValue;
      if (next === undefined) delete this.raw[key];
      else this.raw[key] = next;
    }
    return touched && this.reparse(now);
  }

  refresh(now: number): boolean {
    return this.reparse(now);
  }

  private reparse(now: number): boolean {
    const next = parseSettings(this.raw, now);
    const changed = !sameSettings(this.current, next);
    this.current = next;
    return changed;
  }
}
