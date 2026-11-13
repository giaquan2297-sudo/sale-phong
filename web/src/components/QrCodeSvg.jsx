import { useMemo } from 'react';
import { generateQrMatrix } from '../utils/qrCode';

export default function QrCodeSvg({ text, size = 180, className = '' }) {
  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(text);
    } catch {
      return null;
    }
  }, [text]);

  if (!matrix) return null;

  const moduleCount = matrix.length;
  const padding = 2; // quiet zone in modules
  const totalSize = moduleCount + padding * 2;

  // Build path string for all dark modules for maximum performance & crispness
  let path = '';
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (matrix[r][c] === 1) {
        path += `M${c + padding},${r + padding}h1v1h-1z `;
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${totalSize} ${totalSize}`}
      width={size}
      height={size}
      className={`bg-white rounded-lg shadow-sm border border-slate-200 ${className}`}
      shapeRendering="crispEdges"
    >
      <rect width={totalSize} height={totalSize} fill="#FFFFFF" />
      <path d={path} fill="#0F172A" />
    </svg>
  );
}
