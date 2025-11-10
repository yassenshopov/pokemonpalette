"use client";

import * as React from "react";
import { useColorblind, ColorblindType } from "./colorblind-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const colorblindTypes: {
  value: ColorblindType;
  label: string;
  description: string;
}[] = [
  {
    value: "none",
    label: "None",
    description: "Normal color vision",
  },
  {
    value: "protanopia",
    label: "Protanopia",
    description: "Red-blind (cannot see red light)",
  },
  {
    value: "deuteranopia",
    label: "Deuteranopia",
    description: "Green-blind (cannot see green light)",
  },
  {
    value: "tritanopia",
    label: "Tritanopia",
    description: "Blue-blind (cannot see blue light)",
  },
  {
    value: "protanomaly",
    label: "Protanomaly",
    description: "Red-weak (reduced sensitivity to red)",
  },
  {
    value: "deuteranomaly",
    label: "Deuteranomaly",
    description: "Green-weak (reduced sensitivity to green)",
  },
  {
    value: "tritanomaly",
    label: "Tritanomaly",
    description: "Blue-weak (reduced sensitivity to blue)",
  },
  {
    value: "achromatopsia",
    label: "Achromatopsia",
    description: "Complete color blindness (grayscale vision)",
  },
];

// Pokemon preview component - shows 3 Pokemon with different colors
function ColorPreview({ type }: { type: ColorblindType }) {
  // Use the original starter Pokemon: Bulbasaur (green), Charmander (red/orange), Squirtle (blue)
  const pokemon = [
    { id: 1, name: "Bulbasaur" }, // Green
    { id: 4, name: "Charmander" }, // Red/Orange
    { id: 7, name: "Squirtle" }, // Blue
  ];

  // Get filter style based on type
  const getFilterStyle = (colorblindType: ColorblindType) => {
    const filters: Record<ColorblindType, string> = {
      none: "none",
      protanopia: "url(#protanopia-filter)",
      deuteranopia: "url(#deuteranopia-filter)",
      tritanopia: "url(#tritanopia-filter)",
      protanomaly: "url(#protanomaly-filter)",
      deuteranomaly: "url(#deuteranomaly-filter)",
      tritanomaly: "url(#tritanomaly-filter)",
      achromatopsia: "url(#achromatopsia-filter)",
    };
    return filters[colorblindType] || "none";
  };

  const filterStyle = getFilterStyle(type);

  return (
    <div 
      className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-2"
      style={{ filter: filterStyle }}
    >
      {pokemon.map((p) => (
        <div
          key={p.id}
          className="relative w-12 h-12 overflow-hidden"
          title={p.name}
        >
          <img
            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.id}.png`}
            alt={p.name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

export function ColorblindSettings() {
  const { colorblindType, setColorblindType } = useColorblind();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Color Vision
        </CardTitle>
        <CardDescription>
          Adjust the display to simulate different types of color vision
          deficiencies. This helps ensure the app is accessible to users with
          colorblindness.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="colorblind-type" className="text-base">
              Color Vision Type
            </Label>
            <p className="text-sm text-muted-foreground">
              Simulate how colors appear with different types of color vision
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ColorPreview type={colorblindType} />
            <Select
              value={colorblindType}
              onValueChange={(value) => setColorblindType(value as ColorblindType)}
            >
              <SelectTrigger id="colorblind-type" className="w-[200px]">
                <SelectValue placeholder="Select color vision type">
                  {colorblindTypes.find((t) => t.value === colorblindType)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {colorblindTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-3 py-1">
                      <ColorPreview type={type.value} />
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{type.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {type.description}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {colorblindType !== "none" && (
          <p className="text-xs text-muted-foreground mt-3">
            The display is now filtered to simulate {colorblindTypes.find((t) => t.value === colorblindType)?.label.toLowerCase()}.
            Your preference is saved automatically.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Compact version for dropdown menus or sidebars
export function ColorblindSettingsCompact() {
  const { colorblindType, setColorblindType } = useColorblind();

  return (
    <div className="space-y-2">
      <Label htmlFor="colorblind-type-compact" className="text-sm">
        Color Vision
      </Label>
      <Select
        value={colorblindType}
        onValueChange={(value) => setColorblindType(value as ColorblindType)}
      >
        <SelectTrigger id="colorblind-type-compact" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {colorblindTypes.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

