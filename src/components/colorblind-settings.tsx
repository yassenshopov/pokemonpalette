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

export function ColorblindSettings() {
  const { colorblindType, setColorblindType } = useColorblind();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Colorblind Accessibility
        </CardTitle>
        <CardDescription>
          Adjust the display to simulate different types of color vision
          deficiencies. This helps ensure the app is accessible to users with
          colorblindness.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="colorblind-type">Color Vision Type</Label>
          <Select
            value={colorblindType}
            onValueChange={(value) => setColorblindType(value as ColorblindType)}
          >
            <SelectTrigger id="colorblind-type">
              <SelectValue placeholder="Select color vision type" />
            </SelectTrigger>
            <SelectContent>
              {colorblindTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{type.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {type.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {colorblindType !== "none" && (
            <p className="text-xs text-muted-foreground mt-2">
              The display is now filtered to simulate {colorblindTypes.find((t) => t.value === colorblindType)?.label.toLowerCase()}.
              Your preference is saved automatically.
            </p>
          )}
        </div>
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

