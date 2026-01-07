
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AspectRatio, Resolution, GeneratedImage, AppConfig } from './types';
import { loadConfig } from './services/configService';
import MindMap from './components/MindMap';
import { getGallery, GalleryItem, GalleryPage, subscribeTask } from './services/api';
import { logger } from './utils/logger';

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const [res, setRes] = useState<Resolution>("1k");
  const [showInspiration, setShowInspiration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [galleryPage, setGalleryPage] = useState<GalleryPage | null>(null);

  // Split screen state
  const [leftWidth, setLeftWidth] = useState(40);
  const [isDragging, setIsDragging] = useState(false);

  const ITEMS_PER_PAGE = 20;

  const fetchGallery = async (page: number = 1) => {
    logger.info(`Fetching gallery page ${page}`);
    try {
      const res = await getGallery(page, ITEMS_PER_PAGE);
      logger.info('Gallery fetched', res);
      if (res && res.items) {
        setGalleryPage(res);
        const mapped: GeneratedImage[] = res.items.map(item => ({
          id: item.id,
          url: item.thumbUrl, // Use thumb for gallery
          fullUrl: item.url, // Store full url
          timestamp: new Date(item.createTime).getTime(),
          prompt: item.prompt,
          config: {
            ratio: "16:9", // Default or parsed from backend
            resolution: "1k" // Default or parsed from backend
          }
        }));
        setImages(mapped);
      }
    } catch (e) {
      logger.error('Failed to fetch gallery', e);
    }
  };

  useEffect(() => {
    const initConfig = async () => {
      const cfg = await loadConfig();
      setConfig(cfg);
      if (cfg.ui.aspectRatios && cfg.ui.aspectRatios.length > 0) {
        setRatio(cfg.ui.aspectRatios[0]);
      }
      if (cfg.ui.resolutions && cfg.ui.resolutions.length > 0) {
        setRes(cfg.ui.resolutions[0]);
      }
      if (cfg?.ui?.background?.url) {
        document.body.style.backgroundImage = `url(${cfg.ui.background.url})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
      }
    };
    initConfig();
  }, []);

  // Fetch gallery when config is loaded or page changes
  useEffect(() => {
    if (config) {
      fetchGallery(currentPage);
    }
  }, [config, currentPage]);

  // Handle refresh events
  useEffect(() => {
    const handleRefresh = () => {
      if (currentPage === 1) {
        if (config) fetchGallery(1);
      } else {
        setCurrentPage(1);
      }
    };
    window.addEventListener('refreshGallery', handleRefresh);
    return () => window.removeEventListener('refreshGallery', handleRefresh);
  }, [currentPage, config]);

  const handleGenerate = async (selectedLabels: string[]) => {
    if (loading) return;
    setLoading(true);
    setLoading(false);
  };

  const handleMindMapComplete = (selectedLabels: string[]) => {
    setShowInspiration(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newWidth = (e.clientX / window.innerWidth) * 100;
      // Limit width between 20% and 80%
      if (newWidth >= 20 && newWidth <= 80) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging]);

  const totalPages = galleryPage?.totalPages || 1;
  const paginatedImages = images; // Images are already paginated from backend

  if (!config) return null;

  const isGalleryView = !showInspiration && !selectedImage && !loading;
  const mainOpacityPct = Math.min(100, Math.max(0, isGalleryView ? 0 : (config.ui.mainOpacity ?? 5)));
  const blurPx = Math.min(100, Math.max(0, isGalleryView ? 0 : (config.ui.blurIntensity ?? 10)));

  return (
    <div 
      className="flex h-screen w-screen overflow-hidden text-[#1d1d1f]"
      style={{ 
        backgroundImage: config.ui.background.url ? `url(${config.ui.background.url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      
      {/* 左侧控制区 */}
      <aside 
        style={{ width: `${leftWidth}%` }}
        className="h-full flex flex-col p-8 glass-panel relative z-10 bg-white/60 flex-shrink-0"
      >
        <header className="flex-shrink-0">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-7xl font-extralight tracking-tighter"
          >
            {config.ui.logo.text}<span className={`font-semibold ${config.ui.logo.color}`}>{config.ui.logo.highlight}</span>
          </motion.h1>
          <div className="h-px w-20 bg-blue-600/30 mt-6" />
          <p className="text-black/30 mt-6 text-[0.625rem] font-bold uppercase tracking-[0.5em] leading-relaxed">
            {config.ui.header.subtitle}<br/>{config.ui.header.subtitleEn}
          </p>
        </header>

        <div className="flex-1 flex flex-col justify-center gap-8 min-h-0 py-8">
          {/* 灵感按键 */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-shrink-0">
            <button 
              onClick={() => setShowInspiration(true)}
              className="w-full py-12 px-10 bg-white rounded-[3.5rem] border border-black/5 hover:border-blue-500/40 transition-all group flex flex-col items-center gap-6 shadow-2xl shadow-gray-200/50"
            >
              <div className="w-20 h-20 rounded-full bg-blue-600/5 flex items-center justify-center group-hover:bg-blue-600/10 transition-all">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="text-center">
                <span className="text-2xl font-light tracking-[0.2em] block">灵感触发</span>
                <span className="text-[0.625rem] text-black/20 font-black mt-3 uppercase tracking-widest">Constructing Visual Galaxy</span>
              </div>
            </button>
          </motion.div>

          {/* 参数设置区 */}
          <div className="flex-shrink-0 flex flex-col gap-6">
            <div className="space-y-4">
              <label className="text-[0.625rem] font-black text-black/30 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-500/30" />
                图像比例 / Aspect Ratio
              </label>
              <div className="grid grid-cols-4 gap-3 bg-black/5 p-1.5 rounded-[1.5rem] border border-black/5">
                {(config.ui.aspectRatios ?? (["16:9", "4:3", "2.35:1", "1:1"] as AspectRatio[])).map(r => (
                  <button
                    key={r}
                    onClick={() => setRatio(r)}
                    className={`py-4 rounded-[1.2rem] text-xs font-bold transition-all ${ratio === r ? 'bg-white text-blue-600 shadow-xl' : 'text-black/30 hover:text-black/50'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution selector hidden as per request
            <div className="space-y-4">
              <label className="text-[0.625rem] font-black text-black/30 uppercase tracking-[0.4em] flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-blue-500/30" />
                分辨率 / Resolution
              </label>
              <div className="flex gap-3">
                {(config.ui.resolutions ?? (["480p", "720p", "1k", "2k"] as Resolution[])).map(r => (
                  <button
                    key={r}
                    onClick={() => setRes(r)}
                    className={`flex-1 py-5 rounded-[1.5rem] text-[0.625rem] font-black border transition-all ${res === r ? 'bg-blue-600/5 border-blue-500/20 text-blue-600 shadow-md' : 'bg-black/5 border-transparent text-black/20 hover:bg-black/10'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            */}
          </div>
        </div>

        <footer className="mt-auto flex-shrink-0 flex flex-col items-center opacity-10">
          <span className="text-[0.5625rem] font-black uppercase tracking-[0.8em]">{config.ui.footer.text}</span>
          <div className="w-2 h-2 rounded-full bg-black mt-4" />
        </footer>
      </aside>

      {/* 分隔线 (Drag Handle) */}
      <div 
        className="w-[0.125rem] h-full bg-black/5 cursor-col-resize hover:w-[0.25rem] hover:bg-blue-600/30 transition-all z-50 flex-shrink-0"
        onMouseDown={handleMouseDown}
      />

      {/* 右侧展示区 */}
      <main 
        className="flex-1 h-full flex flex-col overflow-hidden relative"
        style={{
          backdropFilter: `blur(${blurPx}px)`,
          backgroundColor: `rgba(255,255,255, ${mainOpacityPct / 100})`
        }}
      >
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-3xl"
            >
              <div className="w-20 h-20 border-[3px] border-blue-600/10 border-t-blue-600 rounded-full animate-spin" />
              <p className="mt-10 text-[10px] font-black tracking-[0.6em] text-blue-600/60 uppercase">冲洗画面中 / Rendering Frame</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 p-16 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-end mb-20">
            <div className="space-y-4">
              <h2 className="text-5xl font-extralight tracking-tighter">作品库</h2>
              <div className="flex items-center gap-3">
                <div className="w-8 h-[2px] bg-blue-600/20" />
                <p className="text-black/20 text-[10px] uppercase tracking-[0.3em] font-bold">Chronological Composition Gallery</p>
              </div>
            </div>
          </div>

          {images.length === 0 ? (
            <div className="h-[60vh] flex flex-col items-center justify-center opacity-[0.03]">
              <svg className="w-48 h-48 mb-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.3} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xl tracking-[1em] uppercase font-black">库内暂无画面</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <AnimatePresence mode="popLayout">
                {paginatedImages.map((img) => (
                  <motion.div
                    key={img.id}
                    layout
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    onClick={() => setSelectedImage(img)}
                    className="group relative rounded-[3.5rem] overflow-hidden bg-white shadow-[0_30px_80px_rgba(0,0,0,0.06)] transition-all border border-black/[0.03] hover:shadow-[0_40px_100px_rgba(0,113,227,0.1)] cursor-zoom-in"
                  >
                    <div className="relative aspect-video overflow-hidden">
                      <img 
                        src={img.url} 
                        alt="Generated frame"
                        className="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 p-12 flex flex-col justify-end">
                        <div className="flex justify-between items-center border-t border-white/10 pt-8">
                          <span className="text-[0.625rem] text-white/40 font-black uppercase tracking-widest">{new Date(img.timestamp).toLocaleTimeString()}</span>
                          <span className="px-5 py-2 bg-white/10 backdrop-blur-md rounded-full text-[0.625rem] text-white font-black">{img.config.ratio}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* 分页按钮 */}
          {totalPages > 1 && (
            <div className="mt-24 flex justify-center items-center gap-12 pb-20">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-6 bg-white shadow-xl rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all border border-black/5"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="text-[11px] font-black text-black/20 uppercase tracking-[0.8em]">
                P. {currentPage} <span className="text-black/5 mx-6">/</span> {totalPages}
              </div>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-6 bg-white shadow-xl rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all border border-black/5"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 灵感思维导图 */}
      <AnimatePresence>
        {showInspiration && (
          <MindMap 
            onSelectionComplete={handleMindMapComplete} 
            onClose={() => setShowInspiration(false)} 
            ratio={ratio}
            resolutionKey={res}
          />
        )}
      </AnimatePresence>

      {/* 全屏大图查看 */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-0 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full h-full overflow-hidden flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={selectedImage.fullUrl || selectedImage.url} 
                alt="Full screen" 
                className="object-contain w-full h-full max-w-none max-h-none shadow-2xl" 
              />
              
              <div className="absolute top-8 right-8 z-10">
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
                </button>
              </div>
              
              {/* Logo Overlay */}
              {config.ui.logo.iconUrl && (
                <div className="absolute bottom-8 right-8 z-10 pointer-events-none opacity-80 mix-blend-screen">
                   <img 
                     src={config.ui.logo.iconUrl} 
                     alt="Logo" 
                     className="h-20 w-auto filter drop-shadow-lg"
                     onError={(e) => {
                       // Fallback text if logo fails
                       const target = e.target as HTMLElement;
                       target.style.display = 'none';
                       const parent = target.parentElement;
                       if (parent) {
                         const span = document.createElement('span');
                         span.className = "text-white/50 font-black text-2xl uppercase tracking-[0.5em]";
                         span.innerText = "CINEMIND";
                         parent.appendChild(span);
                       }
                     }}
                   />
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
