import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const MAX_CV_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for a CV file upload. The client sends JSON
 * metadata (name, size, contentType) — NOT the file — then PUTs the file
 * directly to the returned presigned URL.
 */
router.post(
  "/storage/uploads/request-url",
  async (req: Request, res: Response): Promise<void> => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType } = parsed.data;
    if (size > MAX_CV_FILE_BYTES) {
      res.status(400).json({ message: "File is too large (max 10 MB)" });
      return;
    }
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      res.status(400).json({
        message: "Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
      });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      req.log.info({ name, size, contentType, objectPath }, "CV upload URL issued");
      res.json(RequestUploadUrlResponse.parse({ uploadURL, objectPath }));
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS (app assets only).
 * Uploaded CV files are NOT served here — they are streamed through the
 * tenant-scoped /candidates/:id/cv-file route.
 */
router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const raw = req.params["filePath"];
      const filePath = Array.isArray(raw) ? raw.join("/") : (raw ?? "");
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ message: "File not found" });
        return;
      }

      const response = await objectStorageService.downloadObject(file);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ message: "Failed to serve public object" });
    }
  },
);

export default router;
