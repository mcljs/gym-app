import { Pressable, Text, View } from "react-native";

interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/** Control [−] valor [+] para enteros pequeños (series, reps objetivo). */
export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 100,
}: StepperProps) {
  return (
    <View className="min-w-[96px] flex-1 items-center gap-2">
      <Text className="text-xs text-muted">{label}</Text>
      <View className="w-full flex-row items-center justify-between rounded-xl bg-elevated">
        <Pressable
          onPress={() => onChange(value - 1)}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityState={{ disabled: value <= min }}
          accessibilityLabel={`Menos ${label}`}
          className={`h-11 w-9 items-center justify-center rounded-lg bg-elevated active:opacity-70 ${
            value <= min ? "opacity-30" : ""
          }`}
        >
          <Text className="text-lg font-semibold text-ink">−</Text>
        </Pressable>
        <Text className="min-w-[22px] text-center text-base font-bold text-accent">
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(value + 1)}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityState={{ disabled: value >= max }}
          accessibilityLabel={`Más ${label}`}
          className={`h-11 w-9 items-center justify-center rounded-lg bg-elevated active:opacity-70 ${
            value >= max ? "opacity-30" : ""
          }`}
        >
          <Text className="text-lg font-semibold text-ink">+</Text>
        </Pressable>
      </View>
    </View>
  );
}
