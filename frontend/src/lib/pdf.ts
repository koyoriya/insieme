import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import katex from 'katex';

/**
 * PDF generation utilities for worksheet export
 */

export interface PDFOptions {
  filename?: string;
  includeAnswers?: boolean;
  format?: 'A4' | 'letter';
  orientation?: 'portrait' | 'landscape';
}

export interface WorksheetPDFData {
  title: string;
  description?: string;
  problems: Array<{
    id: string;
    question: string;
    options?: string[] | null;
    correctAnswer: string;
    explanation: string;
    type?: string;
  }>;
  createdAt?: string;
  difficulty?: string;
  topic?: string;
}

/**
 * Render KaTeX math expressions in a string
 */
export function renderMath(text: string): string {
  // Replace inline math delimited by $ ... $
  text = text.replace(/\$([^$]+)\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { throwOnError: false });
    } catch {
      return `$${math}$`; // Fallback to original if rendering fails
    }
  });
  
  // Replace display math delimited by $$ ... $$
  text = text.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math, { 
        displayMode: true, 
        throwOnError: false 
      });
    } catch {
      return `$$${math}$$`; // Fallback to original if rendering fails
    }
  });
  
  return text;
}

/**
 * Create a temporary DOM element for PDF generation
 */
function createPDFElement(worksheet: WorksheetPDFData, options: PDFOptions): HTMLElement {
  const element = document.createElement('div');
  element.style.cssText = `
    width: 210mm;
    background: white;
    padding: 20mm;
    font-family: 'Noto Sans JP', sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #000;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    text-align: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #333;
    padding-bottom: 15px;
  `;
  
  const title = document.createElement('h1');
  title.style.cssText = `
    font-size: 18pt;
    font-weight: bold;
    margin: 0 0 10px 0;
  `;
  title.textContent = worksheet.title;
  header.appendChild(title);

  if (worksheet.description) {
    const description = document.createElement('p');
    description.style.cssText = `
      font-size: 11pt;
      margin: 5px 0;
      color: #666;
    `;
    description.textContent = worksheet.description;
    header.appendChild(description);
  }

  // Metadata
  const metadata = document.createElement('div');
  metadata.style.cssText = `
    display: flex;
    justify-content: space-between;
    font-size: 10pt;
    color: #666;
    margin-top: 10px;
  `;
  
  const leftMeta = document.createElement('span');
  leftMeta.textContent = `難易度: ${worksheet.difficulty || 'N/A'} | トピック: ${worksheet.topic || 'N/A'}`;
  
  const rightMeta = document.createElement('span');
  rightMeta.textContent = `作成日: ${worksheet.createdAt ? new Date(worksheet.createdAt).toLocaleDateString('ja-JP') : 'N/A'}`;
  
  metadata.appendChild(leftMeta);
  metadata.appendChild(rightMeta);
  header.appendChild(metadata);
  
  element.appendChild(header);

  // Problems
  const problemsContainer = document.createElement('div');
  problemsContainer.style.marginTop = '20px';

  worksheet.problems.forEach((problem, index) => {
    const problemDiv = document.createElement('div');
    problemDiv.style.cssText = `
      margin-bottom: 25px;
      page-break-inside: avoid;
    `;

    // Problem number and question
    const questionDiv = document.createElement('div');
    questionDiv.style.cssText = `
      margin-bottom: 10px;
    `;
    
    const questionNumber = document.createElement('span');
    questionNumber.style.cssText = `
      font-weight: bold;
      margin-right: 10px;
    `;
    questionNumber.textContent = `問${index + 1}.`;
    
    const questionText = document.createElement('span');
    questionText.innerHTML = renderMath(problem.question);
    
    questionDiv.appendChild(questionNumber);
    questionDiv.appendChild(questionText);
    problemDiv.appendChild(questionDiv);

    // Options for multiple choice
    if (problem.options && problem.options.length > 0) {
      const optionsDiv = document.createElement('div');
      optionsDiv.style.cssText = `
        margin-left: 20px;
        margin-bottom: 10px;
      `;
      
      problem.options.forEach((option, optionIndex) => {
        const optionDiv = document.createElement('div');
        optionDiv.style.cssText = `
          margin: 5px 0;
        `;
        
        const optionLabel = document.createElement('span');
        optionLabel.style.cssText = `
          font-weight: bold;
          margin-right: 8px;
        `;
        optionLabel.textContent = `(${String.fromCharCode(65 + optionIndex)})`;
        
        const optionText = document.createElement('span');
        optionText.innerHTML = renderMath(option);
        
        optionDiv.appendChild(optionLabel);
        optionDiv.appendChild(optionText);
        optionsDiv.appendChild(optionDiv);
      });
      
      problemDiv.appendChild(optionsDiv);
    }

    // Answer space for non-multiple choice
    if (!problem.options || problem.options.length === 0) {
      const answerSpace = document.createElement('div');
      answerSpace.style.cssText = `
        margin: 15px 0 15px 20px;
        min-height: 60px;
        border: 1px solid #ddd;
        background: #f9f9f9;
      `;
      problemDiv.appendChild(answerSpace);
    }

    // Answers and explanations (if enabled)
    if (options.includeAnswers) {
      const answerSection = document.createElement('div');
      answerSection.style.cssText = `
        margin-top: 15px;
        padding: 10px;
        background: #f0f8ff;
        border-left: 4px solid #007bff;
      `;
      
      const answerLabel = document.createElement('div');
      answerLabel.style.cssText = `
        font-weight: bold;
        color: #007bff;
        margin-bottom: 5px;
      `;
      answerLabel.textContent = '解答:';
      
      const answerText = document.createElement('div');
      answerText.innerHTML = renderMath(problem.correctAnswer);
      answerText.style.marginBottom = '10px';
      
      const explanationLabel = document.createElement('div');
      explanationLabel.style.cssText = `
        font-weight: bold;
        color: #007bff;
        margin-bottom: 5px;
      `;
      explanationLabel.textContent = '解説:';
      
      const explanationText = document.createElement('div');
      explanationText.innerHTML = renderMath(problem.explanation);
      
      answerSection.appendChild(answerLabel);
      answerSection.appendChild(answerText);
      answerSection.appendChild(explanationLabel);
      answerSection.appendChild(explanationText);
      problemDiv.appendChild(answerSection);
    }

    problemsContainer.appendChild(problemDiv);
  });

  element.appendChild(problemsContainer);
  return element;
}

/**
 * Generate PDF from worksheet data
 */
export async function generateWorksheetPDF(
  worksheet: WorksheetPDFData,
  options: PDFOptions = {}
): Promise<void> {
  const {
    filename = `${worksheet.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')}.pdf`,
    format = 'A4',
    orientation = 'portrait'
  } = options;

  try {
    // Create temporary element
    const element = createPDFElement(worksheet, options);
    
    // Add to DOM temporarily
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '0';
    document.body.appendChild(element);

    // Generate canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    // Remove temporary element
    document.body.removeChild(element);

    // Calculate PDF dimensions
    const imgWidth = format === 'A4' ? 210 : 216; // mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format
    });

    const pageHeight = format === 'A4' ? 297 : 279; // mm
    let position = 0;

    // Add pages as needed
    while (position < imgHeight) {
      if (position > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        -position,
        imgWidth,
        imgHeight
      );

      position += pageHeight;
    }

    // Save PDF
    pdf.save(filename);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('PDF生成に失敗しました');
  }
}

/**
 * Generate PDF from DOM element
 */
export async function generateElementPDF(
  elementId: string,
  filename: string = 'document.pdf'
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with ID "${elementId}" not found`);
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });

    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'A4'
    });

    const pageHeight = 297; // A4 height in mm
    let position = 0;

    while (position < imgHeight) {
      if (position > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        -position,
        imgWidth,
        imgHeight
      );

      position += pageHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('PDF generation failed:', error);
    throw new Error('PDF生成に失敗しました');
  }
}