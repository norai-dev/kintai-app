import type { BreakRecord } from "@/types/database";

export function getTotalBreakMinutes(breaks: BreakRecord[]): number {
  return breaks.reduce((sum, b) => {
    if (!b.break_end) {
      // 進行中の休憩: 現在時刻まで
      return sum + Math.floor((Date.now() - new Date(b.break_start).getTime()) / 60000);
    }
    return sum + Math.floor((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000);
  }, 0);
}
