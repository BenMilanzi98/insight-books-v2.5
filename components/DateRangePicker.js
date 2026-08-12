"use client";

/**
 * Legacy DateRangePicker — now a thin wrapper around the Dashboard-standard
 * UniversalDateRangeFilter so all date menus share one design.
 */
import UniversalDateRangeFilter from "@/components/UniversalDateRangeFilter";

const DateRangePicker = ({
  timeframe,
  onTimeframeChange,
  onCustomRangeChange,
  disabled = false,
  className = "",
}) => {
  return (
    <UniversalDateRangeFilter
      timeframe={timeframe}
      onTimeframeChange={onTimeframeChange}
      onCustomDateChange={
        onCustomRangeChange
          ? (range) => onCustomRangeChange(range.startDate, range.endDate)
          : undefined
      }
      showRefresh={false}
      disabled={disabled}
      className={className}
      size="default"
      variant="default"
    />
  );
};

export default DateRangePicker;
