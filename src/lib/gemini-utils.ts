import fs from 'fs/promises';
import path from 'path';

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), 'config', 'gemini_system_prompt.txt');

/**
 * Reads the Gemini system prompt from the configuration file.
 * @returns {Promise<string>} The system prompt.
 * @throws {Error} If the system prompt file cannot be read.
 */
export async function getGeminiSystemPrompt(): Promise<string> {
  try {
    const prompt = await fs.readFile(SYSTEM_PROMPT_PATH, 'utf-8');
    return prompt;
  } catch (error) {
    console.error('Error reading Gemini system prompt:', error);
    throw new Error('Could not read Gemini system prompt file.');
  }
}

/**
 * Prepares an invoice file for the Gemini API.
 * Reads the file, converts it to base64, and determines its MIME type.
 * @param {string} filePath - The absolute path to the invoice file.
 * @returns {Promise<{ mimeType: string, data: string }>} An object containing the MIME type and base64 encoded data.
 * @throws {Error} If the file cannot be read or if the file type is unsupported.
 */
export async function prepareInvoiceDataForGemini(filePath: string): Promise<{ mimeType: string, data: string }> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const base64Data = fileBuffer.toString('base64');
    const extension = path.extname(filePath).toLowerCase();

    let mimeType: string;
    if (extension === '.pdf') {
      mimeType = 'application/pdf';
    } else if (extension === '.jpeg' || extension === '.jpg') {
      mimeType = 'image/jpeg';
    }
    // Add other image types if needed, e.g., png
    // else if (extension === '.png') {
    //   mimeType = 'image/png';
    // }
    else {
      throw new Error(`Unsupported file type: ${extension}`);
    }

    return { mimeType, data: base64Data };
  } catch (error) {
    console.error(`Error preparing invoice file ${filePath}:`, error);
    if (error instanceof Error && error.message.startsWith('Unsupported file type')) {
      throw error;
    }
    throw new Error(`Could not prepare invoice file ${filePath}.`);
  }
}

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, Part } from "@google/generative-ai";

const MODEL_NAME = "gemini-1.5-flash-latest"; // Updated model

/**
 * Sends a request to the Google Gemini API to process an invoice.
 * @param {string} systemPrompt - The base system prompt to guide Gemini.
 * @param {string} invoiceMimeType - The MIME type of the invoice file.
 * @param {string} invoiceBase64Data - The base64 encoded invoice data.
 * @param {(string | Part)[]} [additionalContextParts] - Optional array of additional text or Part objects for context (e.g., previous pass output, specific instructions).
 * @returns {Promise<string | null>} The text response from Gemini, or null if an error occurs.
 * @throws {Error} If the API key is missing or if there's an API communication error.
 */
export async function callGeminiApi(
  systemPrompt: string,
  invoiceMimeType: string,
  invoiceBase64Data: string,
  additionalContextParts?: (string | Part)[]
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_GEMINI_API_KEY is not set in environment variables.");
    throw new Error("Missing Google Gemini API Key.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });

  const generationConfig = {
    temperature: 0.2, // Lower temperature for more deterministic output
    topK: 1,
    topP: 1,
    maxOutputTokens: 8192, // Max output tokens for gemini-pro-vision
  };

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  const parts: Part[] = [{ text: systemPrompt }];

  // Add the main invoice data
  parts.push({
    inlineData: {
      mimeType: invoiceMimeType,
      data: invoiceBase64Data,
    },
  });

  // Add any additional context parts
  if (additionalContextParts && additionalContextParts.length > 0) {
    additionalContextParts.forEach(part => {
      if (typeof part === 'string') {
        parts.push({ text: part });
      } else {
        parts.push(part);
      }
    });
  }

  // Add a final instruction to ensure JSON output
  parts.push({ text: "\nEnsure your entire response is a single, valid JSON object based on the provided schema. Do not include any text outside of the JSON structure." });

  try {
    console.log(`Calling Gemini API for model: ${MODEL_NAME}`);
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
      safetySettings,
    });

    const response = result.response;
    if (!response || !response.candidates || response.candidates.length === 0) {
        console.error("Gemini API returned no candidates or an empty response.");
        // Check for finishReason if available
        if (response && response.promptFeedback) {
            console.error("Prompt Feedback:", response.promptFeedback);
        }
        if (response && response.candidates && response.candidates[0] && response.candidates[0].finishReason) {
            console.error("Finish Reason:", response.candidates[0].finishReason);
            if (response.candidates[0].safetyRatings) {
                 console.error("Safety Ratings:", response.candidates[0].safetyRatings);
            }
        }
        return null;
    }
    
    // Assuming the first candidate is the one we want
    const candidate = response.candidates[0];
    if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0 && candidate.content.parts[0].text) {
        return candidate.content.parts[0].text;
    } else {
        console.error("Gemini API response did not contain the expected text part:", candidate);
        return null;
    }

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    // It's good to re-throw or handle specifically if it's an API error vs. other runtime error
    if (error instanceof Error) {
        throw new Error(`Gemini API call failed: ${error.message}`);
    }
    throw new Error("An unknown error occurred while calling the Gemini API.");
  }
}