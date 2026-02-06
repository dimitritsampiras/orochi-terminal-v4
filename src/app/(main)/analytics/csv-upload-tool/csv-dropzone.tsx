"use client";

import { useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, X } from "lucide-react";

interface CSVDropzoneProps {
    onFileSelect: (file: File) => void;
    isProcessing?: boolean;
}

export function CSVDropzone({ onFileSelect, isProcessing }: CSVDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragIn = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragOut = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const validateFile = useCallback((file: File): boolean => {
        if (!file.name.endsWith('.csv')) {
            setError('Please upload a CSV file');
            return false;
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            setError('File size must be less than 10MB');
            return false;
        }
        setError(null);
        return true;
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (validateFile(file)) {
                setSelectedFile(file);
                onFileSelect(file);
            }
        }
    }, [onFileSelect, validateFile]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (validateFile(file)) {
                setSelectedFile(file);
                onFileSelect(file);
            }
        }
    }, [onFileSelect, validateFile]);

    const clearFile = useCallback(() => {
        setSelectedFile(null);
        setError(null);
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Bank Export
                </CardTitle>
            </CardHeader>
            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {selectedFile ? (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <div>
                                <p className="font-medium">{selectedFile.name}</p>
                                <p className="text-sm text-muted-foreground">
                                    {(selectedFile.size / 1024).toFixed(1)} KB
                                </p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={clearFile} disabled={isProcessing}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div
                        className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
              ${isDragging
                                ? 'border-primary bg-primary/5'
                                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                            }
            `}
                        onDragEnter={handleDragIn}
                        onDragLeave={handleDragOut}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('csv-file-input')?.click()}
                    >
                        <input
                            id="csv-file-input"
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={handleFileInput}
                        />
                        <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                        <p className="font-medium mb-1">
                            Drop your CSV file here or click to browse
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Supports: Rho Bank, Rho Credit Card, Wise, PayPal, Mercury
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
