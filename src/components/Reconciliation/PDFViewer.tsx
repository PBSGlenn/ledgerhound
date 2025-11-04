import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFViewerProps {
  file: File;
  className?: string;
}

export function PDFViewer({ file, className = '' }: PDFViewerProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [numPages, setNumPages] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true);
        setError(null);

        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        setNumPages(pdf.numPages);

        // Render all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const canvas = canvasRefs.current[pageNum - 1];

          if (!canvas) continue;

          const context = canvas.getContext('2d');
          if (!context) continue;

          // Set scale for better quality
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          // Set canvas dimensions
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          // Render page
          await page.render({
            canvasContext: context,
            viewport,
          }).promise;
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      }
    };

    loadPDF();
  }, [file]);

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="text-center">
          <p className="text-red-700 font-medium">Failed to load PDF</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-100 rounded-lg overflow-auto ${className}`}>
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-600">Loading PDF...</div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {Array.from({ length: numPages }, (_, i) => (
          <div key={i} className="bg-white shadow-lg mx-auto" style={{ width: 'fit-content' }}>
            <canvas
              ref={(el) => {
                canvasRefs.current[i] = el;
              }}
              className="block"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
