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

  // Copy existing KaTeX styles from the page
  const katexStyles = document.createElement('style');
  try {
    // Try to find existing KaTeX stylesheet
    const stylesheets = Array.from(document.styleSheets);
    let katexCss = '';
    
    for (const sheet of stylesheets) {
      try {
        // Check if it's a KaTeX stylesheet
        if (sheet.href && sheet.href.includes('katex')) {
          const rules = Array.from(sheet.cssRules || []);
          katexCss += rules.map(rule => rule.cssText).join('\n');
        }
      } catch (e) {
        // CORS error - can't access external stylesheet
        console.warn('Cannot access stylesheet:', sheet.href);
      }
    }
    
    katexStyles.textContent = katexCss;
  } catch (e) {
    console.warn('Failed to copy KaTeX styles:', e);
    // Minimal fallback styles
    katexStyles.textContent = `
      .katex { font: normal 1.21em serif; line-height: 1.2; display: inline-block; vertical-align: baseline; }
      .katex .base { display: inline-block; vertical-align: baseline; }
      .katex .mfrac .frac-line { border-bottom: 1px solid; }
      .katex .mathnormal { vertical-align: baseline !important; }
      .katex .mathit { vertical-align: baseline !important; }
      .katex .mathrm { vertical-align: baseline !important; }
      .katex .mathbf { vertical-align: baseline !important; }
    `;
  }
  
  element.appendChild(katexStyles);

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
    // Add page break before each problem (except the first one)
    if (index > 0) {
      const pageBreak = document.createElement('hr');
      pageBreak.style.cssText = `
        page-break-before: always !important;
        break-before: page !important;
        visibility: hidden;
        margin: 0;
        padding: 0;
        border: none;
        height: 0;
      `;
      problemsContainer.appendChild(pageBreak);
    }

    const problemDiv = document.createElement('div');
    problemDiv.style.cssText = `
      margin-bottom: 25px;
    `;

    // Create a unified container for all problem content with page break control
    const problemContentDiv = document.createElement('div');
    problemContentDiv.style.cssText = `
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      display: block;
      overflow: visible;
      min-height: 150px;
      border: 0.1px solid transparent;
    `;
    
    // Add explicit page break avoidance attributes
    problemContentDiv.setAttribute('data-problem-container', 'true');
    problemContentDiv.setAttribute('style', problemContentDiv.getAttribute('style') + '; page-break-inside: avoid !important; break-inside: avoid !important;');

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
    problemContentDiv.appendChild(questionDiv);

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
      
      problemContentDiv.appendChild(optionsDiv);
    }

    // Add answer space for handwritten responses
    if (!options.includeAnswers) {
      const answerSpace = document.createElement('div');
      answerSpace.style.cssText = `
        margin-top: 20px;
        margin-bottom: 20px;
        min-height: 80px;
      `;
      
      problemContentDiv.appendChild(answerSpace);
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
      problemContentDiv.appendChild(answerSection);
    }

    // Add the unified content container to the problem div
    problemDiv.appendChild(problemContentDiv);
    problemsContainer.appendChild(problemDiv);
  });

  element.appendChild(problemsContainer);
  return element;
}

/**
 * Generate PDF from worksheet data using server-side Puppeteer
 */
export async function generateWorksheetPDFServer(
  worksheet: WorksheetPDFData,
  options: PDFOptions = {}
): Promise<void> {
  const functionsBaseUrl = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL || 'http://127.0.0.1:5001/insieme-dev-d7459/us-central1';
  
  try {
    const response = await fetch(`${functionsBaseUrl}/generateWorksheetPDF`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        worksheet,
        options
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.pdfData) {
      throw new Error('Failed to generate PDF on server');
    }

    // Create download link
    const link = document.createElement('a');
    link.href = result.pdfData;
    link.download = result.filename || `${worksheet.title.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (error) {
    console.error('Server-side PDF generation failed:', error);
    throw new Error('PDF生成に失敗しました');
  }
}

/**
 * Generate PDF from worksheet data (legacy html2canvas version)
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

    // Wait for fonts and styles to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate canvas with additional options for better math rendering and page breaks
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      removeContainer: false,
      onclone: (clonedDoc) => {
        // Ensure KaTeX styles are applied in the cloned document
        const katexLink = clonedDoc.createElement('link');
        katexLink.rel = 'stylesheet';
        katexLink.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
        clonedDoc.head.appendChild(katexLink);
        
        // Apply minimal inline styles to KaTeX elements
        const katexElements = clonedDoc.querySelectorAll('.katex');
        katexElements.forEach(el => {
          const htmlEl = el as HTMLElement;
          htmlEl.style.font = 'normal 1.21em Times New Roman, serif';
          htmlEl.style.lineHeight = '1.2';
          htmlEl.style.verticalAlign = 'baseline';
        });
        
        // Fix vertical alignment for math variables
        const mathElements = clonedDoc.querySelectorAll('.katex .mathnormal, .katex .mathit, .katex .mathrm, .katex .mathbf, .katex .base');
        mathElements.forEach(el => {
          const mathEl = el as HTMLElement;
          mathEl.style.verticalAlign = 'baseline';
        });
        
        // Ensure page breaks work with hr tags
        const pageBreaks = clonedDoc.querySelectorAll('hr');
        pageBreaks.forEach(hr => {
          const hrEl = hr as HTMLElement;
          hrEl.style.setProperty('page-break-before', 'always', 'important');
          hrEl.style.setProperty('break-before', 'page', 'important');
          hrEl.style.setProperty('visibility', 'hidden', 'important');
          hrEl.style.setProperty('margin', '0', 'important');
          hrEl.style.setProperty('padding', '0', 'important');
          hrEl.style.setProperty('border', 'none', 'important');
          hrEl.style.setProperty('height', '0', 'important');
        });

        // Ensure problem containers don't break across pages
        const problemContainers = clonedDoc.querySelectorAll('[data-problem-container="true"]');
        problemContainers.forEach(div => {
          const divEl = div as HTMLElement;
          divEl.style.setProperty('page-break-inside', 'avoid', 'important');
          divEl.style.setProperty('break-inside', 'avoid', 'important');
          divEl.style.setProperty('display', 'block', 'important');
          divEl.style.setProperty('overflow', 'visible', 'important');
        });
        
        // Also target any div containing problem numbers
        const allDivs = clonedDoc.querySelectorAll('div');
        allDivs.forEach(div => {
          const divEl = div as HTMLElement;
          const text = divEl.textContent || '';
          // Look for problem patterns like "問1" "問2" etc.
          if (/問\d+\./.test(text) || divEl.style.marginBottom === '25px') {
            divEl.style.setProperty('page-break-inside', 'avoid', 'important');
            divEl.style.setProperty('break-inside', 'avoid', 'important');
            divEl.style.setProperty('display', 'block', 'important');
            
            // Also apply to parent if it exists
            const parent = divEl.parentElement;
            if (parent && parent.tagName === 'DIV') {
              parent.style.setProperty('page-break-inside', 'avoid', 'important');
              parent.style.setProperty('break-inside', 'avoid', 'important');
            }
          }
        });
        
        // Apply refined fraction line styles
        const fracLines = clonedDoc.querySelectorAll('.katex .mfrac .frac-line');
        fracLines.forEach(line => {
          const lineEl = line as HTMLElement;
          lineEl.style.setProperty('border-bottom', '1.5px solid #000', 'important');
          lineEl.style.setProperty('height', '1.5px', 'important');
          lineEl.style.setProperty('margin', '6px 0', 'important');
          lineEl.style.setProperty('position', 'relative', 'important');
          lineEl.style.setProperty('top', '8px', 'important');
        });
        
        // Add refined spacing: numerator bottom, denominator top
        const fracParts = clonedDoc.querySelectorAll('.katex .mfrac > span > span');
        fracParts.forEach((part, index) => {
          const partEl = part as HTMLElement;
          if (index === 0) {
            // First child (numerator) - only bottom padding
            partEl.style.setProperty('padding-bottom', '10px', 'important');
          } else if (index === 1) {
            // Second child (denominator) - only top padding
            partEl.style.setProperty('padding-top', '10px', 'important');
          }
        });
        
        // Try broader selectors with same refined logic
        const allMfracContainers = clonedDoc.querySelectorAll('.mfrac, [class*="mfrac"]');
        allMfracContainers.forEach(container => {
          const spans = container.querySelectorAll('span > span');
          spans.forEach((span, index) => {
            const spanEl = span as HTMLElement;
            if (index === 0) {
              spanEl.style.setProperty('padding-bottom', '10px', 'important');
            } else if (index === 1) {
              spanEl.style.setProperty('padding-top', '10px', 'important');
            }
          });
        });
        
        // Also try targeting by more specific selectors
        const allFracLines = clonedDoc.querySelectorAll('.frac-line, [class*="frac-line"]');
        allFracLines.forEach(line => {
          const lineEl = line as HTMLElement;
          lineEl.style.margin = '3px 0';
          lineEl.style.position = 'relative';
          lineEl.style.top = '8px';
        });
        
        // Try to find any element that looks like a fraction line
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach(el => {
          const element = el as HTMLElement;
          const style = window.getComputedStyle ? window.getComputedStyle(element) : element.style;
          // Look for elements that have border-bottom (likely fraction lines)
          if (element.style.borderBottom || element.style.borderBottomWidth || 
              element.className.includes('frac') || element.className.includes('line')) {
            element.style.marginTop = '8px';
            element.style.position = 'relative';
            element.style.top = '8px';
          }
        });
      }
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