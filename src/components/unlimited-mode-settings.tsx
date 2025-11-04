"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings } from "lucide-react";

type ShinyPreference = "both" | "shiny" | "normal";

interface UnlimitedModeSettings {
  shinyPreference: ShinyPreference;
  selectedGenerations: number[];
}

interface UnlimitedModeSettingsDialogProps {
  settings: UnlimitedModeSettings;
  onSettingsChange: (settings: UnlimitedModeSettings) => void;
  primaryColor?: string;
  availableGenerations: number[];
}

export function UnlimitedModeSettingsDialog({
  settings,
  onSettingsChange,
  primaryColor,
  availableGenerations,
}: UnlimitedModeSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<UnlimitedModeSettings>(settings);

  const handleSave = () => {
    onSettingsChange(localSettings);
    setOpen(false);
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    setOpen(false);
  };

  const toggleGeneration = (gen: number) => {
    setLocalSettings((prev) => {
      const newGens = prev.selectedGenerations.includes(gen)
        ? prev.selectedGenerations.filter((g) => g !== gen)
        : [...prev.selectedGenerations, gen];
      
      // Ensure at least one generation is selected
      if (newGens.length === 0) {
        return prev;
      }
      
      return {
        ...prev,
        selectedGenerations: newGens,
      };
    });
  };

  const selectAllGenerations = () => {
    setLocalSettings((prev) => ({
      ...prev,
      selectedGenerations: [...availableGenerations],
    }));
  };

  const clearAllGenerations = () => {
    // Keep at least one generation selected
    if (availableGenerations.length > 0) {
      setLocalSettings((prev) => ({
        ...prev,
        selectedGenerations: [availableGenerations[0]],
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          style={{
            borderColor: primaryColor ? `${primaryColor}40` : undefined,
          }}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-heading">Unlimited Mode Settings</DialogTitle>
          <DialogDescription>
            Customize which Pokemon appear in unlimited mode
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Shiny Preference */}
          <div className="space-y-3">
            <Label className="text-base font-heading font-semibold">
              Shiny Preference
            </Label>
            <RadioGroup
              value={localSettings.shinyPreference}
              onValueChange={(value) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  shinyPreference: value as ShinyPreference,
                }))
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="both" />
                <Label htmlFor="both" className="cursor-pointer font-normal">
                  Both (Normal & Shiny)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="shiny" id="shiny" />
                <Label htmlFor="shiny" className="cursor-pointer font-normal">
                  Shiny Only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="cursor-pointer font-normal">
                  Normal Only
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Generation Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-heading font-semibold">
                Generations
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllGenerations}
                  className="text-xs cursor-pointer"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllGenerations}
                  className="text-xs cursor-pointer"
                >
                  Clear
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto border rounded-md p-3">
              {availableGenerations.map((gen) => {
                const genRoman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][gen - 1] || gen.toString();
                const isChecked = localSettings.selectedGenerations.includes(gen);
                return (
                  <div
                    key={gen}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`gen-${gen}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleGeneration(gen)}
                    />
                    <Label
                      htmlFor={`gen-${gen}`}
                      className="cursor-pointer font-normal text-sm"
                    >
                      Gen {genRoman}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="cursor-pointer"
            style={{
              backgroundColor: primaryColor || undefined,
              color: primaryColor
                ? getTextColor(primaryColor)
                : undefined,
            }}
          >
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to determine text color
function getTextColor(hex: string): "#ffffff" | "#000000" {
  const hexClean = hex.replace("#", "");
  const r = parseInt(hexClean.substring(0, 2), 16);
  const g = parseInt(hexClean.substring(2, 4), 16);
  const b = parseInt(hexClean.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

