/**
 * Utility to extract dominant colors from an image
 */

export interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  frequency: number;
}

/**
 * Extract the top N dominant colors from an image
 * @param imageUrl - URL of the image to analyze
 * @param count - Number of colors to extract (default: 3)
 * @returns Promise with array of color hex codes
 */
export async function extractColorsFromImage(
  imageUrl: string,
  count: number = 3
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Set canvas size
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Map to store color frequencies
        const colorMap = new Map<string, number>();

        // Sample every 4th pixel for performance
        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];

          // Skip transparent or very transparent pixels
          if (a < 200) continue;

          // Convert to hex
          const hex = `#${[r, g, b]
            .map((x) => x.toString(16).padStart(2, "0"))
            .join("")}`;

          colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
        }

        // Sort by frequency and get top colors
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, count)
          .map(([hex]) => hex);

        resolve(sortedColors);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = imageUrl;
  });
}
