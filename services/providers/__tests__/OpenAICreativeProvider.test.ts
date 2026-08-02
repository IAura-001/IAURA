import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { CreativeProviderError } from "@/core/creative/errors";
import type {
  CreativeCopyRequest,
  CreativeImageRequest,
} from "@/core/creative/types";
import {
  CREATIVE_IMAGE_TIMEOUT_MS,
  OpenAICreativeProvider,
  type OpenAICreativeTransport,
} from "../OpenAICreativeProvider";

const brand = {
  name: "VAEORA",
  mission: "Give intelligent ideas a coherent form.",
  personality: ["premium", "organic", "intelligent"],
};

const copyRequest: CreativeCopyRequest & {
  deliverable: "website-copy";
} = {
  projectId: "project-1",
  deliverable: "website-copy",
  locale: "en",
  brief: "Create a restrained product landing narrative.",
  brand,
};

const imageRequest: CreativeImageRequest = {
  projectId: "project-1",
  intent: "website-hero",
  aspect: "hero",
  tier: "premium",
  brief: "An abstract intelligent field taking shape.",
  brand,
};

const validWebsiteCopy = {
  seo: {
    title: "VAEORA — Intelligence taking shape",
    description: "A coherent creative intelligence for ambitious brands.",
    keywords: ["creative intelligence", "branding", "web design"],
  },
  hero: {
    eyebrow: "Coming into focus",
    title: "Where intelligence takes shape.",
    subtitle: "Create one coherent brand system.",
    primaryCta: "Begin",
    secondaryCta: "Explore",
  },
  sections: [
    {
      id: "strategy",
      title: "Direction",
      body: "Find the precise idea at the center of the brand.",
      cta: "Define",
    },
    {
      id: "identity",
      title: "Identity",
      body: "Shape language and visuals as a single system.",
      cta: "Create",
    },
    {
      id: "launch",
      title: "Launch",
      body: "Turn the system into finished public work.",
      cta: "Launch",
    },
  ],
};

function writeUint32BigEndian(
  bytes: Uint8Array,
  offset: number,
  value: number,
): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeUint32LittleEndian(
  bytes: Uint8Array,
  offset: number,
  value: number,
): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function webpBase64(width: number, height: number): string {
  const bytes = new Uint8Array(50);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  writeUint32LittleEndian(bytes, 4, bytes.length - 8);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  writeUint32LittleEndian(bytes, 16, 10);
  const storedWidth = width - 1;
  const storedHeight = height - 1;
  bytes[24] = storedWidth & 0xff;
  bytes[25] = (storedWidth >>> 8) & 0xff;
  bytes[26] = (storedWidth >>> 16) & 0xff;
  bytes[27] = storedHeight & 0xff;
  bytes[28] = (storedHeight >>> 8) & 0xff;
  bytes[29] = (storedHeight >>> 16) & 0xff;
  bytes.set([0x56, 0x50, 0x38, 0x20], 30);
  writeUint32LittleEndian(bytes, 34, 11);
  bytes.set([0x9d, 0x01, 0x2a], 41);
  bytes[44] = width & 0xff;
  bytes[45] = (width >>> 8) & 0x3f;
  bytes[46] = height & 0xff;
  bytes[47] = (height >>> 8) & 0x3f;
  return Buffer.from(bytes).toString("base64");
}

function pngBase64(width: number, height: number): string {
  const bytes = new Uint8Array(58);
  bytes.set([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
  ]);
  writeUint32BigEndian(bytes, 8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  writeUint32BigEndian(bytes, 16, width);
  writeUint32BigEndian(bytes, 20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  writeUint32BigEndian(bytes, 33, 1);
  bytes.set([0x49, 0x44, 0x41, 0x54], 37);
  bytes[41] = 0x00;
  bytes.set([0x49, 0x45, 0x4e, 0x44], 50);
  return Buffer.from(bytes).toString("base64");
}

function createTransport(): {
  transport: OpenAICreativeTransport;
  createResponse: ReturnType<typeof vi.fn>;
  generateImage: ReturnType<typeof vi.fn>;
} {
  const createResponse = vi.fn();
  const generateImage = vi.fn();

  return {
    transport: {
      createResponse,
      generateImage,
    },
    createResponse,
    generateImage,
  };
}

describe("OpenAICreativeProvider", () => {
  it("uses strict structured output for copy", async () => {
    const { transport, createResponse } = createTransport();
    createResponse.mockResolvedValue({
      output_text: JSON.stringify(validWebsiteCopy),
    });
    const provider = new OpenAICreativeProvider({
      transport,
      creativeModel: "gpt-5.6-terra",
      imageModel: "gpt-image-2",
    });

    const result = await provider.generateCopy(copyRequest);
    const [body, options] = createResponse.mock.calls[0];

    expect(body).toMatchObject({
      model: "gpt-5.6-terra",
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "vaeora_website_copy",
          strict: true,
        },
      },
    });
    expect(options).toMatchObject({
      timeout: 90_000,
      maxRetries: 0,
    });
    expect(result.content.hero.title).toBe(
      "Where intelligence takes shape.",
    );
  });

  it("generates exactly one opaque server-configured image", async () => {
    const { transport, generateImage } = createTransport();
    generateImage.mockResolvedValue({
      created: 1,
      data: [{ b64_json: webpBase64(1536, 864) }],
    });
    const provider = new OpenAICreativeProvider({
      transport,
      creativeModel: "gpt-5.6-terra",
      imageModel: "gpt-image-2",
    });

    const result = await provider.generateImage(imageRequest);
    const [body, options] = generateImage.mock.calls[0];

    expect(body).toMatchObject({
      model: "gpt-image-2",
      n: 1,
      size: "1536x864",
      quality: "high",
      output_format: "webp",
      background: "opaque",
      moderation: "auto",
      stream: false,
    });
    expect(body.prompt).toContain(
      "polished editorial standard suitable for a final brand presentation",
    );
    expect(body.prompt).toContain("one strong focal idea");
    expect(options).toMatchObject({
      timeout: CREATIVE_IMAGE_TIMEOUT_MS,
      maxRetries: 0,
    });
    expect(result).toMatchObject({
      mimeType: "image/webp",
      width: 1536,
      height: 864,
      experimental: false,
      model: "gpt-image-2",
    });
  });

  it("keeps logo marks opaque on a neutral background", async () => {
    const { transport, generateImage } = createTransport();
    generateImage.mockResolvedValue({
      created: 1,
      data: [{ b64_json: pngBase64(1024, 1024) }],
    });
    const provider = new OpenAICreativeProvider({
      transport,
      creativeModel: "gpt-5.6-terra",
      imageModel: "gpt-image-2",
    });

    await provider.generateImage({
      ...imageRequest,
      intent: "logo-mark",
      aspect: "square",
    });
    const [body] = generateImage.mock.calls[0];

    expect(body).toMatchObject({
      background: "opaque",
      output_format: "png",
      size: "1024x1024",
    });
    expect(body.prompt).toContain("#F2F0EA");
    expect(body.prompt).toContain("No letters, words, typography");
  });

  it("rejects an image whose actual dimensions miss the preset", async () => {
    const { transport, generateImage } = createTransport();
    generateImage.mockResolvedValue({
      created: 1,
      data: [{ b64_json: webpBase64(1024, 1024) }],
    });
    const provider = new OpenAICreativeProvider({
      transport,
      creativeModel: "gpt-5.6-terra",
      imageModel: "gpt-image-2",
    });

    await expect(
      provider.generateImage(imageRequest),
    ).rejects.toMatchObject({
      kind: "invalid_result",
    } satisfies Partial<CreativeProviderError>);
  });

  it("requests and verifies a true 4K ultra result", async () => {
    const { transport, generateImage } = createTransport();
    generateImage.mockResolvedValue({
      created: 1,
      data: [{ b64_json: webpBase64(3840, 2160) }],
    });
    const provider = new OpenAICreativeProvider({
      transport,
      creativeModel: "gpt-5.6-terra",
      imageModel: "gpt-image-2",
    });

    const result = await provider.generateImage({
      ...imageRequest,
      tier: "ultra",
    });
    const [body] = generateImage.mock.calls[0];

    expect(body).toMatchObject({
      size: "3840x2160",
      quality: "high",
    });
    expect(result).toMatchObject({
      width: 3840,
      height: 2160,
      experimental: true,
    });
  });

  it("uses low quality for fast draft generation", async () => {
    const { transport, generateImage } = createTransport();
    generateImage.mockResolvedValue({
      created: 1,
      data: [{ b64_json: webpBase64(1536, 864) }],
    });
    const provider = new OpenAICreativeProvider({
      transport,
      creativeModel: "gpt-5.6-terra",
      imageModel: "gpt-image-2",
    });

    await provider.generateImage({
      ...imageRequest,
      tier: "draft",
    });
    const [body] = generateImage.mock.calls[0];

    expect(body.quality).toBe("low");
    expect(body.prompt).toContain("fast art-direction review");
  });

  it("rejects ultra when the configured model lacks 4K support", async () => {
    const { transport, generateImage } = createTransport();
    const provider = new OpenAICreativeProvider({
      transport,
      creativeModel: "gpt-5.6-terra",
      imageModel: "gpt-image-1.5",
    });

    await expect(
      provider.generateImage({
        ...imageRequest,
        tier: "ultra",
      }),
    ).rejects.toMatchObject({
      kind: "unsupported_preset",
    } satisfies Partial<CreativeProviderError>);
    expect(generateImage).not.toHaveBeenCalled();
  });
});
