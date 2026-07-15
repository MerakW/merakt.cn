/**
 * 可见性开关。
 *
 * 设为 true 即可重新显示对应页面的导航与首页入口；页面路由始终保留。
 */
export const visibility = {
  astronix: false,
  airways: false,
} as const;

/**
 * 导航动效调校入口。
 *
 * 红线的总时长会按 Tab 之间的移动距离自动计算；页面在动画进行到
 * contentStartRatio 时开始切换。近距离更快，远距离更舒展。
 */
export const motion = {
  navIndicatorMinDurationMs: 180,
  navIndicatorMaxDurationMs: 360,
  navIndicatorPixelsPerMillisecond: 1.2,
  navContentStartRatio: 0.60,
} as const;
