import fs from 'fs/promises';
import path from 'path';
import {
  getGeminiSystemPrompt,
  prepareInvoiceDataForGemini,
  callGeminiApi,
} from '@/lib/gemini-utils';
import Ajv, { ValidateFunction } from 'ajv';
// import addFormats from 'ajv-formats'; // Not strictly needed if not using complex formats like email, uuid directly in schema for now

const INPUT_FILES_DIR = path.join(process.cwd(), 'input-files');
const OUTPUT_DATA_DIR = path.join(process.cwd(), 'output-data');
const SUPPORTED_EXTENSIONS = ['.pdf', '.jpeg', '.jpg'];
const SCHEMA_PATH = path.join(
  process.cwd(),
  'config',
  'invoice_output_schema.json'
);

const ajv = new Ajv({ allErrors: true, useDefaults: true, coerceTypes: true });
// addFormats(ajv); // Uncomment if you add specific formats to your schema that need this
let validate: ValidateFunction | null = null;

async function getAndCompileInvoiceSchema(): Promise<ValidateFunction> {
  if (validate) return validate;
  const schemaContent = await fs.readFile(SCHEMA_PATH, 'utf-8');
  const schema = JSON.parse(schemaContent);
  validate = ajv.compile(schema);
  return validate;
}

interface ProcessingResult {
  fileName: string;
  status: string;
  geminiResponsePreview?: string | null;
  errorDetail?: string | null;
  parsedDataSnippet?: string | null;
  parsedData?: Record<string, unknown>;
  outputFilename?: string;
  previewMimeType?: string;
  previewData?: string; // base64 encoded
  isLastUpdateForFile?: boolean; // Flag for frontend
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const startIndexParam = url.searchParams.get('start_index');
  let startIndex = startIndexParam ? parseInt(startIndexParam, 10) : 0;

  if (isNaN(startIndex) || startIndex < 0) {
    startIndex = 0;
  }
  // console.log(`SSE: /api/process-invoices called with start_index: ${startIndex}`);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isStreamClosed = false;

      const sendEvent = (data: { type: string; [key: string]: unknown }) => {
        if (isStreamClosed || controller.desiredSize === null) {
          isStreamClosed = true;
          return;
        }
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch (e: unknown) {
          if (e instanceof Error && e.name === 'TypeError' && e.message.includes('Invalid state')) {
            isStreamClosed = true;
          } else {
            console.error(
              `Unhandled error enqueuing data for SSE (event type: ${data.type}):`,
              e
            );
          }
        }
      };

      const closeStream = () => {
        if (!isStreamClosed) {
          isStreamClosed = true;
          try {
            controller.close();
          } catch {
            // Ignore error if already closed
          }
        }
      };

      let currentProcessingResult: ProcessingResult | null = null; // Initialize outside file processing block
      let fileName: string | null = null; // Initialize outside

      try {
        const validateFunction = await getAndCompileInvoiceSchema();
        const allFilesInDir = await fs.readdir(INPUT_FILES_DIR);
        const supportedFiles = allFilesInDir.filter((file) => {
          const ext = path.extname(file).toLowerCase();
          return SUPPORTED_EXTENSIONS.includes(ext);
        });

        if (supportedFiles.length === 0) {
          sendEvent({
            type: 'error',
            message:
              'No supported files (PDF, JPEG, JPG) found in input-files directory.',
          });
          closeStream();
          return;
        }

        const systemPrompt = await getGeminiSystemPrompt(); // Fetch system prompt once

        if (startIndex === 0) {
          sendEvent({
            type: 'info',
            message: `Found ${supportedFiles.length} supported files. Starting batch...`,
            totalFiles: supportedFiles.length,
          });
        } else {
          sendEvent({
            type: 'info',
            message: `Requesting processing for file at index ${startIndex}. Total files: ${supportedFiles.length}`,
          });
        }

        if (startIndex >= supportedFiles.length) {
          sendEvent({
            type: 'index_processed',
            message: 'All files processed or requested index is out of bounds.',
            processedFileIndex: startIndex,
            isOverallLastFile: true,
            totalFiles: supportedFiles.length,
          });
          closeStream();
          return;
        }

        const i = startIndex;
        fileName = supportedFiles[i]; // Assign to fileName in this scope

        currentProcessingResult = {
          // Assign to currentProcessingResult in this scope
          fileName, // Now fileName is in scope
          status: 'processing_started',
          geminiResponsePreview: null,
          errorDetail: null,
          parsedDataSnippet: null,
          parsedData: undefined,
          outputFilename: undefined,
          previewMimeType: undefined,
          previewData: undefined,
        };

        sendEvent({
          type: 'file_update',
          progress: { current: i + 1, total: supportedFiles.length },
          data: { ...currentProcessingResult },
        });

        try {
          // Inner try-catch for this specific file's processing
          const filePath = path.join(INPUT_FILES_DIR, fileName); // fileName is now in scope
          const { mimeType, data: base64Data } =
            await prepareInvoiceDataForGemini(filePath);
          currentProcessingResult.status = 'prepared_for_gemini';
          currentProcessingResult.previewMimeType = mimeType;
          currentProcessingResult.previewData = base64Data;
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });

          currentProcessingResult.previewMimeType = undefined;
          currentProcessingResult.previewData = undefined;

          const pass1Prompt = `Analyze the structure of the following invoice. Identify key sections and their general locations (e.g., header, footer, main content area). This is Pass 1.`;
          currentProcessingResult.status = 'gemini_pass1_calling';
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });
          const pass1ResponseText = await callGeminiApi(
            systemPrompt,
            mimeType,
            base64Data,
            [pass1Prompt]
          );

          if (!pass1ResponseText)
            throw new Error(
              `Gemini (Pass 1: Structural Analysis) returned no text.`
            );
          currentProcessingResult.status = 'gemini_pass1_complete';
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });

          const pass1SummaryForPass2 = pass1ResponseText.substring(0, 300);
          const pass2Prompt = `Based on the structural analysis from Pass 1 (summary: "${pass1SummaryForPass2}"), identify and describe the locations (e.g., "top-left", "middle-right", "area below customer address", or textual descriptions of surrounding elements) of the following key information areas if present: Supplier Name, Invoice Number, Invoice Date, Due Date, Customer Information/Billing Address, Line Items table (or section detailing products/services), Subtotal, Tax amounts/details, and Grand Total. This is Pass 2.`;
          currentProcessingResult.status = 'gemini_pass2_calling';
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });
          const pass2ResponseText = await callGeminiApi(
            systemPrompt,
            mimeType,
            base64Data,
            [`Context from Pass 1: ${pass1ResponseText}`, pass2Prompt]
          );

          if (!pass2ResponseText)
            throw new Error(
              `Gemini (Pass 2: Region Identification) returned no text.`
            );
          currentProcessingResult.status = 'gemini_pass2_complete';
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });

          const pass1SummaryForPass3 = pass1ResponseText.substring(0, 200);
          const pass2SummaryForPass3 = pass2ResponseText.substring(0, 300);
          const pass3Prompt = `Using the invoice image, the structural analysis from Pass 1 (summary: "${pass1SummaryForPass3}"), and the key region identifications from Pass 2 (summary: "${pass2SummaryForPass3}"), meticulously extract all fields as defined in the JSON schema. Ensure accuracy, especially for line items, amounts, and tax details. This is Pass 3, the final extraction pass. Respond with ONLY the JSON object.`;
          currentProcessingResult.status =
            'gemini_pass3_json_extraction_calling';
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });
          const pass3GeminiResponseText = await callGeminiApi(
            systemPrompt,
            mimeType,
            base64Data,
            [
              `Context from Pass 1: ${pass1ResponseText}`,
              `Context from Pass 2: ${pass2ResponseText}`,
              pass3Prompt,
            ]
          );

          if (!pass3GeminiResponseText)
            throw new Error(
              `Gemini (Pass 3: JSON Extraction) returned no text.`
            );
          currentProcessingResult.geminiResponsePreview =
            pass3GeminiResponseText.substring(0, 100) + '...';
          currentProcessingResult.status =
            'gemini_pass3_json_extraction_complete';
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });

          let parsedDataAttempt: Record<string, unknown>;
          try {
            const cleanedResponseText = pass3GeminiResponseText
              .replace(/^```json\s*|```\s*$/g, '')
              .trim();
            parsedDataAttempt = JSON.parse(cleanedResponseText);
          } catch (parseError) {
            throw new Error(
              `JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`
            );
          }

          parsedDataAttempt.original_filename = fileName; // fileName is in scope
          parsedDataAttempt.processing_timestamp = new Date().toISOString();
          currentProcessingResult.parsedData = parsedDataAttempt;
          currentProcessingResult.parsedDataSnippet =
            JSON.stringify(parsedDataAttempt, null, 2).substring(0, 250) +
            '\n...';
          currentProcessingResult.status = 'json_parsed_and_enriched';
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });

          const isValid = validateFunction(parsedDataAttempt);
          let validationDetails: object;
          if (isValid) {
            validationDetails = { status: 'passed' };
            currentProcessingResult.status = 'validation_passed';
          } else {
            const errorSummary = ajv.errorsText(validateFunction.errors);
            validationDetails = {
              status: 'failed',
              errors_summary: errorSummary,
              errors_list: validateFunction.errors,
            };
            currentProcessingResult.status = 'validation_failed';
            currentProcessingResult.errorDetail = `Schema validation failed: ${errorSummary}`;
          }
          parsedDataAttempt.__validation_details = validationDetails;
          currentProcessingResult.parsedData = parsedDataAttempt;
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });

          const supplierName =
            typeof parsedDataAttempt.supplier_name === 'string'
              ? parsedDataAttempt.supplier_name.replace(/[^a-z0-9]/gi, '_')
              : 'UnknownSupplier';
          const invoiceDateStr =
            typeof parsedDataAttempt.invoice_date === 'string'
              ? parsedDataAttempt.invoice_date
              : new Date().toISOString().split('T')[0];
          const invoiceNumber =
            typeof parsedDataAttempt.invoice_number === 'string'
              ? parsedDataAttempt.invoice_number.replace(/[^a-z0-9]/gi, '_')
              : 'NoInvoiceNumber';
          const outputFilename = `${supplierName}_${invoiceDateStr}_${invoiceNumber}.json`;
          currentProcessingResult.outputFilename = outputFilename;
          const outputFilePath = path.join(OUTPUT_DATA_DIR, outputFilename);

          try {
            await fs.writeFile(
              outputFilePath,
              JSON.stringify(parsedDataAttempt, null, 2)
            );
            currentProcessingResult.status = 'saved_successfully';
          } catch (saveError) {
            throw new Error(
              `File save error: ${saveError instanceof Error ? saveError.message : String(saveError)}`
            );
          }
        } catch (fileProcessingError: unknown) {
          const errorMessage = fileProcessingError instanceof Error ? fileProcessingError.message : String(fileProcessingError);
          console.error(
            `Error processing file ${fileName}:`,
            errorMessage
          ); // fileName is in scope
          if (currentProcessingResult) {
            // Check if currentProcessingResult is not null
            currentProcessingResult.errorDetail = errorMessage;
            currentProcessingResult.status =
              currentProcessingResult.status.startsWith('error_')
                ? currentProcessingResult.status
                : 'error_processing_file';
            currentProcessingResult.parsedData = {
              error: 'Processing failed for this file',
              details: errorMessage,
            };
            currentProcessingResult.parsedDataSnippet = 'Error in processing.';
          }
        }

        if (currentProcessingResult) {
          // Check if currentProcessingResult is not null
          currentProcessingResult.isLastUpdateForFile = true;
          sendEvent({
            type: 'file_update',
            progress: { current: i + 1, total: supportedFiles.length },
            data: { ...currentProcessingResult },
          });
        }

        sendEvent({
          type: 'index_processed',
          message: `Finished processing for index ${startIndex}. File: ${fileName}. Status: ${currentProcessingResult?.status || 'unknown'}.`, // fileName is in scope
          processedFileIndex: startIndex,
          isOverallLastFile: startIndex >= supportedFiles.length - 1,
          totalFiles: supportedFiles.length,
          processedFileResult: currentProcessingResult
            ? { ...currentProcessingResult }
            : null, // Add the result here
        });
      } catch (error) {
        console.error(
          'Error in /api/process-invoices SSE stream logic (outer try):',
          error
        );
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.';
        sendEvent({ type: 'error', message: errorMessage });
      } finally {
        closeStream();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
