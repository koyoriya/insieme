import { useState, useCallback } from 'react';
import { generateWorksheetPDFServer, generateWorksheetPDF, PDFOptions, WorksheetPDFData } from '@/lib/pdf';

/**
 * Hook for PDF generation functionality
 */
export function usePDF() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate PDF from worksheet data
   */
  const generatePDF = useCallback(async (
    worksheet: WorksheetPDFData,
    options?: PDFOptions
  ) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Try server-side generation first, fallback to client-side if needed
      await generateWorksheetPDFServer(worksheet, options);
    } catch (serverErr) {
      console.warn('Server-side PDF generation failed, falling back to client-side:', serverErr);
      try {
        await generateWorksheetPDF(worksheet, options);
      } catch (clientErr) {
        const errorMessage = clientErr instanceof Error ? clientErr.message : 'PDF生成に失敗しました';
        setError(errorMessage);
        throw clientErr;
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);


  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isGenerating,
    error,
    generatePDF,
    clearError
  };
}

/**
 * Hook specifically for worksheet PDF generation
 */
export function useWorksheetPDF() {
  const { isGenerating, error, generatePDF, clearError } = usePDF();

  /**
   * Generate PDF without answers (for printing before submission)
   */
  const generateProblemsPDF = useCallback(async (
    worksheet: WorksheetPDFData,
    filename?: string
  ) => {
    const options: PDFOptions = {
      filename,
      includeAnswers: false,
      format: 'A4',
      orientation: 'portrait'
    };

    return generatePDF(worksheet, options);
  }, [generatePDF]);

  /**
   * Generate PDF with answers and explanations (for review after submission)
   */
  const generateAnswersPDF = useCallback(async (
    worksheet: WorksheetPDFData,
    filename?: string
  ) => {
    const options: PDFOptions = {
      filename,
      includeAnswers: true,
      format: 'A4',
      orientation: 'portrait'
    };

    return generatePDF(worksheet, options);
  }, [generatePDF]);

  return {
    isGenerating,
    error,
    generateProblemsPDF,
    generateAnswersPDF,
    clearError
  };
}