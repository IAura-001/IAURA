export function sanitizeAuraResponse(value: string): string {
  return value
    .replace(/```(?:[a-zA-Z0-9_-]+)?\s*/g, "")
    .replace(/```/g, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^ {0,3}#{1,6}\s*/gm, "")
    .replace(/^ {0,3}>\s?/gm, "")
    .replace(/^ {0,3}[-*+]\s+/gm, "")
    .replace(/^ {0,3}[•◦▪▫]\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*\|?[-:]+(?:\|[-:]+)+\|?\s*$/gm, "")
    .replace(/\|/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createNamingResponse(): string {
  return `
Propuestas de nombre

Novara

Combina novedad, movimiento y una sensación de futuro. Suena premium, simple y fácil de recordar.

Nexora

Comunica conexión, evolución y dirección. Funciona bien para una plataforma que organiza proyectos y decisiones.

Lumora

Evoca claridad, inteligencia y guía. Tiene una personalidad humana, elegante y tecnológica.

Aveniq

Sugiere avance, visión y precisión. Su sonido es moderno y distintivo.

Orvian

Transmite estructura, confianza y ambición. Puede crecer con una marca internacional.

Elara

Suena serena, inteligente y cercana. Es apropiada para una asistente creativa con presencia propia.

Nuvora

Une la idea de algo nuevo con una atmósfera futurista. Es flexible para producto, comunidad y ecosistema.

Aurevia

Evoca una ruta guiada por inteligencia. Tiene una sensación sofisticada y humana.

Veyra

Es breve, clara y memorable. Proyecta velocidad, precisión y personalidad.

Nexia

Comunica unión entre ideas, personas y proyectos. Tiene una pronunciación sencilla y un carácter tecnológico.

Recomendación principal

Nexora

Es el nombre más equilibrado para una plataforma que ayuda a crear, organizar y tomar decisiones. Suena futurista sin ser fría, permite construir una identidad visual fuerte y puede extenderse a diferentes productos dentro del ecosistema.
  `.trim();
}

function createPersonalityResponse(): string {
  return `
Personalidad de marca

Visionaria

Observa más allá de la tarea inmediata y ayuda a convertir ideas en dirección.

Precisa

Responde con claridad, estructura y atención a los detalles importantes.

Serena

No abruma ni compite por atención. Transmite control incluso en proyectos complejos.

Creativa

Propone caminos originales y conecta ideas que normalmente estarían separadas.

Confiable

Recuerda el contexto del proyecto y mantiene coherencia entre decisiones.

Tono de voz

Claro, directo, inteligente y humano.

Debe evitar exageraciones, frases genéricas y respuestas demasiado largas. Cada intervención debe sentirse pensada para el proyecto específico.
  `.trim();
}

function createMissionResponse(): string {
  return `
Misión

Ayudar a las personas a convertir ideas en proyectos claros, coherentes y realizables mediante una inteligencia que comprende el contexto, organiza el proceso creativo y acompaña cada decisión importante.

Versión breve

Transformar ideas en proyectos con dirección.
  `.trim();
}

function createVisionResponse(): string {
  return `
Visión

Crear una nueva forma de trabajar con inteligencia artificial, donde cada proyecto tenga memoria, dirección y una presencia capaz de acompañar su evolución desde la primera idea hasta su lanzamiento.

Aspiración

Convertirse en el sistema creativo de referencia para personas y equipos que quieren construir con mayor claridad, precisión y continuidad.
  `.trim();
}

function createLogoResponse(): string {
  return `
Dirección de logo

Concepto principal

Un símbolo formado por una órbita incompleta que rodea un punto de luz. La órbita representa el proyecto en evolución y el punto representa la inteligencia que organiza y guía.

Forma

Geométrica, limpia y reconocible incluso en tamaños pequeños.

Composición

Símbolo independiente para icono de aplicación.

Símbolo junto al nombre para la firma principal.

Versión monocromática para documentos y fondos claros.

Sensación

Futurista, premium, serena y viva.

Debe evitar robots, cerebros, circuitos obvios y estrellas genéricas.
  `.trim();
}

function createColorsResponse(): string {
  return `
Paleta propuesta

Color principal

Violeta eléctrico profundo

Uso recomendado

Acciones principales, estados activos y momentos de energía visual.

Color secundario

Azul nocturno

Uso recomendado

Profundidad, superficies y transiciones.

Acento

Lavanda luminosa

Uso recomendado

Destellos, indicadores y detalles de presencia.

Fondo

Negro con matiz violeta

Uso recomendado

Interfaz principal y escenas cinematográficas.

Texto principal

Blanco suave

Texto secundario

Gris frío

Dirección general

La paleta debe sentirse tecnológica sin parecer agresiva. El contraste debe ser alto y los efectos luminosos deben utilizarse con moderación.
  `.trim();
}

function createTypographyResponse(): string {
  return `
Sistema tipográfico

Tipografía principal

Una sans serif moderna, limpia y de alta legibilidad para interfaz, navegación y textos funcionales.

Tipografía de expresión

Una sans serif geométrica o editorial para titulares, campañas y momentos de marca.

Jerarquía

Titulares grandes con espaciado compacto.

Subtítulos claros con peso medio.

Texto de interfaz breve y legible.

Etiquetas en mayúsculas con espaciado amplio, utilizadas solo para organización.

Principio

La tipografía debe comunicar precisión y calma. Debe evitar estilos excesivamente tecnológicos que reduzcan la legibilidad.
  `.trim();
}

function createStyleResponse(): string {
  return `
Dirección visual

Atmósfera

Oscura, profunda y cinematográfica.

Elementos principales

Espacios amplios.

Capas translúcidas.

Luz violeta controlada.

Órbitas, partículas y movimiento lento.

Contraste entre superficies oscuras y puntos de energía.

Composición

Minimalista y funcional. Cada elemento debe tener una razón clara para estar presente.

Movimiento

Suave, continuo y preciso. Las animaciones deben transmitir que IAURA está pensando y conectando información, no simplemente decorando la pantalla.

Principio central

IAURA debe sentirse antes de entenderse.
  `.trim();
}

export function generateAIResponse(prompt: string): string {
  const normalizedPrompt = prompt.toLowerCase();

  let response: string;

  if (normalizedPrompt.includes("naming")) {
    response = createNamingResponse();
  } else if (
    normalizedPrompt.includes("personalidad") ||
    normalizedPrompt.includes("personality")
  ) {
    response = createPersonalityResponse();
  } else if (
    normalizedPrompt.includes("misión") ||
    normalizedPrompt.includes("mision") ||
    normalizedPrompt.includes("mission")
  ) {
    response = createMissionResponse();
  } else if (
    normalizedPrompt.includes("visión") ||
    normalizedPrompt.includes("vision")
  ) {
    response = createVisionResponse();
  } else if (normalizedPrompt.includes("logo")) {
    response = createLogoResponse();
  } else if (
    normalizedPrompt.includes("colores") ||
    normalizedPrompt.includes("colors") ||
    normalizedPrompt.includes("paleta")
  ) {
    response = createColorsResponse();
  } else if (
    normalizedPrompt.includes("tipografía") ||
    normalizedPrompt.includes("tipografia") ||
    normalizedPrompt.includes("typography")
  ) {
    response = createTypographyResponse();
  } else if (
    normalizedPrompt.includes("estilo visual") ||
    normalizedPrompt.includes("style")
  ) {
    response = createStyleResponse();
  } else {
    response = `
Entendí la solicitud.

La propuesta debe construirse alrededor del objetivo principal del proyecto, mantener una dirección clara y evitar decisiones genéricas.

Siguiente enfoque recomendado

Definir el resultado deseado.

Identificar las decisiones que tienen mayor impacto.

Crear una primera propuesta concreta.

Evaluarla según claridad, coherencia y utilidad.

Refinarla sin perder la intención original.
    `.trim();
  }

  return sanitizeAuraResponse(response);
}
