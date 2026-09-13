# 大厅两侧背景

日期：2026-09-12 制作，2026-09-13 完成验证。制作方式：内置 image_gen 图像生成工具。

用途：大厅左右边缘的静态环境层。中央模式选择和匹配操作优先；背景不承载文字、按钮或状态信息。用户确认以暗色深渊建筑、克制的蓝紫光色和中央留空取代直接铺满旧的牌桌／漩涡插画。

项目素材：`public/assets/lobby-abyss-sides-v1.webp`，1672×941，41,378 字节。生成结果只进行 WebP 格式压缩，未裁切或改变构图。原始 PNG 与效果截图保存在本地 `artifacts/lobby-background-20260912/`，不作为页面依赖。

页面将同一图像分别固定在左右外缘，按中央内容宽度限制装饰范围，使用向内及上下淡出的遮罩。窄屏改用淡色边缘渐变。高低档共用静态场景；素材仅在大厅显示，不参与交互和布局。

## 生成提示词

Use case: stylized-concept.
Asset type: production background artwork for the sides of a dark poker game lobby, WITHOUT any interface.
Primary request: a very restrained abyssal architectural atmosphere visible only at the far left and far right edges. The screen's real mode cards and gold matchmaking button will sit over the center; the artwork must stay secondary.
Scene: dark obsidian and weathered graphite futuristic architecture, partial tall pillars and incomplete curved structural ribs cropped by both outer edges, a little diffuse indigo and muted violet reflected light, extremely faint low mist. Both sides belong to the same quiet environment, with naturally different architectural silhouettes. Maintain a sophisticated, subtle dark-fantasy science-fiction aesthetic.
Composition: extra-wide landscape, approximately 16:9. Left architecture occupies only the outer 18-20 percent, right architecture only the outer 18-20 percent. The entire middle 60 percent is almost uniform ink black (#090c12), broad uninterrupted negative space from top to bottom. All architectural details gently dissolve well before reaching the middle. No center focal point. No frame around the whole picture. No distinct horizon across the middle. Main edge structures sit around mid-height, with the top and bottom softly fading into dark. They should be visible silhouettes with material depth, not just formless fog.
Lighting: subdued low-key illumination, soft gradients, cool blue-violet hues on BOTH sides, sparse and dim reflected edge accents, no bright white or neon-hot highlights, no point lights or glowing orbs. Dark readable forms at the perimeter rather than bright decoration. No saturated purple center.
Render as a high-quality cinematic environment painting with realistic materials. Output one clean background asset, ideally 2304x1296 or a similar wide ratio.
Constraints: NO text, letters, logo, watermark, UI, cards, chips, poker table, chairs, people, characters, stars, particles, flames, portals, central vortex, central object, red annotation, panels, borders or buttons. The middle must be empty and calm. Do not render a website mockup.
