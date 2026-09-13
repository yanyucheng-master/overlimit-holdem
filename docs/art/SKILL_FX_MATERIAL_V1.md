# 技能柔雾材质 V1

生成日期：2026-09-13。通过内置 ImageGen 制作，共用材质服务于全技能精修，主体图形仍由本地 SVG 定义。

- 项目文件：`public/assets/skill-fx-vapor-v1.png`
- 原图：`C:/Users/YYC/.codex/generated_images/01a08401-0ed8-7622-bb15-b7a0346a1894/exec-cb631690-6472-4118-82c5-6e64f153c201.png`。已保留原图。
- 尺寸：1254 × 1254；RGBA；1,096,261 字节。
- 透明验证：alpha 范围 0–254，969,835 个完全透明像素；四角 alpha 为 0、0、1、0，中心为 0。
- 使用方式：CSS alpha mask，以技能既有色板着色，少量旋转、收拢和淡出。低档不绘制薄雾。
- 字体、卡牌、符号与 UI 均未烘焙进纹理。图片复制进项目后保持原始像素和 alpha。

## 最终生成提示词

```text
Use case: stylized-concept.
Asset type: one reusable grayscale transparent VFX texture for a dark fantasy poker game's magic effects, to be tinted and animated by code.
Create a single isolated, soft, elegant crescent-shaped swirl of luminous mist, with several delicately tapered silky filaments. Pure monochrome white and soft gray, varied density, realistic volumetric vapor with fine wispy breakup along the edges. The crescent is roughly circular but asymmetrical and incomplete, concentrated around the outer half of a broad empty center. A few wisps curl inward. Center must remain mostly genuinely transparent. No solid ring or geometrical outline. Soft lit body with fine strands, no hot blown-out highlights. The entire texture fits comfortably inside the square with at least 12 percent fully transparent margin on all sides; smoke fades completely at every edge.
Production VFX material, not a painting of a scene. Genuine transparent alpha background, no black or colored background, no gray/checkerboard backdrop baked into the image, no text, symbols, stars, cards, characters, UI, frame or watermark. Render one square texture around 1024x1024.
```
