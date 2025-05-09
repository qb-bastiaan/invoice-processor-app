"use client"; 

import { useState, useEffect } from 'react';
import { PlayCircle, StopCircle, CheckCircle, XCircle } from 'lucide-react';
import InvoiceViewer from '@/components/custom/InvoiceViewer'; // Re-enable import
import LineItemsDisplay from '@/components/custom/LineItemsDisplay'; // Re-enable import
// import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog'; // Still commented

interface ApiProcessingResult {
  fileName: string;
  status: string;
  geminiResponsePreview?: string | null;
  errorDetail?: string | null;
  parsedDataSnippet?: string | null;
  parsedData?: any; 
  outputFilename?: string;
  previewMimeType?: string; 
  previewData?: string; 
  isLastUpdateForFile?: boolean;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false); 
  const [message, setMessage] = useState('Page loaded. Step 3: Full onmessage state logic re-enabled.');
  const [processingResults, setProcessingResults] = useState<ApiProcessingResult[]>([]); 
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number } | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null); 
  
  const [currentFilePreview, setCurrentFilePreview] = useState<{fileName: string, mimeType: string, data: string} | null>(null);
  const [currentFileExtractedData, setCurrentFileExtractedData] = useState<ApiProcessingResult | null>(null);
  
  const [showExampleModal, setShowExampleModal] = useState(false);

  const [nextFileIndexToProcess, setNextFileIndexToProcess] = useState(0);
  const [totalFilesToProcess, setTotalFilesToProcess] = useState(0);
  const [isWaitingForAcceptance, setIsWaitingForAcceptance] = useState(false); 
  const [isBatchProcessingActive, setIsBatchProcessingActive] = useState(false);

  useEffect(() => {
    return () => {
      if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
        console.log("useEffect cleanup: Closing eventSource");
        eventSource.close();
      }
    };
  }, [eventSource]);

  // Removed EFFECT_LOG for processingResults to reduce console noise now

  const startProcessingFileAtIndex = (index: number) => {
    console.log(`Attempting to start EventSource for index ${index}.`);
    
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) {
      console.log("Closing existing eventSource in startProcessingFileAtIndex");
      eventSource.close();
    }
    setCurrentFilePreview(null); 
    setCurrentFileExtractedData(null); 
    setIsLoading(true); 
    setIsWaitingForAcceptance(false);
    setMessage(`Requesting processing for file index ${index}...`);
    
    // totalFilesToProcess will be updated by the 'info' event if it's the first file.
    // For subsequent files, currentProgress relies on totalFilesToProcess already being set.
    if (totalFilesToProcess > 0) {
        setCurrentProgress({ current: index + 1, total: totalFilesToProcess });
    } else if (index === 0) { // For the very first file, show some initial progress
        setCurrentProgress({ current: 1, total: 1 }); // Placeholder total, will be updated
    }


    const es = new EventSource(`/api/process-invoices?start_index=${index}`);
    setEventSource(es); 

    es.onmessage = (event) => { 
      console.log("Raw SSE event.data:", event.data);
      try {
        const eventData = JSON.parse(event.data);
        console.log("Parsed SSE eventData:", eventData);

        switch (eventData.type) {
          case 'info':
            // Only set totalFilesToProcess from the first 'info' event of a new batch
            if (index === 0 && eventData.totalFiles !== undefined) { // Check if it's the first file call (index 0)
              setTotalFilesToProcess(eventData.totalFiles);
              setCurrentProgress({ current: 1, total: eventData.totalFiles }); 
            }
            setMessage(eventData.message); // Always update message
            break;
          case 'file_update':
            const fileData = eventData.data as ApiProcessingResult;
            if (fileData.previewData && fileData.previewMimeType) {
              setCurrentFilePreview({
                fileName: fileData.fileName,
                mimeType: fileData.previewMimeType,
                data: fileData.previewData,
              });
            }
            setCurrentFileExtractedData(fileData); 
            setMessage(`Status for ${fileData.fileName}: ${fileData.status}`);
            if (totalFilesToProcess > 0) { // Ensure totalFilesToProcess is set before calculating progress
              setCurrentProgress({ current: index + 1, total: totalFilesToProcess });
            }
            break;
          case 'index_processed':
            setMessage(eventData.message);
            if (eventData.processedFileResult) {
              // console.log("Before setProcessingResults, current processingResults:", processingResults); // Keep commented
              // console.log("Adding to processingResults:", eventData.processedFileResult); // Keep commented
              setCurrentFileExtractedData(eventData.processedFileResult);
              setProcessingResults(prev => {
                const newResults = [...prev, eventData.processedFileResult];
                // console.log("After setProcessingResults, new processingResults:", newResults); // Keep commented
                return newResults;
              });
            }
            
            if (eventData.isOverallLastFile) {
              setMessage("All files in the batch have been processed.");
              setIsLoading(false);
              setIsBatchProcessingActive(false);
              setIsWaitingForAcceptance(false);
              setNextFileIndexToProcess(0); 
              if (totalFilesToProcess > 0) {
                  setCurrentProgress({current: totalFilesToProcess, total: totalFilesToProcess});
              }
            } else {
              setIsWaitingForAcceptance(true); 
              setIsLoading(false); 
            }
            if(es && es.readyState !== EventSource.CLOSED) {
              console.log("Closing SSE stream after 'index_processed'.");
              es.close(); 
            }
            setEventSource(null); 
            break;
          case 'error': 
            setMessage(`Error from backend: ${eventData.message}`);
            setIsLoading(false);
            // setIsBatchProcessingActive(false); // Consider if this is too disruptive for some errors
            // setIsWaitingForAcceptance(false);
            if(es && es.readyState !== EventSource.CLOSED) {
              console.log("Closing SSE stream due to backend error event.");
              es.close();
            }
            setEventSource(null);
            break;
          default:
            console.log("Received unhandled SSE event type:", eventData.type, eventData);
        }
      } catch (e) {
        console.error("Error parsing or processing SSE event.data:", e);
        setMessage("Error processing incoming SSE message.");
      }
    };

    es.onerror = (err) => { 
      console.error('EventSource error:', err);
      setMessage('EventSource connection error or stream closed unexpectedly.');
      setIsLoading(false);
      // setIsBatchProcessingActive(false); // Potentially too aggressive
      // setIsWaitingForAcceptance(false);
      if(es && es.readyState !== EventSource.CLOSED) {
        console.log("Closing eventSource due to onerror.");
        es.close();
      }
      setEventSource(null); 
    };
  };

  const handleStartBatchProcessing = () => {
    setIsBatchProcessingActive(true);
    setProcessingResults([]); 
    setNextFileIndexToProcess(0);
    setTotalFilesToProcess(0); // Reset total files for a new batch
    setCurrentProgress(null); // Reset progress
    console.log("handleStartBatchProcessing: Calling startProcessingFileAtIndex(0)");
    startProcessingFileAtIndex(0); 
  };

  const handleAcceptAndNext = () => {
    console.log("handleAcceptAndNext called. Current nextFileIndexToProcess:", nextFileIndexToProcess, "Total files:", totalFilesToProcess);
    if (isWaitingForAcceptance) {
      const nextIndexToActuallyProcess = nextFileIndexToProcess + 1; 
      setNextFileIndexToProcess(nextIndexToActuallyProcess); 
      
      if (nextIndexToActuallyProcess < totalFilesToProcess) {
        setMessage(`Proceeding to file ${nextIndexToActuallyProcess + 1} of ${totalFilesToProcess}`);
        startProcessingFileAtIndex(nextIndexToActuallyProcess);
      } else {
        setMessage("All files in the batch have been processed. (from handleAcceptAndNext)");
        setIsLoading(false);
        setIsBatchProcessingActive(false);
        setIsWaitingForAcceptance(false);
        setNextFileIndexToProcess(0); 
        if (totalFilesToProcess > 0) {
             setCurrentProgress({current: totalFilesToProcess, total: totalFilesToProcess});
        }
      }
    } else {
      console.warn("handleAcceptAndNext called when not waiting for acceptance.");
    }
  };
  
  const handleStopBatchProcessing = () => {
    setIsLoading(false);
    setIsBatchProcessingActive(false);
    setIsWaitingForAcceptance(false);
    setMessage('Batch processing stopped by user.');
    console.log("handleStopBatchProcessing: Attempting to close EventSource");
    if (eventSource && eventSource.readyState !== EventSource.CLOSED) { 
       console.log("Closing eventSource in handleStopBatchProcessing");
       eventSource.close();
       setEventSource(null);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-background text-foreground p-4 sm:p-8 font-[family-name:var(--font-sans)]">
      <header className="w-full max-w-5xl mb-8 sm:mb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-3 sm:mb-4">
          Automated Invoice Processor
        </h1>
        <p className="text-md sm:text-lg text-gray-400">
          Utilizing Google Gemini for intelligent data extraction from PDF and JPEG invoices.
        </p>
      </header>

      <main className="w-full max-w-7xl mx-auto flex flex-col items-stretch gap-6 sm:gap-8">
        <section 
          className="w-full p-4 sm:p-6 bg-card text-card-foreground rounded-2xl shadow-sm"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {!isBatchProcessingActive ? (
              <Button
                onClick={handleStartBatchProcessing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                size="lg"
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                Start Batch Processing
              </Button>
            ) : (
              <Button
                onClick={handleStopBatchProcessing}
                variant="destructive"
                size="lg"
                disabled={!isLoading && !isWaitingForAcceptance && isBatchProcessingActive} 
              >
                <StopCircle className="mr-2 h-5 w-5" />
                Stop Batch Processing
              </Button>
            )}

            {isWaitingForAcceptance && isBatchProcessingActive && (
              <Button
                onClick={handleAcceptAndNext}
                className="bg-green-600 hover:bg-green-500 text-white"
                size="lg"
              >
                <CheckCircle className="mr-2 h-5 w-5" />
                Accept & Next File
              </Button>
            )}
          </div>
          
          {/* Progress Bar - re-enable this basic UI element */}
          {isBatchProcessingActive && isLoading && currentProgress && !isWaitingForAcceptance && (
            <div className="w-full mt-4">
              <p className="text-sm text-gray-300 mb-1 text-center sm:text-left">
                Processing File: {currentProgress.current} of {currentProgress.total}
              </p>
              <div className="h-3 bg-gray-700 rounded-full">
                <div
                  className="h-3 bg-primary rounded-full transition-all duration-300 ease-linear"
                  style={{ width: `${(currentProgress.current / currentProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {message && ( 
             <div className={`mt-4 p-3 rounded-md text-center w-full ${message.toLowerCase().includes("error") ? 'bg-red-900 text-red-100' : (isLoading || isWaitingForAcceptance ? 'bg-blue-900 text-blue-100' : 'bg-gray-700 text-gray-200')} border border-gray-600`}>
               <p className="text-sm font-medium">{message}</p>
             </div>
          )}
        </section>

        {/* Re-enable InvoiceViewer and LineItemsDisplay */}
        {(currentFilePreview || currentFileExtractedData) && isBatchProcessingActive && (
          <section
            className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mt-6" // Added mt-6 for spacing
          >
            <div className="bg-card text-card-foreground p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col">
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
                Invoice Preview: <span className="font-normal text-muted-foreground">{currentFilePreview?.fileName || currentFileExtractedData?.fileName || "N/A"}</span>
              </h3>
              <InvoiceViewer
                fileName={currentFilePreview?.fileName}
                mimeType={currentFilePreview?.mimeType}
                data={currentFilePreview?.data}
              />
            </div>
            <div className="bg-card text-card-foreground p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col">
              <LineItemsDisplay extractedData={currentFileExtractedData} />
            </div>
          </section>
        )}

        {/* Processing History - simplified rendering test */}
        <section
          className="w-full mt-4 sm:mt-8 p-4 sm:p-6 bg-card text-card-foreground border border-border rounded-2xl shadow-sm"
        >
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-center">Processing History</h2>
          <ul className="space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
            {/* Revert to original history list rendering logic */}
            {processingResults.length > 0 ? (
              processingResults.map((result, idx) => (
                <li key={`${result.fileName || `file-${idx}`}-${idx}`} className="p-3 bg-background rounded-md border border-border shadow-sm">
                  <p className="font-semibold text-primary">File: <span className="text-foreground break-all">{result.fileName || 'N/A'}</span></p>
                  <p className="text-sm">Status: <span className={`font-medium ${result.status && result.status.toLowerCase().includes("error") ? 'text-destructive' : 'text-primary'}`}>{result.status || 'N/A'}</span></p>
                  {result.outputFilename && <p className="text-sm">Output: <span className="text-muted-foreground break-all">{result.outputFilename}</span></p>}
                  {result.errorDetail && <p className="text-sm text-destructive">{result.errorDetail}</p>}
                </li>
              ))
            ) : (
              <li style={{ color: 'white', padding: '5px' }}>No processing history yet.</li>
            )}
          </ul>
        </section>
      </main>

      <footer className="w-full max-w-5xl mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-border-color text-center">
        <p className="text-xs sm:text-sm text-gray-500">
          Invoice Processor v0.1.0 - Powered by Next.js & Gemini
        </p>
      </footer>
    </div>
  );
}
