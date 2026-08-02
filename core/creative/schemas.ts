import type {
  CreativeCopyDeliverable,
} from "./types";

const stringArray = (
  minimumItems: number,
  maximumItems: number,
  maximumLength: number,
) => ({
  type: "array",
  minItems: minimumItems,
  maxItems: maximumItems,
  items: {
    type: "string",
    minLength: 1,
    maxLength: maximumLength,
  },
});

export const BRAND_FOUNDATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "positioning",
    "brandPromise",
    "audience",
    "mission",
    "values",
    "voice",
    "taglineOptions",
  ],
  properties: {
    positioning: {
      type: "string",
      minLength: 1,
      maxLength: 900,
    },
    brandPromise: {
      type: "string",
      minLength: 1,
      maxLength: 500,
    },
    audience: {
      type: "string",
      minLength: 1,
      maxLength: 700,
    },
    mission: {
      type: "string",
      minLength: 1,
      maxLength: 700,
    },
    values: stringArray(3, 6, 100),
    voice: {
      type: "object",
      additionalProperties: false,
      required: ["traits", "principles", "avoid"],
      properties: {
        traits: stringArray(3, 6, 80),
        principles: stringArray(3, 6, 180),
        avoid: stringArray(2, 6, 140),
      },
    },
    taglineOptions: stringArray(3, 6, 120),
  },
} as const;

export const WEBSITE_COPY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["seo", "hero", "sections"],
  properties: {
    seo: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description", "keywords"],
      properties: {
        title: {
          type: "string",
          minLength: 1,
          maxLength: 70,
        },
        description: {
          type: "string",
          minLength: 1,
          maxLength: 180,
        },
        keywords: stringArray(3, 10, 60),
      },
    },
    hero: {
      type: "object",
      additionalProperties: false,
      required: [
        "eyebrow",
        "title",
        "subtitle",
        "primaryCta",
        "secondaryCta",
      ],
      properties: {
        eyebrow: {
          type: "string",
          minLength: 1,
          maxLength: 80,
        },
        title: {
          type: "string",
          minLength: 1,
          maxLength: 140,
        },
        subtitle: {
          type: "string",
          minLength: 1,
          maxLength: 320,
        },
        primaryCta: {
          type: "string",
          minLength: 1,
          maxLength: 60,
        },
        secondaryCta: {
          type: "string",
          minLength: 1,
          maxLength: 60,
        },
      },
    },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title", "body", "cta"],
        properties: {
          id: {
            type: "string",
            pattern: "^[a-z0-9-]{1,40}$",
          },
          title: {
            type: "string",
            minLength: 1,
            maxLength: 120,
          },
          body: {
            type: "string",
            minLength: 1,
            maxLength: 700,
          },
          cta: {
            type: "string",
            minLength: 1,
            maxLength: 60,
          },
        },
      },
    },
  },
} as const;

export const SOCIAL_KIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "bio",
    "launchCaption",
    "contentPillars",
    "postIdeas",
  ],
  properties: {
    bio: {
      type: "string",
      minLength: 1,
      maxLength: 300,
    },
    launchCaption: {
      type: "string",
      minLength: 1,
      maxLength: 1800,
    },
    contentPillars: stringArray(3, 6, 160),
    postIdeas: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "hook", "caption"],
        properties: {
          title: {
            type: "string",
            minLength: 1,
            maxLength: 120,
          },
          hook: {
            type: "string",
            minLength: 1,
            maxLength: 180,
          },
          caption: {
            type: "string",
            minLength: 1,
            maxLength: 1200,
          },
        },
      },
    },
  },
} as const;

export const CREATIVE_COPY_SCHEMAS: Record<
  CreativeCopyDeliverable,
  Record<string, unknown>
> = {
  "brand-foundation": BRAND_FOUNDATION_SCHEMA,
  "website-copy": WEBSITE_COPY_SCHEMA,
  "social-kit": SOCIAL_KIT_SCHEMA,
};

export const CREATIVE_COPY_SCHEMA_NAMES: Record<
  CreativeCopyDeliverable,
  string
> = {
  "brand-foundation": "vaeora_brand_foundation",
  "website-copy": "vaeora_website_copy",
  "social-kit": "vaeora_social_kit",
};
