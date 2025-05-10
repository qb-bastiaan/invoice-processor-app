'use client';

import Image from 'next/image';

interface InvoiceViewerProps {
  fileName: string | null | undefined;
  mimeType: string | null | undefined;
  data: string | null | undefined; // Base64 encoded data
}

const InvoiceViewer: React.FC<InvoiceViewerProps> = ({
  fileName,
  mimeType,
  data,
}) => {
  if (!data || !mimeType || !fileName) {
    return (
      // This container should also grow if it's the one being rendered
      <div className="flex items-center justify-center text-gray-500 p-4 bg-gray-800 rounded-lg" style={{ height: '600px' }}>
        <p>(Waiting for invoice preview...)</p>
      </div>
    );
  }

  if (mimeType.startsWith('image/')) {
    return (
      <div>
        <img
          src={`data:${mimeType};base64,${data}`}
          alt={`Preview of ${fileName}`}
          style={{ width: '100%', height: '70vh', objectFit: 'contain' }}
        />
      </div>
    );
  }

  if (mimeType === 'application/pdf') {
    return (
      <div>
        <iframe
          src={`data:${mimeType};base64,${data}`}
          title={`Preview of ${fileName}`}
          style={{ width: '100%', height: '70vh', border: 'none' }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center text-gray-400 p-4 bg-gray-800 rounded-lg" style={{ height: '600px' }}>
      <p>
        Unsupported preview type: {mimeType} for file {fileName}
      </p>
    </div>
  );
};

export default InvoiceViewer;
