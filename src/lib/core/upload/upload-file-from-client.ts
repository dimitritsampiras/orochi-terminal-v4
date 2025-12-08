'use client';

import { createClient } from '../../clients/supabase-browser';

export const uploadFileClient = async ({
  file,
  bucketName
}: {
  file: File;
  bucketName: string;
}): Promise<
  { data: { publicUrl: string; fileId: string; filePath: string }; error: null } | { error: string; data: null }
> => {
  const supabase = createClient();
  console.log('user', await supabase.auth.getUser());

  const fileExt = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;

  const { data, error } = await supabase.storage.from(bucketName).upload(fileName, file, {
    cacheControl: '3600',
    upsert: false
  });

  if (error) {
    console.log('Upload error', error);
    return { error: 'Failed to upload file', data: null };
  }

  const { data: url } = supabase.storage.from(bucketName).getPublicUrl(fileName);

  return { data: { publicUrl: url?.publicUrl, fileId: data.id, filePath: data.path }, error: null };
};

export const deleteFile = async ({
  filePath,
  bucketName
}: {
  filePath: string;
  bucketName: string;
}): Promise<{ data: string; error: null } | { error: string; data: null }> => {
  const supabase = createClient();
  console.log('user', await supabase.auth.getUser());

  const { error } = await supabase.storage.from(bucketName).remove([filePath]);

  if (error) {
    console.log('Delete error', error);
    return { error: 'Failed to delete file', data: null };
  }

  console.log('file deleted');

  return { data: 'success', error: null };
};
