import { useState } from 'react';
import { TextInput } from 'react-native';

import palette from '@/constants/palette.json';

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  /** Permite decimales (peso). Sin esto solo acepta enteros (reps). */
  decimal?: boolean;
  accessibilityLabel: string;
}

/**
 * Campo numérico controlado por el store.
 *
 * Mientras se escribe mantiene su propio texto: así "82." o un campo vacío no se
 * "corrigen" solos a mitad de escritura. Al escribir un número válido lo confirma al store
 * de inmediato. En iPhone con teclado en español el separador decimal es la coma, por eso se
 * normaliza a punto.
 */
export function NumberField({ value, onChange, decimal = false, accessibilityLabel }: NumberFieldProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const pattern = decimal ? /^\d*[.,]?\d*$/ : /^\d*$/;

  function handleChange(next: string) {
    if (!pattern.test(next)) return;
    setText(next);
    const parsed = Number(next.replace(',', '.'));
    if (next !== '' && Number.isFinite(parsed)) onChange(parsed);
  }

  return (
    <TextInput
      value={focused ? text : String(value)}
      onChangeText={handleChange}
      onFocus={() => {
        setText(String(value));
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      maxLength={6}
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={palette.muted}
      className="h-11 min-w-[72px] rounded-lg border border-line bg-elevated px-3 text-center text-base font-semibold text-ink"
    />
  );
}
