/**
 * 36協定対応の残業アラートユーティリティ
 *
 * 法令基準:
 * - 月45h: 特別条項なし上限
 * - 月80h: 複数月平均の過労死ライン
 * - 年360h: 年間上限
 */

export type OvertimeLevel = "normal" | "warning" | "caution" | "danger";

export type OvertimeThresholdResult = {
  level: OvertimeLevel;
  label: string;
  /** variant for shadcn/ui Badge */
  badgeVariant: "secondary" | "outline" | "default" | "destructive";
  /** Tailwind class for custom coloring (orange is not a built-in variant) */
  badgeClassName: string;
};

/** 月間残業時間に対する段階的アラートレベルを返す */
export function getMonthlyOvertimeLevel(hours: number): OvertimeThresholdResult {
  if (hours >= 45) {
    return {
      level: "danger",
      label: "45h超過",
      badgeVariant: "destructive",
      badgeClassName: "",
    };
  }
  if (hours >= 40) {
    return {
      level: "caution",
      label: "注意 (40h+)",
      badgeVariant: "outline",
      badgeClassName: "border-orange-400 text-orange-600 bg-orange-50",
    };
  }
  if (hours >= 30) {
    return {
      level: "warning",
      label: "注意 (30h+)",
      badgeVariant: "outline",
      badgeClassName: "border-yellow-400 text-yellow-700 bg-yellow-50",
    };
  }
  return {
    level: "normal",
    label: "正常",
    badgeVariant: "secondary",
    badgeClassName: "",
  };
}

/** 複数月平均残業時間に対するアラートレベルを返す */
export function getMultiMonthAverageLevel(avgHours: number): OvertimeThresholdResult {
  if (avgHours >= 80) {
    return {
      level: "danger",
      label: `平均${avgHours.toFixed(1)}h (80h超)`,
      badgeVariant: "destructive",
      badgeClassName: "",
    };
  }
  if (avgHours >= 60) {
    return {
      level: "caution",
      label: `平均${avgHours.toFixed(1)}h (60h+)`,
      badgeVariant: "outline",
      badgeClassName: "border-orange-400 text-orange-600 bg-orange-50",
    };
  }
  return {
    level: "normal",
    label: "正常",
    badgeVariant: "secondary",
    badgeClassName: "",
  };
}

/** 年間残業時間に対するアラートレベルを返す */
export function getAnnualOvertimeLevel(hours: number): OvertimeThresholdResult {
  if (hours >= 360) {
    return {
      level: "danger",
      label: `${hours}h / 360h`,
      badgeVariant: "destructive",
      badgeClassName: "",
    };
  }
  if (hours >= 300) {
    return {
      level: "caution",
      label: `${hours}h / 360h`,
      badgeVariant: "outline",
      badgeClassName: "border-orange-400 text-orange-600 bg-orange-50",
    };
  }
  if (hours >= 240) {
    return {
      level: "warning",
      label: `${hours}h / 360h`,
      badgeVariant: "outline",
      badgeClassName: "border-yellow-400 text-yellow-700 bg-yellow-50",
    };
  }
  return {
    level: "normal",
    label: `${hours}h / 360h`,
    badgeVariant: "secondary",
    badgeClassName: "",
  };
}

/** 年間進捗率 (0–100) */
export function annualProgressPercent(annualHours: number): number {
  return Math.min(100, Math.round((annualHours / 360) * 100));
}
