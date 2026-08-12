"use client";

/**
 * Legacy DateRangeSelector — delegates to UniversalDateRangeFilter (Dashboard design).
 */
import UniversalDateRangeFilter from "@/components/UniversalDateRangeFilter";

export const DateRangeSelector = ({
  timeframe,
  onTimeframeChange,
  onCustomDateChange,
  disabled = false,
  className = "",
}) => {
  return (
    <UniversalDateRangeFilter
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onCustomDateChange={onCustomDateChange}
      showRefresh={false}
      disabled={disabled}
      className={className}
      size="default"
      variant="default"
    />
  );
};

export default DateRangeSelector;
