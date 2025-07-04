'use client';

import { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathRendererProps {
  children: string;
  displayMode?: boolean;
  className?: string;
}

/**
 * Component to render mathematical expressions using KaTeX
 */
export function MathRenderer({ children, displayMode = false, className = '' }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      // Clear previous content
      containerRef.current.innerHTML = '';

      // Parse and render math expressions
      let processedText = children;

      // Handle display math ($$...$$)
      processedText = processedText.replace(/\$\$([^$]+)\$\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: true,
            throwOnError: false,
            trust: false
          });
        } catch {
          return `$$${math}$$`; // Fallback to original
        }
      });

      // Handle inline math ($...$)
      processedText = processedText.replace(/\$([^$]+)\$/g, (_, math) => {
        try {
          return katex.renderToString(math.trim(), {
            displayMode: false,
            throwOnError: false,
            trust: false
          });
        } catch {
          return `$${math}$`; // Fallback to original
        }
      });

      // If the entire content should be rendered as math
      if (displayMode && !children.includes('$')) {
        try {
          processedText = katex.renderToString(children, {
            displayMode: true,
            throwOnError: false,
            trust: false
          });
        } catch {
          processedText = children; // Fallback to original
        }
      }

      containerRef.current.innerHTML = processedText;
    } catch (error) {
      console.warn('Math rendering failed:', error);
      // Fallback to plain text
      if (containerRef.current) {
        containerRef.current.textContent = children;
      }
    }
  }, [children, displayMode]);

  return (
    <div 
      ref={containerRef}
      className={`math-renderer ${className}`}
      style={{ 
        lineHeight: displayMode ? '1.8' : '1.4',
        textAlign: displayMode ? 'center' : 'left'
      }}
    />
  );
}

/**
 * Component specifically for inline math expressions
 */
export function InlineMath({ children, className = '' }: { children: string; className?: string }) {
  return <MathRenderer displayMode={false} className={className}>{children}</MathRenderer>;
}

/**
 * Component specifically for display math expressions
 */
export function DisplayMath({ children, className = '' }: { children: string; className?: string }) {
  return <MathRenderer displayMode={true} className={className}>{children}</MathRenderer>;
}

/**
 * Utility function to check if text contains math expressions
 */
export function containsMath(text: string): boolean {
  return /\$[^$]+\$/.test(text) || /\$\$[^$]+\$\$/.test(text);
}

/**
 * Higher-order component to wrap text content with math rendering
 */
export function withMathRendering<T extends { children: React.ReactNode; className?: string }>(
  Component: React.ComponentType<T>
) {
  return function MathEnabledComponent({ children, ...props }: T) {
    if (typeof children === 'string' && containsMath(children)) {
      return (
        <Component {...props as T}>
          <MathRenderer>{children}</MathRenderer>
        </Component>
      );
    }
    
    return <Component {...props as T}>{children}</Component>;
  };
}