import type { SupportedLocale } from "@/core/i18n/languages";

export interface AuraStarterPath {
  id: string;
  icon: string;
  label: string;
  description: string;
  prompt: string;
}

const paths: Record<SupportedLocale, AuraStarterPath[]> = {
  "es-419": [
    {
      id: "goal",
      icon: "01",
      label: "Meta personal",
      description: "Aclara lo que quieres cambiar y crea una ruta realista.",
      prompt:
        "Quiero trabajar en una meta personal. Ayúdame a definirla y convertirla en fases simples.",
    },
    {
      id: "project",
      icon: "02",
      label: "Proyecto",
      description: "Organiza una idea, sus decisiones y próximos pasos.",
      prompt:
        "Quiero comenzar un proyecto. Ayúdame a darle estructura, fases y próximos pasos.",
    },
    {
      id: "brand",
      icon: "03",
      label: "Marca o negocio",
      description: "Estrategia, identidad, contenido y lanzamiento.",
      prompt:
        "Quiero desarrollar una marca o negocio. Organiza conmigo la estrategia y el sistema creativo.",
    },
    {
      id: "creative",
      icon: "04",
      label: "Crear algo",
      description: "Fotos, logos, contenido, conceptos o una web.",
      prompt:
        "Quiero crear algo visual o de contenido. Ayúdame a definirlo y elegir qué generar primero.",
    },
    {
      id: "learning",
      icon: "05",
      label: "Aprender",
      description: "Convierte una habilidad en práctica y progreso.",
      prompt:
        "Quiero aprender una habilidad. Diseña una ruta práctica adaptada a mí.",
    },
    {
      id: "wellbeing",
      icon: "06",
      label: "Bienestar",
      description: "Hábitos, energía, enfoque y organización personal.",
      prompt:
        "Quiero mejorar un aspecto de mi bienestar o mis hábitos. Ayúdame a empezar de forma sostenible.",
    },
    {
      id: "decision",
      icon: "07",
      label: "Tomar una decisión",
      description: "Ordena opciones, criterios y riesgos sin ruido.",
      prompt:
        "Necesito tomar una decisión. Ayúdame a ordenar las opciones y elegir con claridad.",
    },
  ],
  "en-US": [
    { id: "goal", icon: "01", label: "Personal goal", description: "Clarify what you want to change and build a realistic route.", prompt: "I want to work on a personal goal. Help me define it and turn it into simple phases." },
    { id: "project", icon: "02", label: "Project", description: "Organize an idea, its decisions and next steps.", prompt: "I want to start a project. Help me structure its phases and next steps." },
    { id: "brand", icon: "03", label: "Brand or business", description: "Strategy, identity, content and launch.", prompt: "I want to develop a brand or business. Organize the strategy and creative system with me." },
    { id: "creative", icon: "04", label: "Create something", description: "Photos, logos, content, concepts or a website.", prompt: "I want to create something visual or editorial. Help me define it and choose what to generate first." },
    { id: "learning", icon: "05", label: "Learn", description: "Turn a skill into practice and visible progress.", prompt: "I want to learn a skill. Design a practical route adapted to me." },
    { id: "wellbeing", icon: "06", label: "Wellbeing", description: "Habits, energy, focus and personal organization.", prompt: "I want to improve my wellbeing or habits. Help me begin sustainably." },
    { id: "decision", icon: "07", label: "Make a decision", description: "Organize options, criteria and risks without noise.", prompt: "I need to make a decision. Help me organize the options and choose clearly." },
  ],
  "pt-BR": [
    { id: "goal", icon: "01", label: "Meta pessoal", description: "Esclareça o que deseja mudar e crie uma rota realista.", prompt: "Quero trabalhar em uma meta pessoal. Ajude-me a defini-la e transformá-la em fases simples." },
    { id: "project", icon: "02", label: "Projeto", description: "Organize uma ideia, decisões e próximos passos.", prompt: "Quero começar um projeto. Ajude-me a estruturar suas fases e próximos passos." },
    { id: "brand", icon: "03", label: "Marca ou negócio", description: "Estratégia, identidade, conteúdo e lançamento.", prompt: "Quero desenvolver uma marca ou negócio. Organize comigo a estratégia e o sistema criativo." },
    { id: "creative", icon: "04", label: "Criar algo", description: "Fotos, logos, conteúdo, conceitos ou um site.", prompt: "Quero criar algo visual ou editorial. Ajude-me a definir e escolher o que gerar primeiro." },
    { id: "learning", icon: "05", label: "Aprender", description: "Transforme uma habilidade em prática e progresso.", prompt: "Quero aprender uma habilidade. Crie uma rota prática adaptada a mim." },
    { id: "wellbeing", icon: "06", label: "Bem-estar", description: "Hábitos, energia, foco e organização pessoal.", prompt: "Quero melhorar meu bem-estar ou meus hábitos. Ajude-me a começar de forma sustentável." },
    { id: "decision", icon: "07", label: "Tomar uma decisão", description: "Organize opções, critérios e riscos sem ruído.", prompt: "Preciso tomar uma decisão. Ajude-me a organizar as opções e escolher com clareza." },
  ],
  "fr-FR": [
    { id: "goal", icon: "01", label: "Objectif personnel", description: "Clarifiez ce que vous voulez changer et créez une voie réaliste.", prompt: "Je veux travailler sur un objectif personnel. Aidez-moi à le définir et à le transformer en étapes simples." },
    { id: "project", icon: "02", label: "Projet", description: "Organisez une idée, ses décisions et les prochaines étapes.", prompt: "Je veux commencer un projet. Aidez-moi à structurer ses phases et ses prochaines étapes." },
    { id: "brand", icon: "03", label: "Marque ou entreprise", description: "Stratégie, identité, contenu et lancement.", prompt: "Je veux développer une marque ou une entreprise. Organisez avec moi la stratégie et le système créatif." },
    { id: "creative", icon: "04", label: "Créer quelque chose", description: "Photos, logos, contenu, concepts ou site web.", prompt: "Je veux créer quelque chose de visuel ou éditorial. Aidez-moi à définir quoi générer en premier." },
    { id: "learning", icon: "05", label: "Apprendre", description: "Transformez une compétence en pratique et en progrès.", prompt: "Je veux apprendre une compétence. Concevez un parcours pratique adapté à moi." },
    { id: "wellbeing", icon: "06", label: "Bien-être", description: "Habitudes, énergie, concentration et organisation personnelle.", prompt: "Je veux améliorer mon bien-être ou mes habitudes. Aidez-moi à commencer durablement." },
    { id: "decision", icon: "07", label: "Prendre une décision", description: "Organisez les options, critères et risques sans bruit.", prompt: "Je dois prendre une décision. Aidez-moi à organiser les options et à choisir clairement." },
  ],
};

export function getAuraStarterPaths(
  locale: SupportedLocale,
): AuraStarterPath[] {
  return paths[locale];
}
