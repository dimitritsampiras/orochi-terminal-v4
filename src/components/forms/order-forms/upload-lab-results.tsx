'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button, ButtonSpinner } from '../../ui/button';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { GetOrdersResponse, UploadLabResultsSchema } from '@/lib/schemas/orders-schema';
import { uploadFileClient } from '@/lib/core/upload/upload-file-from-client';
import { Icon } from '@iconify/react/dist/iconify.js';

type Order = GetOrdersResponse['orders'][number];

function UploadLabResultsForm({
  order,
  isOpen,
  onOpenChange
}: {
  order: Order;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePassword, setFilePassword] = useState('');
  const [completed, setCompleted] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [processingResults, setProcessingResults] = useState(false);

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    setUploadingFile(true);

    try {
      // Step 1: Upload file to Supabase storage
      const uploadResult = await uploadFileClient({
        file,
        bucketName: 'labs' // You may need to create this bucket in Supabase
      });

      if (uploadResult.error) {
        toast.error('Failed to upload file to storage');
        return;
      }

      setUploadingFile(false);
      setProcessingResults(true);

      if (!uploadResult.data?.publicUrl) {
        toast.error('Failed to upload file to storage');
        return;
      }

      // Step 2: Send file URL to API for Eden AI processing
      const response = await fetch(`/api/orders/${order.id}/lab-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_url: uploadResult.data?.publicUrl,
          filePassword: filePassword || undefined
        } satisfies UploadLabResultsSchema)
      });

      if (response.ok) {
        const data = await response.json();
        setCompleted(true);
        router.refresh();

        // Short delay to show success state
        setTimeout(() => {
          onOpenChange(false);
          toast.success(`Lab results processed successfully for order #${order.orderNumber}`);
        }, 1500);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to process lab results');
      }
    } catch (error) {
      console.error('Error uploading lab results:', error);
      toast.error('Failed to upload lab results');
    } finally {
      setIsUploading(false);
      setUploadingFile(false);
      setProcessingResults(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFile(null);
      setFilePassword('');
      setIsUploading(false);
      setCompleted(false);
      setUploadingFile(false);
      setProcessingResults(false);
    }
  }, [isOpen]);

  const getLoadingMessage = () => {
    if (uploadingFile) return 'Uploading file to storage...';
    if (processingResults) return 'Processing lab results with AI...';
    return 'Processing...';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Upload Lab Results - Order #{order.orderNumber}</DialogTitle>
        </DialogHeader>

        {isUploading && !completed && (
          <div className="h-40 flex items-center flex-col justify-center gap-3">
            <Icon icon="ph:spinner-gap" className="size-6 animate-spin" />
            <div className="text-sm text-muted-foreground text-center">
              {getLoadingMessage()} <br /> Please do not close this window.
            </div>
          </div>
        )}

        {completed && (
          <div className="h-40 flex items-center flex-col justify-center gap-3">
            <Icon icon="ph:check-circle" className="size-6 text-green-500" />
            <div className="text-sm text-muted-foreground text-center">
              Lab results processed successfully.
            </div>
          </div>
        )}

        {!isUploading && !completed && (
          <div>
            <div className="space-y-2 py-4">
              <div className="space-y-2">
                <Label htmlFor="lab-results">Lab Results File</Label>
                <Input
                  id="lab-results"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={isUploading}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                Upload lab results in PDF format.
              </div>
            </div>

            {file && (
              <div className="space-y-2 py-4">
                <div className="space-y-2">
                  <Label htmlFor="file-password">File Password (optional)</Label>
                  <Input
                    autoComplete="off"
                    id="file-password"
                    type="password"
                    value={filePassword}
                    onChange={(e) => setFilePassword(e.target.value)}
                    disabled={isUploading}
                  />
                </div>

                <div className="text-sm text-muted-foreground">
                  If there is a password on the file, please enter it here.
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (isUploading) {
                if (confirm('Are you sure you want to cancel? This will cancel the upload')) {
                  onOpenChange(false);
                }
              } else {
                onOpenChange(false);
              }
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !file}>
            <ButtonSpinner loading={isUploading}>Upload</ButtonSpinner>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { UploadLabResultsForm };
