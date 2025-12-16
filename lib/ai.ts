const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
  process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY;

const imageModelId =
  process.env.GEMINI_FLASH_IMAGE_MODEL ??
  process.env.NEXT_PUBLIC_GEMINI_FLASH_IMAGE_MODEL ??
  "gemini-2.5-flash-image";

const evalModelId =
  process.env.GEMINI_FLASH_TEXT_MODEL ??
  process.env.NEXT_PUBLIC_GEMINI_FLASH_TEXT_MODEL ??
  "gemini-2.5-flash";

function base64ToUint8Array(base64: string) {
  const binary = Buffer.from(base64, "base64");
  return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength);
}

export type GeneratedImage = {
  base64: string;
  mediaType: string;
  uint8Array: Uint8Array;
};

export async function generateGameImage(prompt: string) {
  if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${imageModelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `Create an image of: ${prompt}` }],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Image generation failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inline_data?: { data?: string; mime_type?: string } }> };
    }>;
  };
  const parts = json?.candidates?.[0]?.content?.parts;
  const inline = parts?.find((p) => p.inline_data);
  if (!inline?.inline_data?.data || !inline.inline_data.mime_type) {
    throw new Error("No inline image returned from Gemini");
  }

  const base64 = inline.inline_data.data as string;
  const mediaType = inline.inline_data.mime_type as string;
  const uint8Array = base64ToUint8Array(base64);
  const dataUrl = `data:${mediaType};base64,${base64}`;

  const image: GeneratedImage = { base64, mediaType, uint8Array };
  return { image, dataUrl };
}

export async function evaluateImageMatch(
  image: GeneratedImage,
  target: string,
): Promise<{ match: boolean; feedback: string }> {
  if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${evalModelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are grading an image generation task for a child.\nThe target description is: "${target}".\nReply with a concise verdict "yes" if the image clearly matches, otherwise "no", followed by a short reason.`,
              },
              {
                inline_data: {
                  mime_type: image.mediaType,
                  data: image.base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 80,
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Evaluation failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  const verdict = text?.trim().toLowerCase() ?? "";
  const match = verdict.startsWith("yes");

  return {
    match,
    feedback: text?.trim() ?? "No feedback",
  };
}
