import type { PassageLanguage } from "@/lib/app-storage";

export async function decodeUploadedTextFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    try { return new TextDecoder("big5", { fatal: true }).decode(bytes); }
    catch { throw new Error(`${file.name} is not valid UTF-8 or Big5 text.`); }
  }
}

export function detectTextLanguage(text: string): PassageLanguage {
  const letters = Array.from(text).filter((character) => /[A-Za-z\u3400-\u9fff\uf900-\ufaff]/.test(character));
  if (letters.length === 0) return "english";
  const hanCount = letters.filter((character) => /[\u3400-\u9fff\uf900-\ufaff]/.test(character)).length;
  return hanCount / letters.length >= 0.3 ? "chinese" : "english";
}
