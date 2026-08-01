import { buildProjectMemoryContext } from "@/core/context/ContextBuilder";
import { projectEngine } from "@/core/project/ProjectEngine";
import type {
  IAuraProject,
  LaunchAsset,
} from "@/types/project";

interface ProjectSignal {
  name: string;
  description: string;
  goal: string;
  approvedAssets: LaunchAsset[];
  memoryContext: string;
}

interface NamingCandidate {
  name: string;
  meaning: string;
  personality: string;
  fit: string;
}

const NAMING_POOL: NamingCandidate[] = [
  {
    name: "Nexora",
    meaning: "Conecta la idea de enlace, evolución y dirección.",
    personality: "Futurista, precisa y segura.",
    fit: "Funciona para una plataforma que une ideas, decisiones y proyectos.",
  },
  {
    name: "Lumora",
    meaning: "Evoca claridad, inteligencia y una luz que guía.",
    personality: "Humana, elegante y serena.",
    fit: "Encaja con una presencia que ayuda a avanzar sin abrumar.",
  },
  {
    name: "Aveniq",
    meaning: "Combina avance, visión y singularidad.",
    personality: "Premium, ambiciosa y moderna.",
    fit: "Puede crecer como nombre internacional de producto y ecosistema.",
  },
  {
    name: "Orvian",
    meaning: "Sugiere orden, movimiento y una ruta propia.",
    personality: "Confiable, estructurada y sofisticada.",
    fit: "Refuerza la idea de convertir proyectos complejos en dirección clara.",
  },
  {
    name: "Nuvora",
    meaning: "Une novedad con una atmósfera futurista.",
    personality: "Creativa, flexible y tecnológica.",
    fit: "Permite extender la marca a herramientas, estudios y experiencias.",
  },
  {
    name: "Aurevia",
    meaning: "Evoca una vía guiada por inteligencia y presencia.",
    personality: "Premium, cálida y visionaria.",
    fit: "Comunica acompañamiento continuo durante todo el proyecto.",
  },
  {
    name: "Veyra",
    meaning: "Nombre breve con sensación de velocidad y precisión.",
    personality: "Directa, moderna y memorable.",
    fit: "Es apropiada para una interfaz rápida con identidad propia.",
  },
  {
    name: "Eloria",
    meaning: "Sugiere elevación, claridad y desarrollo.",
    personality: "Serena, creativa y humana.",
    fit: "Funciona para una inteligencia que organiza sin sentirse mecánica.",
  },
  {
    name: "Soreva",
    meaning: "Combina solidez, renovación y avance.",
    personality: "Confiable, premium y estable.",
    fit: "Refuerza la continuidad y la memoria de los proyectos.",
  },
  {
    name: "Atria",
    meaning: "Evoca un centro que conecta diferentes espacios.",
    personality: "Minimalista, inteligente y arquitectónica.",
    fit: "Representa bien un sistema operativo creativo con varios estudios.",
  },
  {
    name: "Elyra",
    meaning: "Sugiere ligereza, dirección y una presencia cercana.",
    personality: "Humana, elegante y futurista.",
    fit: "Tiene una pronunciación sencilla y una identidad visual flexible.",
  },
  {
    name: "Oryvia",
    meaning: "Combina origen, ruta y visión.",
    personality: "Visionaria, sofisticada y creativa.",
    fit: "Conecta la primera idea con el camino completo hasta el lanzamiento.",
  },
  {
    name: "Calyra",
    meaning: "Evoca equilibrio, claridad y energía creativa.",
    personality: "Serena, premium y expresiva.",
    fit: "Funciona para una plataforma que mezcla estrategia y creación.",
  },
  {
    name: "Novyra",
    meaning: "Sugiere una nueva dirección con carácter propio.",
    personality: "Futurista, dinámica y memorable.",
    fit: "Conserva la energía de un proyecto provisional llamado Nova sin copiarlo.",
  },
];

export function sanitizeAuraResponse(
  value: string,
): string {
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
    .replace(
      /^\s*\|?[-:]+(?:\|[-:]+)+\|?\s*$/gm,
      "",
    )
    .replace(/\|/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractPromptField(
  prompt: string,
  labels: string[],
): string {
  for (const label of labels) {
    const expression = new RegExp(
      `${label}:\\s*([^\\n]+)`,
      "i",
    );
    const match = prompt.match(expression);

    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return "";
}

function getProjectSignal(prompt: string): ProjectSignal {
  const currentProject = projectEngine.getCurrentProject();

  const name =
    currentProject?.name ||
    extractPromptField(prompt, ["Proyecto", "Project"]) ||
    "el proyecto";

  const description =
    currentProject?.description ||
    extractPromptField(prompt, [
      "Descripción",
      "Descripcion",
      "Description",
    ]);

  const goal =
    currentProject?.goal ||
    extractPromptField(prompt, [
      "Objetivo",
      "Goal",
    ]) ||
    "convertir una idea en un proyecto claro y realizable";

  const approvedAssets =
    currentProject?.launchStudio?.assets.filter(
      (asset) => asset.status === "approved",
    ) ?? [];

  return {
    name,
    description,
    goal,
    approvedAssets,
    memoryContext: buildProjectMemoryContext(
      currentProject,
    ),
  };
}

function getApprovedMessage(
  signal: ProjectSignal,
): string {
  const firstApproved = signal.approvedAssets[0];

  if (!firstApproved) {
    return "";
  }

  const content = firstApproved.content
    .replace(/\s+/g, " ")
    .trim();

  if (!content) {
    return "";
  }

  return content.length > 220
    ? `${content.slice(0, 220).trim()}…`
    : content;
}

function getRequestedCount(prompt: string): number {
  const match = prompt.match(
    /\b(?:genera|generate|crea|create)\s+(\d{1,2})\b/i,
  );

  if (!match) {
    return 10;
  }

  const count = Number(match[1]);

  if (!Number.isFinite(count)) {
    return 10;
  }

  return Math.min(Math.max(count, 3), 12);
}

function hashText(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

function rotateCandidates(
  signal: ProjectSignal,
): NamingCandidate[] {
  const currentName = signal.name.toLowerCase();
  const available = NAMING_POOL.filter(
    (candidate) =>
      candidate.name.toLowerCase() !== currentName,
  );

  const offset =
    hashText(`${signal.name}-${signal.goal}`) %
    available.length;

  return [
    ...available.slice(offset),
    ...available.slice(0, offset),
  ];
}

function createNamingResponse(
  prompt: string,
  signal: ProjectSignal,
): string {
  const count = getRequestedCount(prompt);
  const candidates = rotateCandidates(signal).slice(
    0,
    count,
  );

  const proposals = candidates
    .map((candidate, index) => {
      return `${index + 1}. ${candidate.name}

Significado

${candidate.meaning}

Personalidad

${candidate.personality}

Por qué encaja con ${signal.name}

${candidate.fit} Su dirección debe apoyar este objetivo: ${signal.goal}.`;
    })
    .join("\n\n");

  const recommended = candidates[0];
  const approvedMessage = getApprovedMessage(signal);

  return `
Propuestas de nombre para ${signal.name}

Base estratégica

El nombre debe apoyar este objetivo: ${signal.goal}.

${proposals}

Recomendación principal

${recommended.name}

Es la opción más equilibrada porque combina memorabilidad, dirección y una identidad internacional. También puede convivir con Branding Studio, Launch Studio y futuros módulos sin limitar el crecimiento de la plataforma.

Coherencia con la memoria del proyecto

${
  approvedMessage
    ? `La pieza aprobada del lanzamiento comunica esta idea central: ${approvedMessage}`
    : "Todavía no hay piezas aprobadas suficientes para validar el nombre contra el lenguaje de lanzamiento."
}

Validación necesaria

Antes de tomar la decisión final, verifica disponibilidad de dominio, redes sociales y registro de marca.
  `.trim();
}

function createPersonalityResponse(
  signal: ProjectSignal,
): string {
  const approvedMessage = getApprovedMessage(signal);

  return `
Personalidad de marca para ${signal.name}

Visionaria

Ayuda a ver el proyecto completo y no solamente la tarea inmediata.

Precisa

Convierte ideas amplias en decisiones claras, ordenadas y aplicables.

Serena

Mantiene una presencia segura y evita saturar al usuario con ruido o explicaciones innecesarias.

Creativa

Propone rutas originales sin perder de vista el objetivo real del proyecto.

Confiable

Recuerda decisiones anteriores y mantiene continuidad entre sesiones, estudios y piezas.

Tono de voz

Claro, directo, inteligente y humano.

Reglas de expresión

Responder con contexto específico del proyecto.

Evitar frases genéricas y promesas exageradas.

Explicar el porqué de las decisiones importantes.

No utilizar símbolos de markdown al hablar o presentar resultados.

Objetivo que debe proteger

${signal.goal}

${
  approvedMessage
    ? `Lenguaje aprobado que debe conservar: ${approvedMessage}`
    : "No hay una pieza aprobada de lanzamiento para usar como referencia verbal."
}
  `.trim();
}

function createMissionResponse(
  signal: ProjectSignal,
): string {
  return `
Misión de ${signal.name}

Ayudar a las personas a convertir ideas en proyectos claros, coherentes y realizables mediante una inteligencia que comprende el contexto, recuerda decisiones y organiza el proceso creativo desde la primera idea hasta el lanzamiento.

Versión específica para el proyecto

${signal.name} existe para ${signal.goal.toLowerCase()}.

Versión breve

Dar memoria, dirección y continuidad a cada proyecto.

Criterio de calidad

La misión debe orientar decisiones de producto, branding y lanzamiento. Cualquier función que no mejore claridad, memoria o continuidad debe revisarse antes de entrar al producto.
  `.trim();
}

function createVisionResponse(
  signal: ProjectSignal,
): string {
  return `
Visión de ${signal.name}

Crear una nueva forma de trabajar con inteligencia artificial donde cada proyecto tenga memoria, dirección y una presencia capaz de acompañar su evolución sin obligar al usuario a empezar de cero.

Futuro deseado

Las ideas, decisiones, piezas de marca y avances viven dentro de una misma memoria de proyecto.

Cada estudio utiliza esa memoria para producir resultados más coherentes.

El usuario conserva control sobre lo que está en borrador y lo que ya fue aprobado.

Aspiración

Convertir ${signal.name} en el sistema creativo de referencia para personas y equipos que necesitan construir con mayor claridad, precisión y continuidad.
  `.trim();
}

function createLogoResponse(
  signal: ProjectSignal,
): string {
  return `
Dirección de logo para ${signal.name}

Concepto principal

Una órbita incompleta que rodea un núcleo de luz.

Significado

La órbita representa el proyecto en movimiento.

El núcleo representa la memoria y la inteligencia que mantienen dirección.

La abertura representa que el proyecto sigue evolucionando y no está cerrado.

Forma

Geométrica, limpia y reconocible en tamaños pequeños.

Sistema

Símbolo independiente para icono de aplicación.

Símbolo junto al nombre para la firma principal.

Versión monocromática para documentos.

Versión luminosa para escenas de lanzamiento.

Sensación

Futurista, premium, serena y viva.

Debe evitar

Robots, cerebros, circuitos obvios, estrellas genéricas y detalles que desaparezcan en tamaños pequeños.

Relación con el objetivo

El símbolo debe reforzar esta promesa: ${signal.goal}.
  `.trim();
}

function createColorsResponse(
  signal: ProjectSignal,
): string {
  return `
Paleta propuesta para ${signal.name}

Color principal

Violeta eléctrico profundo

Función

Acciones principales, estados activos y momentos de energía creativa.

Color secundario

Azul nocturno

Función

Profundidad, superficies y transiciones.

Acento

Lavanda luminosa

Función

Indicadores de memoria, conexión y presencia.

Fondo

Negro con matiz violeta

Función

Interfaz principal y escenas cinematográficas.

Texto principal

Blanco suave

Texto secundario

Gris frío

Regla de uso

El violeta debe señalar intención, no llenar toda la interfaz. Los efectos luminosos deben concentrarse en acciones, estados activos y momentos donde IAURA conecta información.

Criterio del proyecto

La paleta debe ayudar a comunicar ${signal.goal.toLowerCase()} sin sentirse agresiva ni genérica.
  `.trim();
}

function createTypographyResponse(
  signal: ProjectSignal,
): string {
  return `
Sistema tipográfico para ${signal.name}

Tipografía principal

Sans serif moderna y altamente legible para interfaz, navegación y contenido funcional.

Tipografía de expresión

Sans serif geométrica o editorial para titulares, campañas y momentos de marca.

Jerarquía

Titulares grandes con espaciado compacto.

Subtítulos claros con peso medio.

Texto de interfaz breve y legible.

Etiquetas en mayúsculas con espaciado amplio, utilizadas solo para organización.

Principio

La tipografía debe comunicar precisión y calma.

Aplicación al proyecto

Como ${signal.name} busca ${signal.goal.toLowerCase()}, la lectura debe sentirse rápida, estable y confiable incluso cuando el contenido sea complejo.

Debe evitar

Fuentes excesivamente decorativas, estilos de ciencia ficción difíciles de leer y combinaciones con poco contraste.
  `.trim();
}

function createStyleResponse(
  signal: ProjectSignal,
): string {
  const approvedMessage = getApprovedMessage(signal);

  return `
Dirección visual para ${signal.name}

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

Suave, continuo y preciso.

Las animaciones deben transmitir que IAURA está conectando memoria, contexto y decisiones, no simplemente decorando la pantalla.

Principio central

IAURA debe sentirse antes de entenderse.

Objetivo protegido

${signal.goal}

${
  approvedMessage
    ? `La dirección visual debe ser coherente con este lenguaje aprobado: ${approvedMessage}`
    : "Todavía no hay una pieza aprobada de lanzamiento para validar la dirección visual."
}
  `.trim();
}

function createFallbackResponse(
  prompt: string,
  signal: ProjectSignal,
): string {
  const requestedTask =
    extractPromptField(prompt, [
      "Solicitud",
      "Instrucción",
      "Request",
    ]) || prompt.trim();

  return `
Solicitud entendida

${requestedTask}

Contexto del proyecto

Nombre: ${signal.name}

Descripción: ${signal.description || "No definida"}

Objetivo: ${signal.goal}

Dirección recomendada

Definir el resultado exacto que debe quedar listo.

Utilizar la memoria existente antes de crear una propuesta nueva.

Mantener coherencia con las decisiones de branding ya guardadas.

Priorizar piezas aprobadas sobre borradores cuando exista un conflicto.

Entregar una propuesta concreta y editable.

Criterio de precisión

La respuesta debe ser específica para ${signal.name}, explicar las decisiones importantes y evitar información que no esté respaldada por el contexto disponible.

Memoria disponible

${
  signal.memoryContext
    ? signal.memoryContext
    : "No hay memoria adicional disponible para este proyecto."
}
  `.trim();
}

export function generateAIResponse(
  prompt: string,
): string {
  const normalizedPrompt = prompt.toLowerCase();
  const signal = getProjectSignal(prompt);

  let response: string;

  if (normalizedPrompt.includes("naming")) {
    response = createNamingResponse(prompt, signal);
  } else if (
    normalizedPrompt.includes("personalidad") ||
    normalizedPrompt.includes("personality")
  ) {
    response = createPersonalityResponse(signal);
  } else if (
    normalizedPrompt.includes("misión") ||
    normalizedPrompt.includes("mision") ||
    normalizedPrompt.includes("mission")
  ) {
    response = createMissionResponse(signal);
  } else if (
    normalizedPrompt.includes("visión") ||
    normalizedPrompt.includes("vision")
  ) {
    response = createVisionResponse(signal);
  } else if (normalizedPrompt.includes("logo")) {
    response = createLogoResponse(signal);
  } else if (
    normalizedPrompt.includes("colores") ||
    normalizedPrompt.includes("colors") ||
    normalizedPrompt.includes("paleta")
  ) {
    response = createColorsResponse(signal);
  } else if (
    normalizedPrompt.includes("tipografía") ||
    normalizedPrompt.includes("tipografia") ||
    normalizedPrompt.includes("typography")
  ) {
    response = createTypographyResponse(signal);
  } else if (
    normalizedPrompt.includes("estilo visual") ||
    normalizedPrompt.includes("style")
  ) {
    response = createStyleResponse(signal);
  } else {
    response = createFallbackResponse(prompt, signal);
  }

  return sanitizeAuraResponse(response);
}
