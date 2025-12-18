import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { GeneratedImage } from "../ai";

const r2Env = {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    endpoint: process.env.R2_ENDPOINT, // required; custom or R2 provided endpoint
};

function assertR2Env() {
    const requiredKeys: (keyof typeof r2Env)[] = ["accessKeyId", "secretAccessKey", "bucket", "endpoint"];
    const missingRequired = requiredKeys.filter((key) => !r2Env[key]);

    if (missingRequired.length) {
        throw new Error(`Missing R2 env vars: ${missingRequired.join(", ")}`);
    }
}

let cachedClient: S3Client | null = null;

function getR2Client(): S3Client {
    if (cachedClient) return cachedClient;
    assertR2Env();
    cachedClient = new S3Client({
        region: "auto",
        endpoint: r2Env.endpoint,
        credentials: {
            accessKeyId: r2Env.accessKeyId!,
            secretAccessKey: r2Env.secretAccessKey!,
        },
        forcePathStyle: true,
    });
    return cachedClient;
}

function extensionForMime(mime: string) {
    const map: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/webp": "webp",
    };
    return map[mime] || "png";
}

export async function uploadGameImageToStorage(
    image: GeneratedImage,
    childId: string,
    sectionId: string
): Promise<string> {
    const ext = extensionForMime(image.mediaType);
    const filename = `game-images/${sectionId}/${childId}/${Date.now()}.${ext}`;

    const client = getR2Client();

    await client.send(
        new PutObjectCommand({
            Bucket: r2Env.bucket!,
            Key: filename,
            Body: Buffer.from(image.base64, "base64"),
            ContentType: image.mediaType,
        })
    );

    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: r2Env.bucket!, Key: filename }), {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
    });

    return url;
}
