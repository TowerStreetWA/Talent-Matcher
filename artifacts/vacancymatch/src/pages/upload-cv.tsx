import React, { useState } from "react";
import { useUploadCv } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud } from "lucide-react";

export default function UploadCv() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const uploadMutation = useUploadCv();
  
  const [fileName, setFileName] = useState("");
  const [cvText, setCvText] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setCvText(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName || !cvText) {
      toast({
        title: "Error",
        description: "Please provide both a file name and CV text.",
        variant: "destructive"
      });
      return;
    }

    uploadMutation.mutate(
      { data: { fileName, cvText } },
      {
        onSuccess: (data) => {
          toast({
            title: "Success",
            description: "CV parsed successfully."
          });
          setLocation(`/candidates/${data.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to upload CV.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Candidate</h1>
        <p className="text-muted-foreground mt-1">Upload a CV or paste raw text to create a new profile.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CV Details</CardTitle>
          <CardDescription>We will automatically parse the skills, experience, and preferences.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="file">Upload File (.txt)</Label>
              <Input id="file" type="file" accept=".txt" onChange={handleFileChange} />
            </div>
            
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

            <Button type="submit" className="w-full" disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "Parsing CV..." : (
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
