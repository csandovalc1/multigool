// src/components/UploadLogoField.jsx
import { useRef, useState } from 'react';

export default function UploadLogoField({
  onBlobReady,
  recommended = '512×512',
  maxSizeMB = 1.5,
  minSize = 128, // dimensiones mínimas aceptadas
}) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  const openPicker = () => {
    if (inputRef.current) inputRef.current.click();
  };

  const clear = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    onBlobReady?.(null);
  };

  const onSelect = async (e) => {
    setError('');
    const f = e.target.files?.[0];
    if (!f) return;

    // Validaciones
    if (f.type !== 'image/png') {
      setError('Solo se acepta formato PNG.');
      e.target.value = '';
      return;
    }
    if (f.size > maxSizeMB * 1024 * 1024) {
      setError(`Tamaño máximo ${maxSizeMB} MB.`);
      e.target.value = '';
      return;
    }

    // Cargar para validar dimensiones mínimas
    const tmpUrl = URL.createObjectURL(f);
    try {
      const dims = await getImageSize(tmpUrl);
      if (dims.width < minSize || dims.height < minSize) {
        setError(`Dimensiones mínimas ${minSize}×${minSize} px.`);
        URL.revokeObjectURL(tmpUrl);
        e.target.value = '';
        return;
      }
    } catch {
      setError('No se pudo leer la imagen.');
      URL.revokeObjectURL(tmpUrl);
      e.target.value = '';
      return;
    }

    // Todo ok → guardamos y previsualizamos
    setFile(f);
    setPreviewUrl(tmpUrl);
    onBlobReady?.(f); // sin crop; el backend normaliza/recorta
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium select-none">
        Escudo (PNG){' '}
        <span className="text-neutral-500">• recomendado {recommended}</span>
      </label>

      {/* Input real, oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={onSelect}
      />

      {/* Área clickeable */}
      {!file ? (
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
          className="rounded border p-4 grid place-items-center text-center text-sm text-neutral-600
                     hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition"
          title="Subir logo"
        >
          <div className="h-14 w-14 rounded-full bg-neutral-100 grid place-items-center text-neutral-400 mb-2">
            📁
          </div>
          <div className="font-medium">Haz clic para subir el logo</div>
          <div className="text-xs text-neutral-500 mt-1">
            Formato: PNG · Máx {maxSizeMB} MB · Mín {minSize}×{minSize} px
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded border p-3 bg-white">
          <img
            src={previewUrl}
            alt="preview escudo"
            className="h-12 w-12 rounded-full object-cover"
            loading="lazy"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{file.name}</div>
            <div className="text-xs text-neutral-500">
              {(file.size / (1024 * 1024)).toFixed(2)} MB · PNG
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              className="px-3 py-1 rounded border text-sm hover:bg-slate-100 cursor-pointer"
              title="Cambiar archivo"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={clear}
              className="px-3 py-1 rounded bg-rose-600 text-white text-sm hover:bg-rose-700 cursor-pointer"
              title="Quitar archivo"
            >
              Quitar
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-sm text-rose-600">{error}</div>}
    </div>
  );
}

// util: obtiene dimensiones de la imagen
function getImageSize(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}
