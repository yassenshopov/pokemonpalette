"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Activity } from "lucide-react";

interface ColorShowcaseProps {
  primaryColor: string;
  secondaryColor: string;
}

export function ColorShowcase({
  primaryColor,
  secondaryColor,
}: ColorShowcaseProps) {
  return (
    <div className="w-full max-w-6xl mx-auto px-12 py-12">
      <h2 className="text-2xl font-bold font-heading mb-8">Color Showcase</h2>

      {/* Bento Grid - 1/3 + 2/3, then 2/3 + 1/3 */}
      <div className="grid grid-cols-3 gap-6">
        {/* Row 1: Badges (1/3) */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">Badges</CardTitle>
            <CardDescription className="text-xs">
              Color variations
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge style={{ backgroundColor: primaryColor, color: "white" }}>
              Primary
            </Badge>
            <Badge
              variant="secondary"
              style={{ backgroundColor: secondaryColor, color: "white" }}
            >
              Secondary
            </Badge>
            <Badge
              variant="outline"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              Outline
            </Badge>
          </CardContent>
        </Card>

        {/* Row 1: Buttons + Progress (2/3) */}
        <Card className="shadow-none col-span-2">
          <CardHeader>
            <CardTitle>Interactive Elements</CardTitle>
            <CardDescription>Buttons and progress indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-3">
              <Button
                className="shadow-none"
                style={{ backgroundColor: primaryColor, color: "white" }}
              >
                Primary Action
              </Button>
              <Button
                variant="outline"
                className="shadow-none"
                style={{ borderColor: secondaryColor, color: secondaryColor }}
              >
                Secondary Action
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm mb-2">Progress</p>
                <Progress value={65} style={{ accentColor: primaryColor }} />
              </div>
              <div>
                <Progress value={40} style={{ accentColor: secondaryColor }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 2: Stats (2/3) */}
        <Card
          className="shadow-none col-span-2"
          style={{ borderColor: primaryColor }}
        >
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Analytics overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-5xl font-bold"
                  style={{ color: primaryColor }}
                >
                  1,234
                </p>
                <p className="text-sm text-muted-foreground">Total views</p>
              </div>
              <TrendingUp
                className="h-12 w-12"
                style={{ color: secondaryColor }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Row 2: Activity (1/3) */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">Activity</CardTitle>
            <CardDescription className="text-xs">
              Latest updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
                <span className="text-sm">Feature added</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: secondaryColor }}
                />
                <span className="text-sm">System updated</span>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4" style={{ color: primaryColor }} />
                <span className="text-sm">Performance</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
