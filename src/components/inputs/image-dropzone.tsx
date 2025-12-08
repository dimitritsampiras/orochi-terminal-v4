// 'use client';

// import { Icon } from '@iconify/react';
// import { FileUpload } from '@skeletonlabs/skeleton-react';
// import Image from 'next/image';
// import { useState } from 'react';
// import { deleteFile, uploadFileClient } from '@/lib/core/upload/upload-file-from-client';
// import { Button } from '../ui/button';
// import { toast } from 'sonner';

// function ImageDropzone({
//   url,
//   setUrl
// }: {
//   url: string | null;
//   setUrl: (url: string | null) => void;
// }) {
//   const [file, setFile] = useState<File | null>(null);
//   const [previewUrl, setPreviewUrl] = useState<string | null>(null);
//   const [isUploading, setIsUploading] = useState(false);
//   const [supabaseFilePath, setSupabaseFilePath] = useState<string | null>(null);

//   return file || url ? (
//     <div className="w-full h-[160px] rounded-xl border overflow-clip relative group">
//       {/* Show spinner overlay while uploading */}
//       {isUploading && (
//         <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10">
//           <Icon icon="ph:spinner" className="size-6 animate-spin text-white" />
//         </div>
//       )}

//       {!isUploading && (file || url) && (
//         <div className="absolute inset-0 group-hover:opacity-100 opacity-0 transition-opacity duration-300 bg-black/20 flex justify-end items-start p-2 z-10">
//           <Button
//             type="button"
//             variant="secondary"
//             size="icon"
//             onClick={() => {
//               setFile(null);
//               setUrl(null);
//               setPreviewUrl(null);
//               // TODO: if editing, the url won't get deleted, perhaps revist this
//               if (supabaseFilePath) {
//                 deleteFile({ filePath: supabaseFilePath, bucketName: 'products' });
//               }
//             }}
//           >
//             <Icon icon="ph:trash" className="size-4" />
//           </Button>
//         </div>
//       )}

//       {/* Show preview first, then permanent URL once uploaded */}
//       {url || previewUrl ? (
//         <Image
//           src={url || previewUrl || ''}
//           alt="product image"
//           width={100}
//           height={100}
//           className="w-full h-full object-contain rounded"
//         />
//       ) : (
//         <div>Loading preview...</div>
//       )}
//     </div>
//   ) : (
//     <FileUpload
//       classes="w-full transition-all duration-300 rounded-xl"
//       accept="image/*"
//       iconInterface={<Icon icon="ph:image" className="size-5" />}
//       maxFiles={1}
//       onFileChange={async (details) => {
//         const selectedFile = details.acceptedFiles[0];
//         if (!selectedFile) return;

//         setFile(selectedFile);

//         const reader = new FileReader();
//         reader.onload = (event) => {
//           const image = event.target?.result as string;
//           setPreviewUrl(image);
//         };
//         reader.readAsDataURL(selectedFile);

//         setIsUploading(true);
//         try {
//           console.log('uploading....');
//           // Create a promise that resolves after the timeout

//           const result = await uploadFileClient({
//             file: selectedFile,
//             bucketName: 'products'
//           });

//           if (result.error) {
//             toast.error('Failed to upload image');
//           } else {
//             console.log('result', result);

//             if (result.data) {
//               setUrl(result.data.publicUrl);
//               setSupabaseFilePath(result.data.filePath);
//             }
//           }
//         } catch (error) {
//           console.log('Upload error:', error);
//         } finally {
//           setIsUploading(false);
//         }
//       }}
//       subtext="Attach an image for the product."
//     />
//   );
// }

// export { ImageDropzone };
