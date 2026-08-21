# 参数化图形动画指导

本文记录参数化线框从静态 SVG 过渡到交互式 Canvas 动画的实现方式。方案复刻 Knowhere 落地页 `Core capabilities` 插图所体现的技术原理，而不是复制其站点源码：保留静态矢量回退，在 Canvas 中重新采样几何，并叠加入场描线、参数化循环和轻量指针交互。当前示例是图集 `01 / 双曲颈面`，实现位于 [`assets/animations/catenoid-field.js`](../assets/animations/catenoid-field.js)。

## 动画目的

这类动画属于低频浏览的展示内容，目的应是**解释几何如何生成**，而不是让装饰持续抢夺注意力。动画必须保留场景 JSON 中的公式、采样数量、颜色和基础轮廓；时间、指针和高亮只改变观察状态，不改变几何家族。

## 技术选型

- **静态 SVG**：无 JavaScript、打印、复制和加载失败时的可靠回退。
- **Canvas 2D**：逐帧绘制采样曲线、深度层级和移动纬线环。
- **手写三维数学**：欧拉旋转和弱透视投影，不引入 Three.js 或 WebGL。
- **`requestAnimationFrame`**：只处理需要实时响应时间和指针的部分。
- **`ResizeObserver`**：同步画布尺寸，并把设备像素比限制在 2。
- **`IntersectionObserver`**：图形离开视口后停止逐帧渲染。
- **Pointer Events**：仅在支持精确 Hover 的设备上启用视差。
- **`prefers-reduced-motion`**：关闭持续旋转、视差和逐帧循环，直接绘制完整静态状态。

CSS 动画适合预定的 `transform` 和 `opacity` 变化，但这个场景需要每帧重新计算曲面投影、深度排序和命中区域，因此使用 Canvas 与 `requestAnimationFrame`。

## 01 / 双曲颈面的几何

静态场景使用旋转双曲颈面：

\[
p(u,v) = [r(v)\cos u,\ hv,\ r(v)\sin u]
\]

其中：

\[
r(v) = n + (f-n)\frac{\cosh(g|v|)-1}{\cosh(g)-1}
\]

当前参数来自 `catenoid-field` 场景：

```js
const geometry = {
  neck: 0.11,
  flare: 0.94,
  growth: 1.9,
  height: 1.08
}
```

Canvas 与静态 SVG 保持相同数量：12 条纬线环、17 条固定经线；其中上下边界环固定，10 条内部环循环运动。纬线使用 120 段采样，经线使用 90 段采样。

## 三维旋转与投影

每个采样点依次应用 X、Y、Z 欧拉旋转。基础 X 轴倾角为 `0.36rad`，时间和指针只增加观察角度：

```js
const rotation = [
  0.36 + pointerPitch,
  elapsed * 0.00008 + pointerYaw,
  0
]
```

投影使用与静态渲染器一致的弱透视：

```js
const perspective = 1 + z * 0.1
screenX = centerX + x * perspective * scale
screenY = centerY + y * perspective * scale
```

它不是完整的透视摄像机，但足以根据深度产生前后尺度差，同时保持工程线框的规整感。

## 动画层次

### 1. 结构入场

路径按“从上到下的纬线 → 经线”的顺序出现。每条路径用余弦 `ease-in-out` 在 `1200ms` 内逐段绘制，相邻路径错开 `40ms`：

```js
const progress = clamp((now - start - index * 40) / 1200)
const reveal = -(Math.cos(Math.PI * progress) - 1) / 2
```

该过程解释曲面由截面环和母线构成，不使用缩放弹出或无意义的淡入。

### 2. 持续旋转

完整图形围绕纵轴缓慢旋转，速度为 `0.00008rad/ms`。运动保持匀速，因为它表达连续的空间观察，而不是一次 UI 状态切换。

### 3. 圆环收缩与展开

上下两条边界环固定在 \(v=-1\) 和 \(v=1\)，避免循环过程中两端出现空洞。其余 10 条纬线环使用均匀错开的相位，在 `5600ms` 内沿内部参数区间从 \(v=-0.9\) 移动到 \(v=0.9\)。圆环总数始终为 12；固定经线降低对比度，避免干扰运动方向。每个移动圆环从上方大半径进入，接近 \(v=0\) 时按照 `profileRadius(v)` 收缩到颈部，再向下展开到大半径：

```js
const progress = (phase + cycleElapsed / 5600) % 1
const v = -0.9 + progress * 1.8
const radius = profileRadius(v)
```

移动圆环接近内部循环边界时降低透明度但不完全消失，弱化从下方回到上方的循环接缝；两条固定边界环始终维持完整透明度。经线保持固定，作为曲面结构参照；不再绘制沿线扫描的高光或移动粒子。

### 4. 指针视差

指针位置映射为目标俯仰角和偏航角，实际角度每帧向目标插值：

```js
pitch += (targetPitch - pitch) * 0.055
yaw += (targetYaw - yaw) * 0.055
```

指针离开后目标值归零，图形自然回到自动旋转状态。该交互只在 `(hover: hover) and (pointer: fine)` 成立时启用。

### 5. 仪表式装饰层

参考工程可视化插图的层级，在几何主体周围绘制低对比度等宽标签，例如 `RING / 12`、`SAMPLE / 120` 和参数边界。文字保持静态，只用于增加技术图纸语境，不承载必须读取的信息，因此继续位于 `aria-hidden` 的 Canvas 内。

六个 4–6px 的青色或紫色方块在预设区域内做短距离正弦往复位移，并带一个低透明度外框。方块不沿几何线移动，也不添加尾迹；它们与圆环共用循环时间，因此“圆环速度”调为 `0×` 时整个装饰运动同时暂停。在 reduced-motion 模式下方块保持静止。

## 交互控制面板

图集采用三栏工作台，而不是同时展示所有卡片：左侧图形库负责切换模板，中间区域承载当前图形的大尺寸实时画布，右侧调试面板提供小预览、公式、动画参数和导出操作。左右面板都可折叠，折叠后中间画布自动获得更多空间；移动端默认折叠为两侧把手，展开一侧时会关闭另一侧。

所有 SVG 和 Canvas 统一使用 `#0f141a` 深色背景，模板自身的背景色不进入工作台展示。线条颜色仍来自模板 `accent`，并与白色轻微混合以保证深色背景上的对比度。切换模板时，中间画布、右侧小预览、标题、公式和主题强调色同步更新。

所有图形都提供“复制 SVG”和“复制参数”；`01 / 双曲颈面` 在右侧面板增加以下设置：

- **自动旋转**：暂停或继续纵轴旋转，关闭时保留当前角度。
- **鼠标跟随**：控制指针是否改变俯仰角与偏航角，关闭后平滑回到自动观察角度。
- **旋转速度**：在 `0×–2×` 之间调整自动旋转速度。
- **圆环速度**：在 `0×–2×` 之间调整纬线环从上到下的循环速度。

控件通过 `data-animation-setting` 与 Canvas 实例绑定。旋转角和循环时间按每帧时间差累加，而不是直接用“页面运行时间 × 当前倍率”计算，因此修改速度不会造成角度或圆环位置跳变。切换到尚未实现动画的模板时，Canvas 会隐藏并暂停，工作台改为显示确定性 SVG 和静态状态说明。

## 绘制顺序

每帧执行以下步骤：

1. 清理并绘制场景背景。
2. 绘制低对比度装饰文字。
3. 根据当前循环相位计算每条纬线环的 \(v\) 和半径，并重新采样三维路径。
4. 计算每条路径的平均 `z` 值。
5. 从后向前排序并绘制纬线环与固定经线。
6. 在几何上层绘制小型位移方块。

深度只影响绘制顺序和透明度，不改变场景公式。

## 性能和生命周期

### 画布尺寸

CSS 控制展示尺寸，Canvas backing store 根据 DPR 放大：

```js
const dpr = Math.min(devicePixelRatio || 1, 2)
canvas.width = Math.round(cssWidth * dpr)
canvas.height = Math.round(cssHeight * dpr)
context.setTransform(dpr, 0, 0, dpr, 0, 0)
```

DPR 上限为 2，避免高密度屏幕把逐帧像素量放大到 9 倍或 16 倍。

Canvas 被 `hidden` 或 `display: none` 隐藏时，`getBoundingClientRect()` 会返回零尺寸。尺寸同步必须直接跳过这种状态，且不要把展示宽高写入内联样式，否则重新显示后 Canvas 可能被永久锁定为 `1px × 1px`：

```js
const bounds = canvas.getBoundingClientRect()
if (bounds.width < 2 || bounds.height < 2) return

canvas.width = Math.round(bounds.width * dpr)
canvas.height = Math.round(bounds.height * dpr)
```

### 重新播放入场

刷新预览和重新选择动态图形应调用同一个 `restart()`，而不是销毁并重新创建 Canvas。该方法停止旧 RAF，重置入场时间、自动旋转、流动时间和指针状态，然后重新同步尺寸并启动渲染：

```js
restart() {
  this.stop()
  this.introStart = performance.now()
  this.autoYaw = 0
  this.cycleElapsed = 0
  this.rotation = { pitch: 0, yaw: 0, targetPitch: 0, targetYaw: 0 }
  this.resize()
  this.render(this.introStart)
  this.start()
}
```

这样参数控件和事件监听保持原实例不变，同时路径揭示会从第一帧重新开始。

### 暂停条件

满足任一条件时取消 RAF：

- Canvas 离开视口；
- 页面进入后台；
- 页面触发 `pagehide`；
- 实例被销毁。

事件通过 `AbortController` 统一清理，Observer 在 `destroy()` 中断开。

## 渐进增强与可访问性

图集始终先输出静态 SVG，再叠加 Canvas：

```html
<div class="preview">
  <svg><!-- 静态回退 --></svg>
  <canvas data-animation="catenoid-field" aria-hidden="true"></canvas>
</div>
```

只有 Canvas 获得 2D context、完成首次尺寸同步后，脚本才添加 `.is-animated` 并隐藏 SVG。Canvas 是装饰性替代视图，因此使用 `aria-hidden="true"`；原有标题、公式和复制操作保持可访问。

在 `prefers-reduced-motion: reduce` 下：

- 不启动持续 RAF；
- 不做自动旋转和指针视差；
- 不播放逐路径入场；
- 仍绘制完整几何的静态相位，保留结构信息。

## 扩展到后续图形

后续模板应复用生命周期和绘制管线，只替换以下部分：

1. `samplePath()`：从对应场景公式生成采样点。
2. 路径分组：决定入场顺序和拓扑含义。
3. 循环参数：选择真正有助于解释结构的参数方向，并在循环边界处理接缝。
4. 交互语义：只有指针变化能帮助观察空间结构时才添加交互。

不要把静态 SVG 路径解析后随意扭曲。动画应重新执行参数公式，以便任意时间点都能追溯到场景参数。

## 验证清单

- 静止帧仍能识别为原始几何家族。
- 动画不修改场景 JSON 或静态 SVG 输出。
- Canvas 不可用时 SVG 正常显示。
- 离屏和后台状态没有活跃 RAF。
- 1× 与 2× DPR 下线条清晰且尺寸一致。
- 鼠标、触摸和 reduced-motion 三种环境均可用。
- 从动态图形切换到静态图形再切回时，Canvas 恢复正确尺寸。
- 刷新按钮会重置时间状态并从入场动画开始重播。
- 重新运行 `npm run gallery` 后动画资源仍被复制到 `docs/animations/`。
