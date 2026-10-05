import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native-paper';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange'> & {
  value: number | null;
  onChange: (value: number | null) => void;
  decimal?: boolean;
};

function parse(text: string, decimal: boolean): number | null {
  const clean = text.replace(',', '.').trim();
  if (!clean) return null;
  const n = decimal ? parseFloat(clean) : parseInt(clean, 10);
  return Number.isFinite(n) ? n : null;
}

/** Numeric input that accepts a comma or a dot and yields `number | null`. */
export function NumberField({ value, onChange, decimal = false, ...rest }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [prevValue, setPrevValue] = useState(value);

  // Sync when the value changes from outside (e.g. +2.5 kg).
  if (value !== prevValue) {
    setPrevValue(value);
    if (parse(text, decimal) !== value) setText(value == null ? '' : String(value));
  }

  return (
    <TextInput
      mode="outlined"
      dense
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      {...rest}
      value={text}
      onChangeText={(t) => {
        setText(t);
        onChange(parse(t, decimal));
      }}
    />
  );
}
