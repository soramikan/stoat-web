import type { Client } from "stoat.js";

import CONFIGURATION from "./env";

export type AutumnUploadTag =
  | "attachments"
  | "avatars"
  | "backgrounds"
  | "icons"
  | "banners"
  | "emojis";

export type UploadProgressHandler = (loaded: number, total: number) => void;

type ChunkResponse = {
  upload_id: string;
  chunk_index: number;
  received_chunks: number;
  total_chunks: number;
};

type UploadResponse = {
  id: string;
};

type ConfigurationWithChunkLimit = {
  features?: {
    limits?: {
      global?: {
        chunk_upload_size?: number;
      };
    };
    autumn?: {
      url?: string;
    };
  };
};

function randomUuid() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}

function chunkUploadSize(client: Client) {
  const advertised = (client.configuration as ConfigurationWithChunkLimit)
    ?.features?.limits?.global?.chunk_upload_size;

  return advertised && advertised > 0
    ? advertised
    : CONFIGURATION.UPLOAD_CHUNK_SIZE;
}

async function sha256Hex(file: File) {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function requestJson<T>(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: XMLHttpRequestBodyInit,
  onUpload?: (loaded: number, total: number) => void,
) {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (onUpload) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          onUpload(event.loaded, event.total);
        }
      });
    }

    xhr.addEventListener("loadend", () => {
      if (xhr.readyState !== 4 || xhr.status < 200 || xhr.status >= 300) {
        reject(xhr.response || xhr.responseText || "Upload Error");
      } else {
        resolve(xhr.response as T);
      }
    });

    xhr.addEventListener("error", () => reject("Upload Error"));
    xhr.open(method, url, true);

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.responseType = "json";
    xhr.send(body);
  });
}

export async function uploadFileToAutumn(
  client: Client,
  tag: AutumnUploadTag,
  file: File,
  mediaBaseUrl?: string,
  onProgress?: UploadProgressHandler,
) {
  const autumnUrl =
    mediaBaseUrl ||
    (client.configuration as ConfigurationWithChunkLimit)?.features?.autumn
      ?.url ||
    CONFIGURATION.DEFAULT_MEDIA_URL;
  const [authHeader, authHeaderValue] = client.authenticationHeader;
  const uploadId = randomUuid();
  const chunkSize = chunkUploadSize(client);
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
  const checksum = await sha256Hex(file);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const offset = chunkIndex * chunkSize;
    const chunk = file.slice(offset, Math.min(file.size, offset + chunkSize));
    const body = new FormData();

    body.set("upload_id", uploadId);
    body.set("chunk_index", String(chunkIndex));
    body.set("total_chunks", String(totalChunks));
    body.set("total_size", String(file.size));
    body.set("chunk", chunk, file.name);

    await requestJson<ChunkResponse>(
      "POST",
      `${autumnUrl}/${tag}/chunks`,
      { [authHeader]: authHeaderValue },
      body,
      (loaded) => {
        onProgress?.(
          Math.min(file.size, offset + Math.min(chunk.size, loaded)),
          file.size,
        );
      },
    );
  }

  const response = await requestJson<UploadResponse>(
    "POST",
    `${autumnUrl}/${tag}/chunks/${uploadId}/complete`,
    {
      [authHeader]: authHeaderValue,
      "Content-Type": "application/json",
    },
    JSON.stringify({
      filename: file.name,
      total_chunks: totalChunks,
      total_size: file.size,
      sha256: checksum,
    }),
  );

  onProgress?.(file.size, file.size);
  return response.id;
}
