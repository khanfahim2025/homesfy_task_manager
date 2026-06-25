import {
  dueDateTimeToIso,
  parseDueDateTime,
  type DueDateTimeParts,
} from '../lib/format';

interface Props {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
}

const HOURS = ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function updateParts(
  current: DueDateTimeParts,
  patch: Partial<DueDateTimeParts>,
  onChange: (iso: string | null) => void
) {
  const next = { ...current, ...patch };
  if (!next.date) {
    onChange(null);
    return;
  }
  onChange(dueDateTimeToIso(next));
}

export function DueDateTimeInput({ value, onChange, disabled }: Props) {
  const parts = parseDueDateTime(value);

  return (
    <div className="space-y-2">
      <input
        type="date"
        className="input"
        disabled={disabled}
        value={parts.date}
        onChange={(e) => updateParts(parts, { date: e.target.value }, onChange)}
      />
      <div className="grid grid-cols-3 gap-2">
        <select
          className="input"
          disabled={disabled || !parts.date}
          value={parts.hour12}
          onChange={(e) => updateParts(parts, { hour12: e.target.value }, onChange)}
          aria-label="Due hour"
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <select
          className="input"
          disabled={disabled || !parts.date}
          value={parts.minute}
          onChange={(e) => updateParts(parts, { minute: e.target.value }, onChange)}
          aria-label="Due minute"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="input"
          disabled={disabled || !parts.date}
          value={parts.meridiem}
          onChange={(e) => updateParts(parts, { meridiem: e.target.value as 'AM' | 'PM' }, onChange)}
          aria-label="AM or PM"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      <p className="text-[11px] text-slate-400">Time uses 12-hour format (AM / PM)</p>
    </div>
  );
}
