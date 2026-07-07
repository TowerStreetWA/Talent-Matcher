import React, { useState } from "react";
import { useUploadCv, useRequestUploadUrl } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { UploadCloud, FileText, X } from "lucide-react";

const ACCEPTED = ".pdf,.docx,.doc,.txt";

export default function UploadCv() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const uploadMutation = useUploadCv();
  const requestUrlMutation = useRequestUploadUrl();

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [cvText, setCvText] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setFileName(selected.name);
    }
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
            track("cv_parse_failed", { method: file ? "file" : "paste" });
            const message =
              err && typeof err === "object" && "message" in err
                ? String((err as { message: unknown }).message)
                : "Failed to upload CV.";
            toast({ title: "Error", description: message, variant: "destructive" });
          },
        },
      );
    } catch {
      track("cv_upload_failed", { stage: "file_transfer" });
      setIsUploading(false);
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
              <Label htmlFor="file">Upload File (.pdf, .docx, .txt)</Label>
              {file ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{file.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={clearFile}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Input id="file" type="file" accept={ACCEPTED} onChange={handleFileChange} />
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
