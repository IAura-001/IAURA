export function cleanAIText(text: string) {
  return text
    // Quitar títulos Markdown
    .replace(/^#{1,6}\s+/gm, "")

    // Quitar negritas y cursivas
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")

    // Quitar código inline
    .replace(/`(.*?)`/g, "$1")

    // Convertir listas en texto natural
    .replace(/^- /gm, "")
    .replace(/^\* /gm, "")

    // Quitar separadores
    .replace(/---/g, "")

    // Limpiar espacios extra
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}