import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const DOCX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

export class CvExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CvExtractionError";
  }
}

export async function extractCvText(
  buffer: Buffer,
  fileName: string,
  contentType: string | null,
): Promise<string> {
  const lowerName = fileName.toLowerCase();
  const isPdf =
    contentType === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx =
    (contentType !== null && DOCX_TYPES.has(contentType)) ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc");

  let text: string;
  try {
    if (isPdf) {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      text = result.text;
    } else if (isDocx) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      text = buffer.toString("utf8");
    }
  } catch (err) {
    throw new CvExtractionError(
      `Could not read the file "${fileName}". ${err instanceof Error ? err.message : ""}`.trim(),
    );
  }

  const trimmed = text.replace(/\u0000/g, "").trim();
  if (trimmed.length < 20) {
    throw new CvExtractionError(
      "The file did not contain enough readable text. If this is a scanned CV, please paste the text instead.",
    );
  }
  return trimmed;
}
