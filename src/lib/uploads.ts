import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "@/lib/api";
import { dataDirectory } from "@/lib/db";

export const MAX_IMAGE_BYTES = 512 * 1024;
export const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;

const uploadRoot = path.join(dataDirectory, "uploads");

export type ImageType = { extension: "png" | "jpg" | "webp"; mime: string };

const mimeByExtension: Record<ImageType["extension"], string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

function detectImageType(buffer: Buffer): ImageType | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { extension: "png", mime: mimeByExtension.png };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpg", mime: mimeByExtension.jpg };
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", mime: mimeByExtension.webp };
  }
  return null;
}

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024 ? `${bytes / (1024 * 1024)} MB` : `${bytes / 1024} KB`;
}

export async function readImageFile(file: FormDataEntryValue | null | undefined, maxBytes = MAX_IMAGE_BYTES) {
  if (!(file instanceof File)) {
    throw new ApiError(400, "File gambar wajib dipilih.", "FILE_REQUIRED");
  }
  if (file.size > maxBytes) {
    throw new ApiError(413, `Ukuran file melebihi ${sizeLabel(maxBytes)}.`, "FILE_TOO_LARGE");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const type = detectImageType(buffer);
  if (!type) {
    throw new ApiError(415, "Format gambar harus PNG, JPG, atau WebP.", "UNSUPPORTED_IMAGE");
  }
  return { buffer, type };
}

export async function readImageUpload(request: Request, fieldName: string, maxBytes = MAX_IMAGE_BYTES) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes + 16 * 1024) {
    throw new ApiError(413, `Ukuran file melebihi ${sizeLabel(maxBytes)}.`, "FILE_TOO_LARGE");
  }

  const formData = await request.formData().catch(() => null);
  return readImageFile(formData?.get(fieldName), maxBytes);
}

export async function saveUpload(folder: string, prefix: string, buffer: Buffer, type: ImageType) {
  const directory = path.join(uploadRoot, folder);
  await mkdir(directory, { recursive: true });
  const filename = `${prefix}-${randomUUID()}.${type.extension}`;
  await writeFile(path.join(directory, filename), buffer);
  return filename;
}

export async function removeUpload(folder: string, filename: string | null | undefined) {
  if (!filename) return;
  await rm(path.join(uploadRoot, folder, path.basename(filename)), { force: true });
}

export async function readUpload(folder: string, filename: string) {
  const buffer = await readFile(path.join(uploadRoot, folder, path.basename(filename)));
  const extension = path.extname(filename).slice(1) as ImageType["extension"];
  return { buffer, mime: mimeByExtension[extension] ?? "application/octet-stream" };
}
