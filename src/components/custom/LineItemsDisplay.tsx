'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Assuming shadcn/ui Card
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
  vat_rate?: number;
  vat_amount?: number;
}

export interface TaxDetail {
  tax_description?: string;
  tax_rate?: number;
  tax_amount?: number;
}

export interface InvoiceData {
  invoice_id?: string;
  invoice_date?: string;
  invoice_number?: string;
  supplier_name?: string;
  supplier_address?: string;
  supplier_vat_number?: string;
  customer_name?: string;
  customer_number?: string;
  customer_address?: string;
  customer_vat_number?: string;
  payment_due_date?: string;
  payment_terms?: string;
  currency?: string;
  line_items?: LineItem[];
  subtotal_amount?: number;
  discount_amount?: number;
  tax_details?: TaxDetail[];
  heffing?: number;
  total_amount?: number;
  notes?: string;
  extraction_confidence?: number;
  processing_timestamp?: string;
  original_filename?: string;
}

interface ExtractedData {
  parsedData?: InvoiceData; // The full parsed JSON object
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
  onLineItemsChange?: (updatedLineItems: LineItem[]) => void;
}

const LineItemsDisplay: React.FC<LineItemsDisplayProps> = ({
  extractedData,
  onLineItemsChange,
}) => {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (extractedData?.parsedData?.line_items) {
      setLineItems(extractedData.parsedData.line_items);
    } else {
      setLineItems([]);
    }
  }, [extractedData]);

  const handleLineItemsUpdate = (updatedLineItems: LineItem[]) => {
    setLineItems(updatedLineItems);
    if (onLineItemsChange) {
      onLineItemsChange(updatedLineItems);
    }
  };

  const handleInputChange = (
    index: number,
    field: keyof LineItem,
    value: string | number
  ) => {
    const updatedLineItems = [...lineItems];
    // Ensure numeric fields are stored as numbers
    if (
      field === 'quantity' ||
      field === 'unit_price' ||
      field === 'total_price' ||
      field === 'vat_rate' ||
      field === 'vat_amount'
    ) {
      const numValue = parseFloat(value as string);
      updatedLineItems[index] = {
        ...updatedLineItems[index],
        [field]: isNaN(numValue) ? undefined : numValue,
      };
    } else if (field === 'description') {
      updatedLineItems[index] = {
        ...updatedLineItems[index],
        [field]: String(value),
      };
    }
    // The 'else' block for 'as any' is removed as the preceding conditions cover all valid LineItem fields.
    handleLineItemsUpdate(updatedLineItems);
  };

  const addLineItem = () => {
    const newLineItem: LineItem = {
      description: '',
      quantity: undefined,
      unit_price: undefined,
      total_price: undefined,
    };
    handleLineItemsUpdate([...lineItems, newLineItem]);
  };

  const removeLineItem = (index: number) => {
    const updatedLineItems = lineItems.filter((_, i) => i !== index);
    handleLineItemsUpdate(updatedLineItems);
  };

  if (!extractedData) {
    return (
      <div className="flex-grow h-full min-h-[24rem] bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 p-4">
        <p>(Waiting for extracted data...)</p>
      </div>
    );
  }

  const { parsedData, status, errorDetail, __validation_details } =
    extractedData;

  if (status?.includes('error')) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-red-400">Extraction Error</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto">
          <pre className="text-xs text-red-300">
            {errorDetail || 'An unknown error occurred during extraction.'}
          </pre>
        </CardContent>
      </Card>
    );
  }

  if (!parsedData) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow overflow-auto">
          <p className="text-xs text-gray-400">
            {extractedData.parsedDataSnippet || status || 'No data to display.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Line Items</CardTitle>
        <Button onClick={addLineItem} size="sm">
          Add Line Item
        </Button>
      </CardHeader>
      <CardContent className="flex-grow overflow-auto text-xs">
        {__validation_details && (
          <div
            className={`mb-2 p-2 rounded text-sm ${
              __validation_details.status === 'passed'
                ? 'bg-green-800 text-green-100'
                : 'bg-red-800 text-red-100'
            }`}
          >
            <strong>Validation: </strong>
            {__validation_details.status === 'passed'
              ? 'Schema validation passed.'
              : `Schema validation failed: ${__validation_details.errors_summary || 'See details in JSON.'}`}
          </div>
        )}
        {(!lineItems || lineItems.length === 0) && !parsedData.line_items && (
          <p className="text-gray-400 text-sm">
            No line items found in the extracted data. You can add them
            manually.
          </p>
        )}
        {lineItems && lineItems.length > 0 && (
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400">
                <th className="p-1 font-normal">Description</th>
                <th className="p-1 font-normal w-20">Qty</th>
                <th className="p-1 font-normal w-24">Unit Price</th>
                <th className="p-1 font-normal w-24">Total Price</th>
                <th className="p-1 font-normal w-20">VAT Rate</th>
                <th className="p-1 font-normal w-24">VAT Amount</th>
                <th className="p-1 font-normal w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-700 hover:bg-gray-750"
                >
                  <td className="p-1">
                    <Input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        handleInputChange(index, 'description', e.target.value)
                      }
                      className="bg-white border-gray-300 text-gray-900 h-7 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={item.quantity === undefined ? '' : item.quantity}
                      onChange={(e) =>
                        handleInputChange(index, 'quantity', e.target.value)
                      }
                      className="bg-white border-gray-300 text-gray-900 h-7 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={
                        item.unit_price === undefined ? '' : item.unit_price
                      }
                      onChange={(e) =>
                        handleInputChange(index, 'unit_price', e.target.value)
                      }
                      className="bg-white border-gray-300 text-gray-900 h-7 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      value={
                        item.total_price === undefined ? '' : item.total_price
                      }
                      onChange={(e) =>
                        handleInputChange(index, 'total_price', e.target.value)
                      }
                      className="bg-white border-gray-300 text-gray-900 h-7 text-xs"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.vat_rate === undefined ? '' : item.vat_rate}
                      onChange={(e) =>
                        handleInputChange(index, 'vat_rate', e.target.value)
                      }
                      className="bg-white border-gray-300 text-gray-900 h-7 text-xs"
                      placeholder="e.g. 0.21"
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={
                        item.vat_amount === undefined ? '' : item.vat_amount
                      }
                      onChange={(e) =>
                        handleInputChange(index, 'vat_amount', e.target.value)
                      }
                      className="bg-white border-gray-300 text-gray-900 h-7 text-xs"
                      placeholder="e.g. 10.50"
                    />
                  </td>
                  <td className="p-1 text-center">
                    <Button
                      onClick={() => removeLineItem(index)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 h-7 px-2"
                    >
                      Del
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Fallback to JSON display if line items are not in the expected structure or for debugging */}
        {/* <pre>{JSON.stringify(parsedData, null, 2)}</pre> */}
      </CardContent>
    </Card>
  );
};

export default LineItemsDisplay;
