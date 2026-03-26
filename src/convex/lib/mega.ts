"use node";
import { Storage } from "megajs";

/**
 * Upload a file buffer to MEGA and return a permanent public link.
 * Credentials are read from MEGA_EMAIL and MEGA_PASSWORD env vars.
 */
export async function uploadToMega(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;

  if (!email || !password) {
    throw new Error("MEGA_EMAIL and MEGA_PASSWORD environment variables are not set.");
  }

  const storage = new Storage({ email, password });
  await storage.ready;

  const uploadedFile = await storage.upload({ name: fileName }, buffer).complete;
  const link: string = await (uploadedFile as any).link(true);
  return link;
}

/**
 * Upload a Blob to MEGA and return a permanent public link.
 */
export async function uploadBlobToMega(
  blob: Blob,
  fileName: string
): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return uploadToMega(buffer, fileName);
}
