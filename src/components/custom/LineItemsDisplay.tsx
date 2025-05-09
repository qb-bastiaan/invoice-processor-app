"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Assuming shadcn/ui Card

interface ExtractedData {
  parsedData?: any; // The full parsed JSON object
  parsedDataSnippet?: string | null; // Allow null to match ApiProcessingResult
  status?: string;
  errorDetail?: string | null; // Allow null to match ApiProcessingResult
  // Add __validation_details if you plan to pass it and use it here
  __validation_details?: {
    status: string;
    errors_summary?: string;
  };
}

interface LineItemsDisplayProps {
  extractedData: ExtractedData | null;
}

const LineItemsDisplay: React.FC<LineItemsDisplayProps> = ({ extractedData }) => {
  if (!extractedData) {
    return (
      <div className="flex-grow h-full min-h-[24rem] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 p-4">
        <p>(Waiting for extracted data...)</p>
      </div>
    );
  }

  const { parsedData, status, errorDetail, __validation_details } = extractedData;

  if (status?.includes("error")) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-red-400">Extraction Error</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto">
          <pre className="text-xs text-red-300">{errorDetail || "An unknown error occurred during extraction."}</pre>
        </CardContent>
      </Card>
    );
  }

  if (!parsedData) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Extracted Data</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto">
          <p className="text-xs text-gray-400">
            {extractedData.parsedDataSnippet || status || "No data to display."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // TODO: Iterate here to display line items in a structured, editable way.
  // For now, just displaying the JSON.
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Extracted Data</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-auto text-xs">
        {__validation_details && (
          <div className={`mb-2 p-2 rounded text-sm ${
            __validation_details.status === "passed"
              ? 'bg-green-800 text-green-100'
              : 'bg-red-800 text-red-100'
          }`}>
            <strong>Validation: </strong>
            {__validation_details.status === "passed"
              ? "Schema validation passed."
              : `Schema validation failed: ${__validation_details.errors_summary || 'See details in JSON.'}`}
          </div>
        )}
        <pre>{JSON.stringify(parsedData, null, 2)}</pre>
      </CardContent>
    </Card>
  );
};

export default LineItemsDisplay;