export const initFlexible = () => {
  const docEl = document.documentElement;
  
  // Base design width (e.g., 1920px)
  // At 1920px, 1rem = 16px (Tailwind default)
  // Formula: 1920 / X = 16  => X = 120
  const designWidth = 1920;
  const baseFontSize = 16;
  
  const setRemUnit = () => {
    const clientWidth = docEl.clientWidth;
    if (!clientWidth) return;
    
    // Calculate new font size
    // We scale linearly. 
    // Example: at 960px, font-size will be 8px.
    const rem = (clientWidth / designWidth) * baseFontSize;
    
    docEl.style.fontSize = rem + 'px';
  };

  setRemUnit();

  // Reset on resize
  window.addEventListener('resize', setRemUnit);
  
  // Reset on pageshow (handling back/forward cache)
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      setRemUnit();
    }
  });
};
