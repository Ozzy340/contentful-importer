import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureDir(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
}

export async function writeJsonArtifact(
  directoryPath: string,
  fileName: string,
  payload: unknown
): Promise<string> {
  await ensureDir(directoryPath);
  const filePath = path.join(directoryPath, fileName);
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

export async function writeTextArtifact(
  directoryPath: string,
  fileName: string,
  content: string
): Promise<string> {
  await ensureDir(directoryPath);
  const filePath = path.join(directoryPath, fileName);
  await writeFile(filePath, content, 'utf8');
  return filePath;
}
