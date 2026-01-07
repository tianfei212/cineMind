
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
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);

  // Split screen state
  const [leftWidth, setLeftWidth] = useState(20);
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
          params: item.params,
          config: {
            ratio: "16:9", // Default or parsed from backend
            resolution: "1k" // Default or parsed from backend
          }
        }));
        setImages(mapped);
        // Set first image as preview if available and no preview set
        if (mapped.length > 0 && (!previewImage || page === 1)) {
           setPreviewImage(mapped[0]);
        }
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

        {images.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center opacity-[0.03]">
              <svg className="w-48 h-48 mb-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.3} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xl tracking-[1em] uppercase font-black">库内暂无画面</p>
           </div>
        ) : (
           <>
              {/* 上半部分：预览区 (60%) */}
              <div className="h-[60%] p-16 flex flex-col relative border-b border-black/5">
                 <div className="flex justify-between items-start mb-8 flex-shrink-0">
                    <div className="space-y-4">
                      <h2 className="text-5xl font-extralight tracking-tighter">作品库</h2>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-[2px] bg-blue-600/20" />
                        <p className="text-black/20 text-[10px] uppercase tracking-[0.3em] font-bold">Chronological Composition Gallery</p>
                      </div>
                    </div>
                 </div>

                 <div className="flex-1 relative rounded-[2rem] overflow-hidden bg-black shadow-2xl flex border border-white/5">
                    {previewImage ? (
                       <>
                          {/* Left: Info Panel (40%) */}
                          <div className="w-[40%] flex-shrink-0 h-full bg-[#0a0a0a] p-8 flex flex-col relative overflow-y-auto custom-scrollbar border-r border-white/5">
                              {previewImage.params ? (
                                <div className="grid grid-cols-2 gap-x-8 gap-y-8 content-start flex-1">
                                  {[
                                    "影片类型", "环境背景", "主角类型", "角色个体", 
                                    "精彩瞬间", "关键元素", "镜头语言", "年代", "图像比例"
                                  ].map(key => previewImage.params[key] ? (
                                    <div key={key} className="flex flex-col gap-2">
                                      <span className="text-sm font-bold text-white/40 uppercase tracking-[0.2em] whitespace-nowrap">{key}:</span>
                                      <span className="text-[#FFD700] text-sm font-black tracking-wide leading-relaxed break-words">{previewImage.params[key]}</span>
                                    </div>
                                  ) : null)}
                                </div>
                              ) : (
                                <div className="text-white/20 text-xs font-bold tracking-widest uppercase flex-1">No Info</div>
                              )}
                              
                              <div className="mt-8 pt-8 border-t border-white/5 flex-shrink-0">
                                <div className="flex flex-col gap-2 text-white">
                                   <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{previewImage.config.ratio}</span>
                                   <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{new Date(previewImage.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </div>
                          </div>

                          {/* Right: Image */}
                          <div 
                              className="flex-1 h-full bg-black flex items-center justify-center relative cursor-zoom-in overflow-hidden"
                              onClick={() => setSelectedImage(previewImage)}
                          >
                             <motion.img 
                                key={previewImage.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5 }}
                                src={previewImage.fullUrl || previewImage.url} 
                                alt="Preview" 
                                className="w-full h-full object-cover"
                             />
                          </div>
                       </>
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-white/20 text-sm tracking-widest uppercase font-bold">Select an image</div>
                    )}
                 </div>
              </div>

              {/* 下半部分：列表区 (40%) */}
              <div className="h-[40%] bg-black/[0.02] p-8 overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-4 gap-6">
                    <AnimatePresence mode="popLayout">
                       {paginatedImages.map((img) => (
                          <motion.div
                             key={img.id}
                             layout
                             initial={{ scale: 0.9, opacity: 0 }}
                             animate={{ scale: 1, opacity: 1 }}
                             whileHover={{ scale: 1.05, y: -5 }}
                             onClick={() => setPreviewImage(img)}
                             className={`aspect-video rounded-xl overflow-hidden cursor-pointer shadow-sm transition-all border-2 ${previewImage?.id === img.id ? 'border-blue-500 shadow-blue-500/20' : 'border-transparent hover:border-black/10'}`}
                          >
                             <img src={img.url} alt="Thumbnail" className="w-full h-full object-cover" />
                          </motion.div>
                       ))}
                    </AnimatePresence>
                 </div>
                 
                 {/* 分页按钮 */}
                 {totalPages > 1 && (
                    <div className="mt-12 flex justify-center items-center gap-8 pb-8">
                       <button 
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(p => p - 1)}
                          className="p-3 bg-white shadow-lg rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all border border-black/5"
                       >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
                       </button>
                       <div className="text-[10px] font-black text-black/20 uppercase tracking-[0.5em]">
                          {currentPage} / {totalPages}
                       </div>
                       <button 
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(p => p + 1)}
                          className="p-3 bg-white shadow-lg rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all border border-black/5"
                       >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
                       </button>
                    </div>
                 )}
              </div>
           </>
        )}
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
              className="relative w-full h-full overflow-hidden flex items-center justify-center cursor-zoom-out"
              onClick={() => setSelectedImage(null)}
            >
              <img 
                src={selectedImage.fullUrl || selectedImage.url} 
                alt="Full screen" 
                className="object-contain w-full h-full max-w-none max-h-none shadow-2xl" 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImage(null);
                }}
              />
              
              <div className="absolute top-8 right-8 z-10">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                  }}
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
