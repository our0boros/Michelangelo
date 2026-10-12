import { cycladic, moai, nefertiti, venus, thinker, david } from './sculptures.js';

// size: block dimensions in metres [x, y, z]; voxel: sample spacing in metres.
// flaw: 0..1 density of hidden weak veins; toughness scales crack resistance.
// plaster: budget in litres; baseValue: appraisal ceiling in florins.
export const LEVELS = [
  {
    id: 'cycladic', name: '基克拉泽斯女像', artist: '佚名 · 基克拉泽斯文明', year: '约公元前 2500 年',
    stone: '纳克索斯白大理石', shape: cycladic, size: [0.26, 1.0, 0.16], voxel: 0.009,
    flaw: 0.0, toughness: 1.4, plaster: 1.2, baseValue: 800,
    tip: '入门关。先用尖凿重锤去掉大块余料，粉笔等高线越密的地方离成品越远；绿色表示已到位，红色表示雕过头了。',
  },
  {
    id: 'moai', name: '摩艾石像', artist: '拉帕努伊人', year: '1250–1500 年',
    stone: '大理石（原作为凝灰岩）', shape: moai, size: [0.44, 0.98, 0.36], voxel: 0.01,
    flaw: 0.15, toughness: 1.25, plaster: 1.0, baseValue: 1500,
    tip: '体块方正，练习控制深度。眼窝和下巴下方要换平凿轻敲，避免崩角。',
  },
  {
    id: 'nefertiti', name: '纳芙蒂蒂半身像', artist: '图特摩斯', year: '公元前 1345 年',
    stone: '大理石（原作为石灰岩彩绘）', shape: nefertiti, size: [0.46, 0.7, 0.32], voxel: 0.0085,
    flaw: 0.3, toughness: 1.05, plaster: 0.8, baseValue: 4000,
    tip: '细长的颈部是最大风险。靠近颈部时用轻锤，注意悬停圈的颜色提示。',
  },
  {
    id: 'venus', name: '米洛的维纳斯', artist: '安条克的亚历山德罗斯', year: '公元前 150–125 年',
    stone: '帕罗斯大理石', shape: venus, size: [0.33, 0.96, 0.28], voxel: 0.008,
    flaw: 0.45, toughness: 1.0, plaster: 0.6, baseValue: 9000,
    tip: '躯干的 S 形扭转需要从多个角度雕刻。断臂处是原作特征，不要试图补上。',
  },
  {
    id: 'thinker', name: '思想者', artist: '奥古斯特·罗丹', year: '1904 年',
    stone: '大理石（原作为青铜）', shape: thinker, size: [0.38, 0.8, 0.46], voxel: 0.008,
    flaw: 0.6, toughness: 0.9, plaster: 0.5, baseValue: 16000,
    tip: '手臂与膝盖之间的空隙最难处理：先从侧面打通，再从正面修形。纹理较多，留意灰色纹脉。',
  },
  {
    id: 'david', name: '大卫', artist: '米开朗基罗', year: '1501–1504 年',
    stone: '卡拉拉大理石', shape: david, size: [0.3, 0.92, 0.27], voxel: 0.0065,
    flaw: 0.8, toughness: 0.8, plaster: 0.4, baseValue: 50000,
    tip: '终极挑战。对立式站姿让左右腿受力不同，抬起的左臂与身体之间空隙狭窄。米开朗基罗用的那块石头就有瑕疵。',
  },
];
