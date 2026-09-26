/** Id corto y único para plantillas, ejercicios y sets. Todo es local, no necesita UUID real. */
export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
