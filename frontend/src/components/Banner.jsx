import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, X, ImageIcon } from 'lucide-react';

const BANNER_KEY = 'pp_banner_image';

const Banner = ({ shopName = 'My Print Shop', tagline, greeting }) => {
  const navigate = useNavigate();
  const fileRef  = useRef(null);

  const [image, setImage] = useState(() => localStorage.getItem(BANNER_KEY) || null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target.result;
      localStorage.setItem(BANNER_KEY, b64);
      setImage(b64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => {
    localStorage.removeItem(BANNER_KEY);
    setImage(null);
  };

  return (
    <div className="relative overflow-hidden rounded-3xl min-h-[172px] group">

      {/* Background layer */}
      {image ? (
        <img
          src={image}
          alt="Banner"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700" />
          {/* No-image indicator (subtle) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="flex items-center gap-2 text-white/30 text-sm font-medium">
              <ImageIcon size={18} />
              Click "Upload Banner" to add an image
            </div>
          </div>
        </>
      )}

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />

      {/* Dot-grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize:  '24px 24px',
        }}
      />

      {/* Content */}
      <div className="relative px-7 py-7 flex items-center justify-between gap-6">

        {/* Left — greeting + shop name */}
        <div>
          {greeting && (
            <p className="text-white/55 text-sm font-medium tracking-wide">{greeting}</p>
          )}
          <h1 className="text-white text-3xl font-black mt-1 leading-tight tracking-tight drop-shadow-sm">
            {shopName}
          </h1>
          {tagline && (
            <p className="text-white/55 text-sm mt-1.5 max-w-xs leading-snug">{tagline}</p>
          )}
        </div>

        {/* Right — CTA + upload controls */}
        <div className="flex flex-col items-end gap-2.5 shrink-0">

          {/* Primary CTA */}
          <button
            onClick={() => navigate('/bills/new')}
            className="flex items-center gap-2 bg-white text-slate-900 font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-brand-50 hover:text-brand-700 active:scale-[0.97] transition-all duration-150 shadow-lg shadow-black/25 cursor-pointer"
          >
            <Plus size={15} />
            Create Order
          </button>

          {/* Upload banner */}
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-white/45 hover:text-white text-xs font-semibold transition-colors duration-150 cursor-pointer px-2 py-1 rounded-lg hover:bg-white/10"
          >
            <Upload size={12} />
            {image ? 'Change Banner' : 'Upload Banner'}
          </button>

          {/* Remove banner (only when image exists) */}
          {image && (
            <button
              onClick={removeImage}
              className="flex items-center gap-1.5 text-white/25 hover:text-red-300 text-xs font-medium transition-colors duration-150 cursor-pointer px-2 py-1 rounded-lg hover:bg-white/10"
            >
              <X size={11} />
              Remove Image
            </button>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
};

export default Banner;
