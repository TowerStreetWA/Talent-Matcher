import React, { useRef, useState } from "react";
import { useUploadCv, useRequestUploadUrl } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { isBillingGateError } from "@/lib/billing-gate";
import { UploadCloud, FileText, X } from "lucide-react";

const ACCEPTED = ".pdf,.docx,.doc,.txt";
const ACCEPTED_EXTENSIONS = ACCEPTED.split(",");

function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export default function UploadCv() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const uploadMutation = useUploadCv();
  const requestUrlMutation = useRequestUploadUrl();

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [cvText, setCvText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const acceptFile = (selected: File | undefined) => {
    if (!selected) return;
    if (!isAcceptedFile(selected)) {
      toast({
        title: "Unsupported file type",
        description: "Please use a PDF, DOCX, DOC, or TXT file.",
        variant: "destructive",
      });
      return;
    }
    setFile(selected);
    setFileName(selected.name);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (!e.dataTransfer.files?.length) return;
    acceptFile(e.dataTransfer.files[0]);
  };

  const clearFile = () => {
    setFile(null);
    setFileName("");
  };

  const busy = isUploading || uploadMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && (!fileName || !cvText)) {
      toast({
        title: "Error",
        description: "Choose a CV file, or provide a name and pasted CV text.",
        variant: "destructive",
      });
      return;
    }

    track("cv_upload_started", { method: file ? "file" : "paste" });

    try {
      let objectPath: string | undefined;
      if (file) {
        setIsUploading(true);
        const { uploadURL, objectPath: path } = await requestUrlMutation.mutateAsync({
          data: {
            name: file.name,
            size: file.size,
            contentType: file.type || "application/octet-stream",
          },
        });
        const putRes = await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!putRes.ok) {
          throw new Error("File upload failed");
        }
        objectPath = path;
        setIsUploading(false);
      }

      uploadMutation.mutate(
        {
          data: file
            ? { fileName: file.name, objectPath }
            : { fileName, cvText },
        },
        {
          onSuccess: (data) => {
            track("cv_parse_succeeded", { method: file ? "file" : "paste" });
            toast({ title: "Success", description: "CV parsed successfully." });
            setLocation(`/candidates/${data.id}`);
          },
          onError: (err: unknown) => {
            if (isBillingGateError(err)) return; // trial prompt dialog handles it
            track("cv_parse_failed", { method: file ? "file" : "paste" });
            const message =
              err && typeof err === "object" && "message" in err
                ? String((err as { message: unknown }).message)
                : "Failed to upload CV.";
            toast({ title: "Error", description: message, variant: "destructive" });
          },
        },
      );
    } catch (err) {
      setIsUploading(false);
      if (isBillingGateError(err)) return; // trial prompt dialog handles it
      track("cv_upload_failed", { stage: "file_transfer" });
      toast({
        title: "Error",
        description: "Failed to upload the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Candidate</h1>
        <p className="text-muted-foreground mt-1">Upload a CV file (PDF, DOCX, or TXT) or paste raw text to create a new profile.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CV Details</CardTitle>
          <CardDescription>We will store the original file and automatically parse the skills, experience, and preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="file">Upload File (.pdf, .docx, .doc, .txt)</Label>
              {file ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={clearFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Upload a CV file: drag and drop or click to browse"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  data-testid="cv-dropzone"
                  className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }`}
                >
                  <UploadCloud className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium">
                    {isDragging ? "Drop the file here" : "Drag & drop a CV here"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse — PDF, DOCX, DOC, or TXT
                  </p>
                  <input
                    ref={fileInputRef}
                    id="file"
                    type="file"
                    accept={ACCEPTED}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {!file && (
              <>
                <div className="flex items-center gap-4">
                  <div className="h-px bg-border flex-1" />
                  <span className="text-xs text-muted-foreground uppercase font-medium">OR PASTE TEXT</span>
                  <div className="h-px bg-border flex-1" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fileName">Candidate / File Name</Label>
                  <Input
                    id="fileName"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="e.g. John Doe CV.txt"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cvText">Raw CV Text</Label>
                  <Textarea
                    id="cvText"
                    value={cvText}
                    onChange={(e) => setCvText(e.target.value)}
                    placeholder="Paste the CV contents here..."
                    className="h-48"
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (isUploading ? "Uploading file..." : "Parsing CV...") : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" /> Upload & Parse
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
