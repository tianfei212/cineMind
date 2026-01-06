
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CINEMATIC_TREE } from '../constants/cinematicData';
import { CATEGORIES } from '../services/geminiService';
import { MindNode, CinematicNode } from '../types';
import { getConfig } from '../services/configService';

interface MindMapProps {
  onSelectionComplete: (selectedLabels: string[]) => void;
  onClose: () => void;
}

const DESIGN_WIDTH = 1920;

const MindMap: React.FC<MindMapProps> = ({ onSelectionComplete, onClose }) => {
  const [nodes, setNodes] = useState<MindNode[]>([]);
  const [connections, setConnections] = useState<{from: string, to: string}[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  
  // Ref to track if we are currently dragging
  const isDraggingRef = React.useRef(false);
  // Ref for long press timer
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // 初始化显示第一层：环境背景
  useEffect(() => {
    const updateScale = () => {
        const currentScale = window.innerWidth / DESIGN_WIDTH;
        setScale(currentScale);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    
    const rootX = window.innerWidth / 2;
    const rootY = window.innerHeight / 2;
    const currentScale = window.innerWidth / DESIGN_WIDTH;
    
    if (CINEMATIC_TREE.children) {
      const initialNodes: MindNode[] = CINEMATIC_TREE.children.map((child, i) => {
        const count = CINEMATIC_TREE.children!.length;
        const angle = (i / count) * Math.PI * 2;
        const radius = 280 * currentScale;
        return {
          id: `node-0-${i}`,
          label: child.label,
          x: rootX + Math.cos(angle) * radius,
          y: rootY + Math.sin(angle) * radius,
          isSelected: false,
          level: 0
        };
      });
      setNodes(initialNodes);
    }
    
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const getDescendantIds = (parentId: string, allNodes: MindNode[]): string[] => {
    const children = allNodes.filter(n => n.parentId === parentId);
    let ids = children.map(c => c.id);
    children.forEach(c => {
      ids = [...ids, ...getDescendantIds(c.id, allNodes)];
    });
    return ids;
  };

  const isNodeInFocusPath = (nodeId: string, focusedId: string | null, allNodes: MindNode[]): boolean => {
    if (!focusedId) return true;
    if (nodeId === focusedId) return true;
    const descendants = getDescendantIds(focusedId, allNodes);
    if (descendants.includes(nodeId)) return true;
    let current = allNodes.find(n => n.id === focusedId);
    while (current && current.parentId) {
      if (current.parentId === nodeId) return true;
      current = allNodes.find(n => n.id === current?.parentId);
    }
    return false;
  };

  const findDataNode = (path: string[], tree: CinematicNode): CinematicNode | null => {
    if (path.length === 0) return tree;
    const [currentLabel, ...rest] = path;
    const found = tree.children?.find(c => c.label === currentLabel);
    if (found) return findDataNode(rest, found);
    return null;
  };

  const handleNodeLeftClick = (node: MindNode) => {
    // If we just finished dragging, ignore the click
    if (isDraggingRef.current) return;

    if (focusedNodeId === node.id) {
      setFocusedNodeId(null);
      return;
    }
    setFocusedNodeId(node.id);

    const hasChildren = nodes.some(n => n.parentId === node.id);
    if (hasChildren) return;

    const getPath = (n: MindNode, acc: string[] = []): string[] => {
      const newAcc = [n.label, ...acc];
      if (!n.parentId) return newAcc;
      const parent = nodes.find(p => p.id === n.parentId);
      return parent ? getPath(parent, newAcc) : newAcc;
    };

    const path = getPath(node);
    const dataNode = findDataNode(path, CINEMATIC_TREE);

    if (dataNode && dataNode.children) {
      const nextLevel = node.level + 1;
      const count = dataNode.children.length;
      const subNodes: MindNode[] = dataNode.children.map((child, i) => {
        // 使用更动态的排布：在父节点周围做圆周排布，偏移角度避开父节点来源方向
        const baseAngle = Math.atan2(node.y - window.innerHeight / 2, node.x - window.innerWidth / 2);
        const spread = Math.PI * 1.2; // 展开角度
        const startAngle = baseAngle - spread / 2;
        const angle = startAngle + (i / (count - 1 || 1)) * spread;
        const radius = 260 * scale;
        
        return {
          id: `node-${nextLevel}-${Math.random().toString(36).substr(2, 5)}`,
          label: child.label,
          parentId: node.id,
          x: node.x + Math.cos(angle) * radius,
          y: node.y + Math.sin(angle) * radius,
          isSelected: false,
          level: nextLevel
        };
      });

      setNodes(prev => [...prev, ...subNodes]);
      setConnections(prev => [...prev, ...subNodes.map(s => ({ from: node.id, to: s.id }))]);
    }
  };

  const toggleSelect = (node: MindNode) => {
    setNodes(prev => prev.map(n => {
      if (n.level === node.level) {
        if (n.id === node.id) return { ...n, isSelected: !n.isSelected };
        return { ...n, isSelected: false }; 
      }
      return n;
    }));
  };

  const handleDrag = (id: string, info: any) => {
    // If we start moving, cancel the long press timer
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }
    
    const descendantIds = getDescendantIds(id, nodes);
    setNodes(prev => prev.map(n => {
      if (n.id === id || descendantIds.includes(n.id)) {
        return { ...n, x: n.x + info.delta.x, y: n.y + info.delta.y };
      }
      return n;
    }));
  };

  const selectedLabels = nodes.filter(n => n.isSelected).map(n => n.label);
  const stashX = window.innerWidth - 80;
  const stashY = window.innerHeight - 80;

  return (
    <motion.div 
      ref={canvasRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundImage: `url(${getConfig().ui.background.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backdropFilter: `blur(${getConfig().ui.blurIntensity ?? 10}px)`
      }}
      onClick={() => setFocusedNodeId(null)}
    >
      {/* 侧边栏 */}
      <motion.div 
        drag
        dragMomentum={false}
        dragConstraints={canvasRef}
        className="absolute top-10 left-10 w-80 glass-panel bg-[#121212] p-0 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 z-30 flex flex-col max-h-[85vh] cursor-move"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[#FFD700] text-lg">✨</span>
            <span className="text-white font-bold tracking-tight">构思指引</span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2}/></svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="flex flex-col gap-4">
            {CATEGORIES.map((cat, i) => {
              const selectedAtThisLevel = nodes.find(n => n.level === i && n.isSelected);
              return (
                <div key={cat} className="space-y-2">
                  <span className="text-[0.5625rem] font-black text-white/20 uppercase tracking-[0.3em]">{cat}</span>
                  {selectedAtThisLevel ? (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-[#FFD700] text-black px-4 py-2 rounded-xl text-[0.6875rem] font-black flex justify-between items-center"
                    >
                      {selectedAtThisLevel.label}
                      <button onClick={() => toggleSelect(selectedAtThisLevel)} className="opacity-40">×</button>
                    </motion.div>
                  ) : (
                    <div className="h-10 rounded-xl border border-white/5 flex items-center px-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-white/5">
          <button 
            onClick={() => onSelectionComplete(selectedLabels)}
            disabled={selectedLabels.length === 0}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold tracking-widest transition-all shadow-xl shadow-blue-600/20 disabled:opacity-30 disabled:grayscale"
          >
            渲染创意方案
          </button>
        </div>
      </motion.div>

      {/* 画布 */}
      <div className="w-full h-full relative overflow-hidden select-none">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {connections.map((conn) => {
            const from = nodes.find(n => n.id === conn.from);
            const to = nodes.find(n => n.id === conn.to);
            if (!from || !to) return null;
            const fromInFocus = isNodeInFocusPath(from.id, focusedNodeId, nodes);
            const toInFocus = isNodeInFocusPath(to.id, focusedNodeId, nodes);
            const lineOpacity = (focusedNodeId && (!fromInFocus || !toInFocus)) ? 0 : 0.6;

            return (
              <motion.line 
                key={`line-${conn.from}-${conn.to}`}
                animate={{ 
                  x1: fromInFocus ? from.x : stashX,
                  y1: fromInFocus ? from.y : stashY,
                  x2: toInFocus ? to.x : stashX,
                  y2: toInFocus ? to.y : stashY,
                  opacity: lineOpacity
                }}
                stroke={from.isSelected && to.isSelected ? "#FFD700" : "rgba(0,0,0,0.15)"} 
                strokeWidth={(from.isSelected && to.isSelected ? 2.5 : 1) * scale}
                strokeDasharray={from.isSelected && to.isSelected ? "none" : `${8 * scale} ${5 * scale}`}
                transition={{ type: "spring", stiffness: 300, damping: 35 }}
              />
            );
          })}
        </svg>

        {nodes.map(node => {
          const inFocus = isNodeInFocusPath(node.id, focusedNodeId, nodes);
          const hasFocus = focusedNodeId !== null;
          const targetX = !hasFocus || inFocus ? node.x : stashX;
          const targetY = !hasFocus || inFocus ? node.y : stashY;
          const targetScale = !hasFocus || inFocus ? (node.isSelected ? 1.15 : 1) : 0.1;
          const targetOpacity = !hasFocus || inFocus ? 1 : 0.2;

          return (
            <motion.div
              key={node.id}
              drag={!hasFocus || inFocus}
              dragMomentum={false}
              onPointerDown={() => {
                // Start long press timer
                longPressTimerRef.current = setTimeout(() => {
                    toggleSelect(node);
                    // Clear the timer so drag handler knows it fired
                    longPressTimerRef.current = null;
                }, 500);
              }}
              onPointerUp={() => {
                // If timer still exists, clear it (it was a short press/click)
                if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                }
              }}
              onDragStart={() => { 
                isDraggingRef.current = true;
                // If drag starts, cancel long press
                if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                }
              }}
              onDragEnd={() => { 
                // Delay resetting isDraggingRef to allow click handler to see the flag
                setTimeout(() => { isDraggingRef.current = false; }, 50); 
              }}
              onDrag={(e, info) => handleDrag(node.id, info)}
              animate={{  
                x: targetX,
                y: targetY,
                scale: targetScale,
                opacity: targetOpacity,
                zIndex: inFocus ? 20 : 10
              }}
              transition={{ type: "spring", stiffness: 300, damping: 35 }}
              style={{ position: 'absolute', left: 0, top: 0, translateX: '-50%', translateY: '-50%' }}
              className={`${!hasFocus || inFocus ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex flex-col items-center">
                <button
                  onClick={() => handleNodeLeftClick(node)}
                  onContextMenu={(e) => { e.preventDefault(); toggleSelect(node); }}
                  className={`
                    w-48 h-48 rounded-full flex flex-col items-center justify-center p-6 transition-all duration-300 text-center
                    ${node.isSelected 
                      ? 'bg-[#FFD700] text-black shadow-[0_0_80px_rgba(255,215,0,0.4)] border-transparent' 
                      : 'bg-white text-black/80 shadow-[0_30px_60px_rgba(0,0,0,0.06)] border border-gray-100 hover:border-blue-200 hover:scale-105'}
                  `}
                >
                  <span className={`text-[1rem] font-black leading-tight mb-2 ${node.isSelected ? 'text-black' : 'text-gray-900'}`}>
                    {node.label}
                  </span>
                  <div className="h-px w-8 bg-current opacity-20 mb-2" />
                  <span className="text-[0.5625rem] uppercase tracking-[0.25em] font-black opacity-40">
                    {CATEGORIES[node.level % CATEGORIES.length]}
                  </span>
                </button>
                {node.isSelected && (
                  <div className="absolute inset-[-20px] rounded-full border-2 border-[#FFD700]/30 animate-ping pointer-events-none" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-10 px-10 py-5 glass-panel bg-white/70 rounded-full border border-black/5 shadow-2xl z-30">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-[0.625rem] font-black text-gray-500 uppercase tracking-widest">左键: 聚焦/展开</span>
        </div>
        <div className="w-px h-5 bg-gray-200"></div>
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFD700]"></div>
          <span className="text-[0.625rem] font-black text-gray-500 uppercase tracking-widest">右键: 层级单选</span>
        </div>
        <div className="w-px h-5 bg-gray-200"></div>
        <div className="text-[0.625rem] font-black text-gray-400 uppercase tracking-widest">点击空白: 恢复视图</div>
      </div>
    </motion.div>
  );
};

export default MindMap;
