import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native-paper';

import { formatDuration } from '@/lib/format';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange'> & {
  value: number | null;
  onChange: (value: number | null) => void;
};

/** "1:30" -> 90; "90" -> 90 seconds; "12:" -> 720. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (!t.includes(':')) {
    const n = parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
  }
  const parts = t.split(':').map((p) => parseInt(p || '0', 10));
  if (parts.some((p) => !Number.isFinite(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Duration input in m:ss format (or plain seconds). */
export function DurationField({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(value == null ? '' : formatDuration(value));
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    if (parseDuration(text) !== value) setText(value == null ? '' : formatDuration(value));
  }

  return (
    <TextInput
      mode="outlined"
      dense
      keyboardType="numbers-and-punctuation"
      placeholder="m:ss"
      selectTextOnFocus
      {...rest}
      value={text}
      onChangeText={(t) => {
        setText(t);
        onChange(parseDuration(t));
      }}
      onBlur={() => setText(value == null ? '' : formatDuration(value))}
    />
  );
}
