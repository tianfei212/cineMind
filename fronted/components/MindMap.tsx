
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MindNode, CinematicNode } from '../types';
import { getConfig, loadConfig } from '../services/configService';
import { logger } from '../utils/logger';
import { request } from '../services/httpClient';
import { createMindNode, getAiContent, getKeywords, getCinematicTree, aiSuggest, stepSuggest, generateImageTask, subscribeTask } from '../services/api';

interface MindMapProps {
  onSelectionComplete: (selectedLabels: string[]) => void;
  onClose: () => void;
  ratio: string;
  resolutionKey: string;
}

const DESIGN_WIDTH = 1920;
const NODE_SIZE = 110; // Reduced from 192 to 110
const BASE_GAP = NODE_SIZE * 0.3; // Reduced gap from 0.6x to 0.3x diameter

const calculateRadius = (count: number, scale: number) => {
  if (count <= 1) return 0;
  // Standardize radius to prevent jumping: Enforce a minimum radius equivalent to ~8 items
  // Circumference = count * (diameter + gap)
  const minCount = 8; 
  const effectiveCount = Math.max(count, minCount);
  const circumference = effectiveCount * (NODE_SIZE + BASE_GAP) * scale;
  return circumference / (2 * Math.PI);
};

// New Layout Calculation
const applyLayout = (nodes: MindNode[], scale: number): MindNode[] => {
  const selectedChain = nodes.filter(n => n.isSelected).sort((a, b) => a.level - b.level);
  
  // 1. Position Selected Nodes (Top Bar)
  const topY = 120 * scale;
  const centerX = window.innerWidth / 2;
  const gap = (NODE_SIZE + 40) * scale;
  
  const updatedNodes = nodes.map(node => {
    // Check if node is part of selected chain
    const selectedIndex = selectedChain.findIndex(n => n.id === node.id);
    
    if (selectedIndex >= 0) {
      // It is selected, move to top row
      // Distribute horizontally: Center alignment
      const totalWidth = (selectedChain.length - 1) * gap;
      const startX = centerX - totalWidth / 2;
      return {
        ...node,
        x: startX + selectedIndex * gap,
        y: topY
      };
    }
    return node;
  });

  // 2. Position Active Center Nodes
  // Active nodes are children of the last selected node.
  // If no node is selected, root nodes (level 0) are active.
  const lastSelected = selectedChain.length > 0 ? selectedChain[selectedChain.length - 1] : null;
  const activeParentId = lastSelected ? lastSelected.id : null;
  const activeLevel = lastSelected ? lastSelected.level + 1 : 0;
  
  // Filter active nodes: children of activeParentId (or level 0 if no parent)
  // Note: nodes with level 0 have no parentId usually, or we filter by parentId
  const activeNodes = updatedNodes.filter(n => {
    if (!activeParentId) return n.level === 0;
    return n.parentId === activeParentId;
  });

  const activeCount = activeNodes.length;
  const radius = calculateRadius(activeCount, scale);
  const activeIds = activeNodes.map(n => n.id);

  return updatedNodes.map(node => {
    if (activeIds.includes(node.id)) {
      const index = activeIds.indexOf(node.id);
      const angle = (index / activeCount) * Math.PI * 2 - Math.PI / 2; // Start from top
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: window.innerHeight / 2 + Math.sin(angle) * radius
      };
    }
    // For unselected siblings of previous levels, we don't update them explicitly here,
    // they will be handled by visibility logic (opacity) or can stay where they were.
    // Or we can move them to stash if we want to ensure they don't block clicks.
    // For now, let's leave them (targetOpacity handles visibility).
    return node;
  });
};

const MindMap: React.FC<MindMapProps> = ({ onSelectionComplete, onClose, ratio, resolutionKey }) => {
  const [nodes, setNodes] = useState<MindNode[]>([]);
  const [connections, setConnections] = useState<{from: string, to: string}[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [dataTree, setDataTree] = useState<CinematicNode | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  // Ref to track if we are currently dragging
  const isDraggingRef = React.useRef(false);
  // Ref for long press timer
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [levelLabels, setLevelLabels] = useState<string[]>([]);
  const [aiPrompts, setAiPrompts] = useState<Record<string, { zh: string; en: string }>>({});
  const [aiKeywords, setAiKeywords] = useState<Record<string, string[]>>({});
  const [kwByCat, setKwByCat] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [taskStatus, setTaskStatus] = useState<any | null>(null);
  const subscriptionRef = React.useRef<any>(null);

  // 载入数据树：优先后端，否则配置
  useEffect(() => {
    const loadTree = async () => {
      try {
        let cfg: any;
        try {
          cfg = getConfig();
        } catch {
          cfg = await loadConfig();
        }
        setLevelLabels(cfg.ui.levelLabels ?? ["影片类型", "环境背景", "角色个体", "精彩瞬间", "关键元素", "镜头语言", "年代"]);
        if (cfg.defaultData.is_from_db_load) {
          try {
            const tree = await request<any>(cfg.api.endpoints.nodes, { method: 'GET' });
            setDataTree(tree as any);
            logger.info('从后端加载首屏树成功');
            return;
          } catch (e) {
            logger.error('从后端加载首屏树失败', e as any);
          }
        }
        setDataTree(cfg.defaultData.cinematicTree);
      } catch {
        try {
          const cfg = await loadConfig();
          setLevelLabels(cfg.ui.levelLabels ?? ["影片类型", "环境背景", "角色个体", "精彩瞬间", "关键元素", "镜头语言", "年代"]);
          setDataTree(cfg.defaultData.cinematicTree);
        } catch {
          setDataTree(null);
        }
      }
    };
    loadTree();
  }, []);

  // 初始化显示第一层
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
    
    if (dataTree?.children) {
      const initialNodes: MindNode[] = dataTree.children.map((child, i) => {
        const count = dataTree.children!.length;
        const angle = (i / count) * Math.PI * 2;
        const radius = calculateRadius(count, currentScale);
        return {
          id: `node-0-${i}`,
          label: child.label,
          x: rootX + Math.cos(angle) * radius,
          y: rootY + Math.sin(angle) * radius,
          isSelected: false,
          level: 0
        };
      });
      setNodes(applyLayout(initialNodes, currentScale));
    }
    
    return () => window.removeEventListener('resize', updateScale);
  }, [dataTree]);

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

  const buildPath = (n: MindNode, acc: string[] = []): string[] => {
    const newAcc = [n.label, ...acc];
    if (!n.parentId) return newAcc;
    const parent = nodes.find(p => p.id === n.parentId);
    return parent ? buildPath(parent, newAcc) : newAcc;
  };

  const spawnChildrenFromLabels = (parent: MindNode, labels: string[]) => {
    if (parent.level + 1 >= levelLabels.length) return;
    const existing = nodes.filter(n => n.parentId === parent.id).map(n => n.label);
    const newLabels = labels.filter(l => !existing.includes(l));
    if (newLabels.length === 0) return;
    const nextLevel = parent.level + 1;
    const count = newLabels.length;
    const baseAngle = Math.atan2(parent.y - window.innerHeight / 2, parent.x - window.innerWidth / 2);
    const spread = Math.PI * 1.4;
    const startAngle = baseAngle - spread / 2;
    // Use smaller radius for dynamic suggestions, scaled by node size
    const radius = (NODE_SIZE * 1.8) * scale;
    const added: MindNode[] = newLabels.map((label, i) => {
      const angle = startAngle + (i / (count - 1 || 1)) * spread;
      return {
        id: `node-${nextLevel}-${Math.random().toString(36).substr(2, 5)}`,
        label,
        parentId: parent.id,
        x: parent.x + Math.cos(angle) * radius,
        y: parent.y + Math.sin(angle) * radius,
        isSelected: false,
        level: nextLevel,
      };
    });
    setNodes(prev => applyLayout([...prev, ...added], scale));
    setConnections(prev => [...prev, ...added.map(s => ({ from: parent.id, to: s.id }))]);
  };

  const buildQueryContext = (node: MindNode): { type: string; label: string }[] => {
    const pathLabels = buildPath(node);
    const selectedByLevel: Record<number, string> = {};
    nodes.forEach(n => { if (n.isSelected) selectedByLevel[n.level] = n.label; });
    const maxLevel = node.level;
    const typed: { type: string; label: string }[] = [];
    for (let i = 0; i <= maxLevel; i++) {
      const type = levelLabels[i % levelLabels.length];
      const label = (selectedByLevel[i] !== undefined) ? selectedByLevel[i] : (pathLabels[i] || "");
      if (label) typed.push({ type, label });
    }
    return typed;
  };

  const handleNodeLeftClick = async (node: MindNode) => {
    if (isSubmitting) {
      logger.info('正在提交生图任务，忽略节点点击');
      return;
    }
    // If we just finished dragging, ignore the click
    if (isDraggingRef.current) return;

    if (focusedNodeId === node.id) {
      setFocusedNodeId(null);
      logger.event('取消聚焦节点', { id: node.id, label: node.label });
      return;
    }
    setFocusedNodeId(node.id);
    logger.event('聚焦节点', { id: node.id, label: node.label });
    setNodes(prev => {
      const updated = prev.map(n => {
        if (n.level === node.level) {
          return { ...n, isSelected: n.id === node.id };
        }
        return n;
      });
      return applyLayout(updated, scale);
    });

    const hasChildren = nodes.some(n => n.parentId === node.id);
    if (hasChildren) {
      const ctx = buildQueryContext(node);
      const nextIdx = node.level + 1;
      if (nextIdx >= levelLabels.length) {
        logger.info('已到最后一层，停止递进查询');
        return;
      }
      const nextType = levelLabels[nextIdx];
      try {
        const res = await stepSuggest(ctx, nextType, 10);
        setAiKeywords(prev => ({ ...prev, [node.id]: res.items }));
        setKwByCat(prev => ({ ...prev, [nextType]: res.items }));
        spawnChildrenFromLabels(node, res.items);
        logger.event('逐层建议', { context: ctx, target: res.target_type, items: res.items });
      } catch (e) {
        logger.error('逐层建议失败', e as any);
      }
      return;
    }

    const path = buildPath(node);
    const dataNode = dataTree ? findDataNode(path, dataTree) : null;

    if (dataNode && dataNode.children) {
      const nextLevel = node.level + 1;
      if (nextLevel >= levelLabels.length) {
        logger.info('已到最后一层，停止展开静态子节点');
      } else {
        const count = dataNode.children.length;
        const subNodes: MindNode[] = dataNode.children.map((child, i) => {
          // 使用更动态的排布：在父节点周围做圆周排布，偏移角度避开父节点来源方向
          const baseAngle = Math.atan2(node.y - window.innerHeight / 2, node.x - window.innerWidth / 2);
          const spread = Math.PI * 1.2; // 展开角度
          const startAngle = baseAngle - spread / 2;
          const angle = startAngle + (i / (count - 1 || 1)) * spread;
          // Use smaller radius for child nodes, scaled by node size
          const radius = (NODE_SIZE * 1.8) * scale;
          
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

        setNodes(prev => applyLayout([...prev, ...subNodes], scale));
        setConnections(prev => [...prev, ...subNodes.map(s => ({ from: node.id, to: s.id }))]);
      }
    }
    const ctx = buildQueryContext(node);
    const nextIdx = node.level + 1;
    if (nextIdx >= levelLabels.length) {
      logger.info('已到最后一层，停止递进查询');
      return;
    }
    const nextType = levelLabels[nextIdx];
    try {
      const res = await stepSuggest(ctx, nextType, 10);
      setAiKeywords(prev => ({ ...prev, [node.id]: res.items }));
      setKwByCat(prev => ({ ...prev, [nextType]: res.items }));
      spawnChildrenFromLabels(node, res.items);
      logger.event('逐层建议', { context: ctx, target: res.target_type, items: res.items });
    } catch (e) {
      logger.error('逐层建议失败', e as any);
    }
  };

  const toggleSelect = async (node: MindNode) => {
    if (isSubmitting) {
      logger.info('正在提交生图任务，忽略节点选择');
      return;
    }

    // Get the latest state of the node
    const current = nodes.find(n => n.id === node.id) || node;
    const nextSelected = !current.isSelected;

    setNodes(prev => {
      let updated = prev.map(n => {
        if (n.level === current.level) {
          if (n.id === current.id) {
            return { ...n, isSelected: nextSelected };
          }
          // If selecting, clear siblings. If deselecting, keep siblings as is (unselected).
          return { ...n, isSelected: false }; 
        }
        return n;
      });

      // If deselecting, clear selection for all deeper levels
      if (!nextSelected) {
        updated = updated.map(n => n.level > current.level ? { ...n, isSelected: false } : n);
      }

      return applyLayout(updated, scale);
    });

    if (nextSelected) {
      // Logic for Selecting: Suggest Next Level
      logger.event('选择节点', { id: current.id, label: current.label, level: current.level });
      
      const ctx = buildQueryContext(current); // Context includes current node
      const nextIdx = current.level + 1;
      if (nextIdx >= levelLabels.length) {
        logger.info('已到最后一层，停止递进查询(选择)');
        return;
      }
      const nextType = levelLabels[nextIdx];
      try {
        const res = await stepSuggest(ctx, nextType, 10);
        setAiKeywords(prev => ({ ...prev, [current.id]: res.items }));
        setKwByCat(prev => ({ ...prev, [nextType]: res.items }));
        spawnChildrenFromLabels(current, res.items);
        logger.event('逐层建议(选择)', { context: ctx, target: res.target_type, items: res.items });
      } catch (e) {
        logger.error('逐层建议失败(选择)', e as any);
      }
    } else {
      // Logic for Deselecting: Suggest Current Level (Alternatives)
      logger.event('取消选择节点，重新获取本层级建议', { id: current.id, label: current.label, level: current.level });

      try {
        // 1. Clean up State & Remove Nodes
        // Identify nodes to remove for cleanup
        const nodesToRemove = nodes.filter(n => n.level >= current.level);
        const idsToRemove = nodesToRemove.map(n => n.id);
        
        // Clean up auxiliary state
        setAiKeywords(prev => {
            const next = { ...prev };
            idsToRemove.forEach(id => delete next[id]);
            return next;
        });
        setAiPrompts(prev => {
            const next = { ...prev };
            idsToRemove.forEach(id => delete next[id]);
            return next;
        });
        setKwByCat(prev => {
            const next = { ...prev };
            // Clear categories for current level and deeper
            for (let l = current.level; l < levelLabels.length; l++) {
                delete next[levelLabels[l]];
            }
            return next;
        });

        // Update nodes state
        setNodes(prev => {
           const kept = prev.filter(n => n.level < current.level);
           return applyLayout(kept, scale);
        });
  
        // 2. Build context excluding current node (up to parent)
        const ctx: { type: string; label: string }[] = [];
        for(let l=0; l < current.level; l++) {
            const selected = nodes.find(n => n.level === l && n.isSelected);
            if (selected) {
                ctx.push({ type: levelLabels[l], label: selected.label });
            }
        }
  
        const targetType = levelLabels[current.level];
        
        logger.info('重新获取关键词', { context: ctx, target: targetType });
        const res = await stepSuggest(ctx, targetType, 10);
        setKwByCat(prev => ({ ...prev, [targetType]: res.items }));
  
        // 3. Spawn new nodes for the current level
        if (current.level === 0) {
           // Handle Root Level
           const rootX = window.innerWidth / 2;
           const rootY = window.innerHeight / 2;
           // Use calculateRadius for consistent layout
           const count = res.items.length;
           const radius = calculateRadius(count, scale);
           
           const added: MindNode[] = res.items.map((label, i) => {
               const angle = (i / count) * Math.PI * 2;
               return {
                   id: `node-0-${Date.now()}-${i}`,
                   label,
                   x: rootX + Math.cos(angle) * radius,
                   y: rootY + Math.sin(angle) * radius,
                   isSelected: false,
                   level: 0
               };
           });
           setNodes(prev => applyLayout([...prev, ...added], scale));
        } else {
           // Handle Child Level
           const parent = nodes.find(n => n.id === current.parentId);
           if (parent) {
             // Do NOT use spawnChildrenFromLabels here because it relies on stale 'nodes' state for filtering
             // Manually create nodes without filtering
             const nextLevel = parent.level + 1;
             const count = res.items.length;
             const baseAngle = Math.atan2(parent.y - window.innerHeight / 2, parent.x - window.innerWidth / 2);
             const spread = Math.PI * 1.4;
             const startAngle = baseAngle - spread / 2;
             // Use consistent radius calculation logic
             const radius = calculateRadius(Math.max(8, count), scale); // Use min 8 for consistency
             
             const added: MindNode[] = res.items.map((label, i) => {
               const angle = startAngle + (i / (count - 1 || 1)) * spread;
               return {
                 id: `node-${nextLevel}-${Math.random().toString(36).substr(2, 5)}`,
                 label,
                 parentId: parent.id,
                 x: parent.x + Math.cos(angle) * radius,
                 y: parent.y + Math.sin(angle) * radius,
                 isSelected: false,
                 level: nextLevel,
               };
             });
             
             setNodes(prev => applyLayout([...prev, ...added], scale));
             setConnections(prev => [...prev, ...added.map(s => ({ from: parent.id, to: s.id }))]);
           } else {
             logger.error('无法找到父节点，无法生成建议', { parentId: current.parentId });
             // Fallback: Show error toast or visual feedback?
           }
        }
        
        logger.event('重新获取关键词完成', { context: ctx, target: targetType, items: res.items });
      } catch (e) {
        logger.error('重新获取关键词失败', e as any);
        // Ensure state is at least consistent (nodes already removed)
      }
    }
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

  const buildGeneratePayload = (): any | null => {
    const byLevel: Record<number, MindNode | undefined> = {};
    nodes.forEach(n => { if (n.isSelected) byLevel[n.level] = n; });
    const getLabel = (name: string) => {
      const idx = levelLabels.indexOf(name);
      const node = idx >= 0 ? byLevel[idx] : undefined;
      return node?.label;
    };
    const film = getLabel('影片类型');
    const env = getLabel('环境背景');
    if (!film || !env) {
      logger.error('生成任务失败：缺少必选项', { film, env });
      return null;
    }
    const payload: any = {
      任务ID: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      影片类型: film,
      环境背景: env,
      主角类型: getLabel('主角类型'),
      角色个体: getLabel('角色个体'),
      精彩瞬间: getLabel('精彩瞬间'),
      关键元素: getLabel('关键元素'),
      镜头语言: getLabel('镜头语言'),
      年代: getLabel('年代'),
      图像比例: ratio,
      resolutionKey: resolutionKey,
    };
    const addKw = (cat: string) => {
      if (kwByCat[cat] && kwByCat[cat].length > 0) {
        payload[`关键词_${cat}`] = kwByCat[cat];
      }
    };
    ['影片类型', '环境背景', '主角类型', '角色个体', '精彩瞬间', '关键元素', '镜头语言', '年代'].forEach(addKw);
    return payload;
  };

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
            {levelLabels.map((cat, i) => {
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
                      {/* <button onClick={() => toggleSelect(selectedAtThisLevel)} className="opacity-40">×</button> */}
                    </motion.div>
                  ) : (
                    <div className="h-10 rounded-xl border border-white/5 flex items-center px-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    </div>
                  )}
                  {selectedAtThisLevel && aiPrompts[selectedAtThisLevel.id] && (
                    <div className="mt-2 text-xs text-white/70">
                      <div className="font-bold">AI提示词（中）</div>
                      <div className="text-white/80">{aiPrompts[selectedAtThisLevel.id].zh}</div>
                      <div className="font-bold mt-1">AI提示词（英）</div>
                      <div className="text-white/80">{aiPrompts[selectedAtThisLevel.id].en}</div>
                      {aiKeywords[selectedAtThisLevel.id] && (
                        <div className="mt-1">关键词：{aiKeywords[selectedAtThisLevel.id].join('，')}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-white/5">
          <button 
            onClick={async () => {
              logger.event('提交选择', { selectedLabels });
              try {
                setIsSubmitting(true);
                const payload = buildGeneratePayload();
                if (!payload) return;
                payload['内容'] = selectedLabels.join('，');
                const cfg = getConfig();
                const base = cfg.api.baseUrl || `http://${cfg.api.backendHost}:${cfg.api.backendPort}`;
                const path = cfg.api.endpoints.generate || '/tasks/generate';
                const url = `${base}${path}`;
                logger.event('生图任务载荷', { payload, path, url });
                const res = await generateImageTask(payload);
                logger.info('已提交生图任务', { task: res });

                if (res && res.task_id) {
                  setTaskStatus({ status: 'pending', progress: 0 });
                  logger.info('开始订阅任务状态', { taskId: res.task_id });
                  subscriptionRef.current = subscribeTask(res.task_id, (data: any) => {
                    logger.info('收到任务状态更新', { data });
                    setTaskStatus(data);
                    
                    // Auto-trigger refresh and close on completion if needed
                    if (data.type === 'completed' || data.status === 'completed') {
                         // Ensure status is updated to completed so UI shows result
                         setTaskStatus(prev => ({...prev, ...data, status: 'completed'}));
                         
                         // Automatically close and refresh after a short delay to show completion
                         setTimeout(() => {
                            if (subscriptionRef.current) subscriptionRef.current.close();
                            setTaskStatus(null);
                            onSelectionComplete(selectedLabels);
                            // Trigger refresh on parent
                            window.dispatchEvent(new Event('refreshGallery'));
                         }, 1500);
                    }
                  }, (err) => {
                    logger.error('WebSocket 连接错误', err);
                  });
                } else {
                  onSelectionComplete(selectedLabels);
                }
              } catch (e) {
                logger.error('提交生图任务失败', e as any);
              } finally {
                setIsSubmitting(false);
              }
            }}
            disabled={selectedLabels.length === 0 || isSubmitting}
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
              <motion.div 
                className="relative flex flex-col items-center"
                animate={{ 
                  y: [0, -NODE_SIZE * 0.08, 0],
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 3, 
                  ease: "easeInOut",
                  delay: Math.random() * 2 // Random start phase
                }}
              >
                <button
                  onClick={() => handleNodeLeftClick(node)}
                  onContextMenu={(e) => { e.preventDefault(); toggleSelect(node); }}
                  className={`
                    rounded-full flex flex-col items-center justify-center p-2 transition-all duration-300 text-center
                    ${node.isSelected 
                      ? 'bg-[#FFD700] text-black shadow-[0_0_80px_rgba(255,215,0,0.4)] border-transparent' 
                      : 'bg-white text-black/80 shadow-[0_30px_60px_rgba(0,0,0,0.06)] border border-gray-100 hover:border-blue-200 hover:scale-105'}
                  `}
                  style={{
                    width: NODE_SIZE * scale,
                    height: NODE_SIZE * scale,
                  }}
                >
                  <span className={`font-black leading-tight mb-1 ${node.isSelected ? 'text-black' : 'text-gray-900'}`} style={{ fontSize: `${14 * scale}px` }}>
                    {node.label}
                  </span>
                  <div className="h-px w-4 bg-current opacity-20 mb-1" />
                  <span className="uppercase tracking-[0.25em] font-black opacity-40" style={{ fontSize: `${9 * scale}px` }}>
                    {levelLabels[node.level % levelLabels.length]}
                  </span>
                </button>
                {node.isSelected && (
                  <div className="absolute inset-[-10px] rounded-full border-2 border-[#FFD700]/30 animate-ping pointer-events-none" />
                )}
              </motion.div>
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

      <AnimatePresence>
        {taskStatus && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
            >
                <div className="bg-[#1a1a1a] p-8 rounded-3xl max-w-lg w-full text-center border border-white/10 shadow-2xl relative">
                    <button 
                        onClick={() => {
                            if (subscriptionRef.current) subscriptionRef.current.close();
                            setTaskStatus(null);
                        }} 
                        className="absolute top-4 right-4 text-white/30 hover:text-white"
                    >
                        ✕
                    </button>
                    
                    {taskStatus.status === 'completed' && taskStatus.imageUrl ? (
                        <div className="space-y-4">
                            <h3 className="text-2xl font-bold text-[#FFD700]">渲染完成</h3>
                            <img src={taskStatus.imageUrl} alt="Result" className="w-full rounded-xl border border-white/20" />
                            <p className="text-white/60 text-sm">即将返回主界面...</p>
                        </div>
                    ) : taskStatus.status === 'failed' ? (
                        <div className="space-y-4">
                            <div className="text-red-500 text-5xl">⚠</div>
                            <h3 className="text-xl font-bold text-white">渲染失败</h3>
                            <p className="text-white/60">{taskStatus.message}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="text-4xl animate-bounce">🎨</div>
                            <h3 className="text-xl font-bold text-white">正在渲染创意方案...</h3>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                <motion.div 
                                    className="h-full bg-[#FFD700]"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${taskStatus.progress}%` }}
                                    transition={{ type: "spring", stiffness: 50 }}
                                />
                            </div>
                            <p className="text-sm text-white/40 font-mono">{taskStatus.status} - {taskStatus.progress}%</p>
                        </div>
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MindMap;
