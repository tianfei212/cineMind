
import { CinematicNode } from '../types';

// 定义通用的“年代”层（最末层）
const ERA_NODES: CinematicNode[] = [
  { label: "复古 1920s" }, { label: "摩登 1960s" }, { label: "迪斯科 1980s" },
  { label: "千禧年 2000s" }, { label: "当代现状" }, { label: "近未来 2049" },
  { label: "远未来 2700" }, { label: "中世纪纪元" }, { label: "上古神话时代" },
  { label: "蒸汽朋克时代" }
];

// 定义通用的“镜头语言”层，每个节点连接到年代
const LENS_NODES: CinematicNode[] = [
  { label: "极广角俯拍", children: ERA_NODES },
  { label: "浅景深特写", children: ERA_NODES },
  { label: "手持晃动镜头", children: ERA_NODES },
  { label: "环绕升降镜头", children: ERA_NODES },
  { label: "希区柯克变焦", children: ERA_NODES },
  { label: "主观视角(POV)", children: ERA_NODES },
  { label: "低角度仰拍", children: ERA_NODES },
  { label: "黄金比例中景", children: ERA_NODES },
  { label: "对称式构图", children: ERA_NODES },
  { label: "长镜头跟随", children: ERA_NODES }
];

// 定义通用的“关键元素”层
const ELEMENT_NODES: CinematicNode[] = [
  { label: "破碎的玻璃幕墙", children: LENS_NODES },
  { label: "漂浮的全息投影", children: LENS_NODES },
  { label: "燃烧的古旧信件", children: LENS_NODES },
  { label: "斑驳的金属纹理", children: LENS_NODES },
  { label: "丁达尔神圣光束", children: LENS_NODES },
  { label: "神秘的几何符号", children: LENS_NODES },
  { label: "漫天飞舞的樱花", children: LENS_NODES },
  { label: "巨大的机械残骸", children: LENS_NODES },
  { label: "流动的液态金属", children: LENS_NODES },
  { label: "古老的藤蔓缠绕", children: LENS_NODES }
];

// 定义通用的“精彩瞬间”层
const MOMENT_NODES: CinematicNode[] = [
  { label: "子弹静止瞬间", children: ELEMENT_NODES },
  { label: "泪水滑落脸颊", children: ELEMENT_NODES },
  { label: "双雄巅峰对峙", children: ELEMENT_NODES },
  { label: "夕阳下的告别", children: ELEMENT_NODES },
  { label: "冲破牢笼的呐喊", children: ELEMENT_NODES },
  { label: "废墟中的重生", children: ELEMENT_NODES },
  { label: "雨中的狂热拥吻", children: ELEMENT_NODES },
  { label: "秘密交易的达成", children: ELEMENT_NODES },
  { label: "致命的背刺一击", children: ELEMENT_NODES },
  { label: "神启般的顿悟", children: ELEMENT_NODES }
];

// 定义通用的“角色个体”层
const CHARACTER_NODES: CinematicNode[] = [
  { label: "孤僻的赛博黑客", children: MOMENT_NODES },
  { label: "失忆的流浪武士", children: MOMENT_NODES },
  { label: "优雅的致命特工", children: MOMENT_NODES },
  { label: "疯狂的边缘科学家", children: MOMENT_NODES },
  { label: "末世的幸存小队", children: MOMENT_NODES },
  { label: "高贵的堕落贵族", children: MOMENT_NODES },
  { label: "叛逆的仿生人", children: MOMENT_NODES },
  { label: "隐居的秘法祭司", children: MOMENT_NODES },
  { label: "冷血的赏金猎人", children: MOMENT_NODES },
  { label: "无名的都市过客", children: MOMENT_NODES }
];

// 定义通用的“场景”层
const SCENE_NODES: CinematicNode[] = [
  { label: "赛博霓虹窄巷", children: CHARACTER_NODES },
  { label: "废弃的巨型教堂", children: CHARACTER_NODES },
  { label: "云端浮空实验室", children: CHARACTER_NODES },
  { label: "深海沉没都市", children: CHARACTER_NODES },
  { label: "荒漠中的补给站", children: CHARACTER_NODES },
  { label: "维多利亚歌剧院", children: CHARACTER_NODES },
  { label: "极地科研基站", children: CHARACTER_NODES },
  { label: "原始丛林祭坛", children: CHARACTER_NODES },
  { label: "外星殖民地码头", children: CHARACTER_NODES },
  { label: "古典园林长廊", children: CHARACTER_NODES }
];

// 定义通用的“气氛”层
const ATMOSPHERE_NODES: CinematicNode[] = [
  { label: "极致抑郁雨夜", children: SCENE_NODES },
  { label: "史诗壮丽黎明", children: SCENE_NODES },
  { label: "诡异寂静午夜", children: SCENE_NODES },
  { label: "喧嚣狂热白昼", children: SCENE_NODES },
  { label: "唯美梦幻黄昏", children: SCENE_NODES },
  { label: "寒冷刺骨浓雾", children: SCENE_NODES },
  { label: "危险窒息时刻", children: SCENE_NODES },
  { label: "神圣静谧空间", children: SCENE_NODES },
  { label: "怀旧温暖色调", children: SCENE_NODES },
  { label: "崩坏绝望末世", children: SCENE_NODES }
];

// 最终导出电影构图数据树
export const CINEMATIC_TREE: CinematicNode = {
  label: "起点",
  children: [
    { label: "赛博霓虹都市", children: ATMOSPHERE_NODES },
    { label: "古典荒野秘境", children: ATMOSPHERE_NODES },
    { label: "废土漫游荒原", children: ATMOSPHERE_NODES },
    { label: "极地冰川基地", children: ATMOSPHERE_NODES },
    { label: "深海亚特兰蒂斯", children: ATMOSPHERE_NODES },
    { label: "蒸汽朋克伦多", children: ATMOSPHERE_NODES },
    { label: "东方仙侠云端", children: ATMOSPHERE_NODES },
    { label: "宇宙边缘站", children: ATMOSPHERE_NODES },
    { label: "热带原始雨林", children: ATMOSPHERE_NODES },
    { label: "欧洲中世纪古堡", children: ATMOSPHERE_NODES }
  ]
};
