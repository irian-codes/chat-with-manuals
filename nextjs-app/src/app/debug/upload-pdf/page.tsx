'use client';

import {useState} from 'react';

export default function UploadPDFPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      setFile(files[0]);
      setIsLoading(true);

      uploadFile(files[0])
        .then((res) => console.log('File uploaded successfully'))
        .catch((error) => {
          console.error(error);

          alert(
            'Error: ' + (error instanceof Error ? error.message : String(error))
          );
        })
        .finally(() => {
          setFile(null);
          setIsLoading(false);
        });
    } else {
      setFile(null);
    }
  };

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('output', 'json');

    const response = await fetch('/api/debug/parse-pdf', {
      method: 'POST',
      body: formData,
    });

    const res = await response.json();

    if (!response.ok) {
      throw new Error(
        `Failed to upload PDF: ${response.status} - ${response.statusText}
          ${JSON.stringify(res, null, 2)}`
      );
    }

    return res;
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-start p-24"
      onDrop={handleFileDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      <h1 className="font-sans text-4xl">Upload PDF</h1>

      {!file && (
        <div className="mt-6 flex h-64 w-64 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-black">
          <p className="text-center text-xl">DRAG TO UPLOAD FILE</p>
        </div>
      )}

      {file && isLoading && (
        <div className="mt-6 flex items-center justify-center">
          <p className="m-6">Loading...</p>
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-gray-300 border-r-transparent border-t-transparent" />
        </div>
      )}

      {file && !isLoading && (
        <div className="mt-6 flex items-center justify-center">
          <p className="m-6">
            {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        </div>
      )}
    </div>
  );
}
