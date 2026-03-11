// Generate tomorrow's time slot options for callback scheduling
// Only provide ONE day (tomorrow) with 3 time slots to filter high-intent customers

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export interface TimeSlot {
  date: string;       // e.g. "2/24（一）"
  fullDate: string;   // e.g. "2026-02-24"
  dayOfWeek: string;  // e.g. "一"
  slots: string[];    // e.g. ["上午 10:00-12:00", "下午 2:00-5:00", "晚上 7:00-9:00"]
}

/**
 * Get tomorrow's date with 3 time slots.
 * If tomorrow is Sunday, use the day after (Monday).
 * Only ONE day is returned to filter high-intent customers:
 * - Willing to schedule tomorrow = high purchase intent
 * - Not willing = likely just browsing
 */
export function getTomorrowSlots(): TimeSlot {
  const now = new Date();
  // Use Taiwan timezone (UTC+8)
  const taiwanOffset = 8 * 60 * 60 * 1000;
  const taiwanNow = new Date(now.getTime() + taiwanOffset + now.getTimezoneOffset() * 60 * 1000);
  
  let dayOffset = 1; // Start from tomorrow
  
  // Find the next non-Sunday day
  for (let i = 0; i < 3; i++) {
    const targetDate = new Date(taiwanNow);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dayOfWeek = targetDate.getDay();
    
    if (dayOfWeek !== 0) {
      // Not Sunday, use this day
      const month = targetDate.getMonth() + 1;
      const day = targetDate.getDate();
      const weekdayName = WEEKDAY_NAMES[dayOfWeek];
      const fullDate = `${targetDate.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      return {
        date: `${month}/${day}（${weekdayName}）`,
        fullDate,
        dayOfWeek: weekdayName,
        slots: [
          "上午 10:30-11:30",
          "下午 2:00-3:00",
          "晚上 6:00-7:00",
        ],
      };
    }
    
    dayOffset++;
  }
  
  // Fallback (should never reach here)
  const fallback = new Date(taiwanNow);
  fallback.setDate(fallback.getDate() + 1);
  const month = fallback.getMonth() + 1;
  const day = fallback.getDate();
  return {
    date: `${month}/${day}（${WEEKDAY_NAMES[fallback.getDay()]}）`,
    fullDate: `${fallback.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    dayOfWeek: WEEKDAY_NAMES[fallback.getDay()],
    slots: ["上午 10:30-11:30", "下午 2:00-3:00", "晚上 6:00-7:00"],
  };
}

/**
 * Format tomorrow's time slots into a readable string for AI prompt
 */
export function formatTimeSlotsForPrompt(): string {
  const day = getTomorrowSlots();
  
  return `明天 ${day.date}：\n① ${day.slots[0]}\n② ${day.slots[1]}\n③ ${day.slots[2]}`;
}
