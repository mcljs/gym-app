import { Pressable, Text } from "react-native";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const CONTAINER: Record<Variant, string> = {
  primary: "bg-accent hover:bg-accent/90",
  secondary: "bg-elevated border border-line hover:bg-line",
  danger: "bg-danger/15 border border-danger/40",
  ghost: "",
};

const LABEL: Record<Variant, string> = {
  primary: "text-bg",
  secondary: "text-ink",
  danger: "text-danger",
  ghost: "text-muted",
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  className?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  className = "",
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={`items-center justify-center min-h-12 rounded-full px-5 py-3.5 active:opacity-70 ${CONTAINER[variant]} ${
        disabled ? "opacity-40" : ""
      } ${className}`}
    >
      <Text className={`text-base font-semibold ${LABEL[variant]}`}>
        {label}
      </Text>
    </Pressable>
  );
}
