"use client";

interface InvoiceViewerProps {
  fileName: string | null | undefined;
  mimeType: string | null | undefined;
  data: string | null | undefined; // Base64 encoded data
}

const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ fileName, mimeType, data }) => {
  if (!data || !mimeType || !fileName) {
    return (
      <div className="flex-grow h-full min-h-[24rem] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 p-4">
        <p>(Waiting for invoice preview...)</p>
      </div>
    );
  }

  if (mimeType.startsWith('image/')) {
    return (
      <div className="flex-grow h-full min-h-[24rem] bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden p-2">
        <img
          src={`data:${mimeType};base64,${data}`}
          alt={`Preview of ${fileName}`}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (mimeType === 'application/pdf') {
    return (
      <div className="flex-grow h-full min-h-[24rem] bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden">
        <object
          data={`data:${mimeType};base64,${data}`}
          type="application/pdf"
          className="w-full h-full"
        >
          <p className="p-4 text-gray-300">
            PDF preview not available. Your browser may not support embedding PDFs this way.
            <br />
            File: {fileName}
          </p>
        </object>
      </div>
    );
  }

  return (
    <div className="flex-grow h-full min-h-[24rem] bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 p-4">
      <p>Unsupported preview type: {mimeType} for file {fileName}</p>
    </div>
  );
};

export default InvoiceViewer;