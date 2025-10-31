"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Helper function to convert hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
};

// Helper function to convert RGB to hex
const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (n: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

// Helper function to convert RGB to HSL
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

// Helper function to convert HSL to RGB
const hslToRgb = (h: number, s: number, l: number) => {
  h /= 360;
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h * 6 < 1) {
    r = c;
    g = x;
    b = 0;
  } else if (h * 6 < 2) {
    r = x;
    g = c;
    b = 0;
  } else if (h * 6 < 3) {
    r = 0;
    g = c;
    b = x;
  } else if (h * 6 < 4) {
    r = 0;
    g = x;
    b = c;
  } else if (h * 6 < 5) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

interface ColorPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialColor: string;
  onColorChange: (color: string) => void;
  title?: string;
}

export function ColorPickerDialog({
  open,
  onOpenChange,
  initialColor,
  onColorChange,
  title = "Edit Color",
}: ColorPickerDialogProps) {
  const [currentColor, setCurrentColor] = useState(initialColor);
  const [rgb, setRgb] = useState(hexToRgb(initialColor));
  const [hsl, setHsl] = useState(() => {
    const { r, g, b } = hexToRgb(initialColor);
    return rgbToHsl(r, g, b);
  });

  // Update internal state when initialColor changes
  useEffect(() => {
    setCurrentColor(initialColor);
    const newRgb = hexToRgb(initialColor);
    setRgb(newRgb);
    setHsl(rgbToHsl(newRgb.r, newRgb.g, newRgb.b));
  }, [initialColor]);

  // Update color from RGB values
  const updateFromRgb = (newRgb: typeof rgb) => {
    setRgb(newRgb);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setCurrentColor(hex);
    setHsl(rgbToHsl(newRgb.r, newRgb.g, newRgb.b));
  };

  // Update color from HSL values
  const updateFromHsl = (newHsl: typeof hsl) => {
    setHsl(newHsl);
    const newRgb = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
    setRgb(newRgb);
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setCurrentColor(hex);
  };

  // Update color from hex input
  const updateFromHex = (hex: string) => {
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      setCurrentColor(hex);
      const newRgb = hexToRgb(hex);
      setRgb(newRgb);
      setHsl(rgbToHsl(newRgb.r, newRgb.g, newRgb.b));
    }
  };

  const handleSave = () => {
    onColorChange(currentColor);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setCurrentColor(initialColor);
    const resetRgb = hexToRgb(initialColor);
    setRgb(resetRgb);
    setHsl(rgbToHsl(resetRgb.r, resetRgb.g, resetRgb.b));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Color Preview */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-lg border-2 border-border"
              style={{ backgroundColor: currentColor }}
            />
            <div className="flex-1 space-y-3">
              <div>
                <Label htmlFor="hex-input">Hex Color</Label>
                <Input
                  id="hex-input"
                  value={currentColor}
                  onChange={(e) => updateFromHex(e.target.value)}
                  placeholder="#FF0000"
                  className="font-mono"
                />
              </div>
              <div>
                <Label htmlFor="color-picker">Color Picker</Label>
                <input
                  id="color-picker"
                  type="color"
                  value={currentColor}
                  onChange={(e) => updateFromHex(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Color Picker Tabs */}
          <Tabs defaultValue="rgb" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="rgb">RGB</TabsTrigger>
              <TabsTrigger value="hsl">HSL</TabsTrigger>
            </TabsList>

            <TabsContent value="rgb" className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="red-slider">Red: {rgb.r}</Label>
                  <input
                    id="red-slider"
                    type="range"
                    min="0"
                    max="255"
                    value={rgb.r}
                    onChange={(e) =>
                      updateFromRgb({ ...rgb, r: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-gradient-to-r from-black to-red-500 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <Label htmlFor="green-slider">Green: {rgb.g}</Label>
                  <input
                    id="green-slider"
                    type="range"
                    min="0"
                    max="255"
                    value={rgb.g}
                    onChange={(e) =>
                      updateFromRgb({ ...rgb, g: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-gradient-to-r from-black to-green-500 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <Label htmlFor="blue-slider">Blue: {rgb.b}</Label>
                  <input
                    id="blue-slider"
                    type="range"
                    min="0"
                    max="255"
                    value={rgb.b}
                    onChange={(e) =>
                      updateFromRgb({ ...rgb, b: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-gradient-to-r from-black to-blue-500 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="hsl" className="space-y-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="hue-slider">Hue: {hsl.h}°</Label>
                  <input
                    id="hue-slider"
                    type="range"
                    min="0"
                    max="360"
                    value={hsl.h}
                    onChange={(e) =>
                      updateFromHsl({ ...hsl, h: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <Label htmlFor="saturation-slider">Saturation: {hsl.s}%</Label>
                  <input
                    id="saturation-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={hsl.s}
                    onChange={(e) =>
                      updateFromHsl({ ...hsl, s: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-gradient-to-r from-gray-500 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, hsl(${hsl.h}, 0%, ${hsl.l}%), hsl(${hsl.h}, 100%, ${hsl.l}%))`,
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="lightness-slider">Lightness: {hsl.l}%</Label>
                  <input
                    id="lightness-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={hsl.l}
                    onChange={(e) =>
                      updateFromHsl({ ...hsl, l: parseInt(e.target.value) })
                    }
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, hsl(${hsl.h}, ${hsl.s}%, 0%), hsl(${hsl.h}, ${hsl.s}%, 50%), hsl(${hsl.h}, ${hsl.s}%, 100%))`,
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleSave} className="cursor-pointer">Save Color</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
