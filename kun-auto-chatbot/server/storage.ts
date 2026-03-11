// Storage helpers - placeholder (Manus storage proxy removed)
// These functions are not currently used by the chatbot.
// If file storage is needed in the future, integrate with a cloud provider (e.g., S3).

export async function storagePut(
  _relKey: string,
  _data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  throw new Error("Storage not configured. Set up a storage provider if needed.");
}

export async function storageGet(_relKey: string): Promise<{ key: string; url: string }> {
  throw new Error("Storage not configured. Set up a storage provider if needed.");
}
