import { Alert, Platform } from 'react-native';

/** Confirmación para acciones que borran datos. `Alert.alert` no funciona en web. */
export function confirmDestructive(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Quitar', style: 'destructive', onPress: onConfirm },
  ]);
}
