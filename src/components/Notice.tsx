import { Text, View } from 'react-native';

const NOTICE_STYLES = {
  info: { box: 'border-line bg-surface', title: 'text-ink' },
  warn: { box: 'border-funcional/40 bg-funcional/10', title: 'text-funcional' },
  error: { box: 'border-danger/40 bg-danger/10', title: 'text-danger' },
} as const;

/** Aviso destacado: informativo, de advertencia o de error. */
export function Notice({ tone, title, body }: { tone: keyof typeof NOTICE_STYLES; title: string; body: string }) {
  const style = NOTICE_STYLES[tone];
  return (
    <View className={`gap-1.5 rounded-2xl border p-4 ${style.box}`}>
      <Text className={`text-base font-semibold ${style.title}`}>{title}</Text>
      <Text className="text-sm text-muted">{body}</Text>
    </View>
  );
}
