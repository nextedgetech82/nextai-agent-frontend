export type AnalyticsChartType = 'bar' | 'line' | 'donut';

export interface AnalyticsChartPoint {
  label: string;
  value: number;
}

export interface AnalyticsChart {
  type?: AnalyticsChartType;
  title?: string;
  subtitle?: string;
  labelKey?: string;
  valueKey?: string;
  points?: AnalyticsChartPoint[];
  labels?: string[];
  values?: number[];
}

export interface AnalyticsChartConfigOptions {
  isStacked?: boolean;
  showLegend?: boolean;
  tooltipFormat?: string;
}

export interface AnalyticsChartConfig {
  chartType?: string;
  title?: string;
  xAxis?: string;
  yAxis?: string;
  explanation?: string;
  options?: AnalyticsChartConfigOptions;
}

export interface AnalyticsResponse {
  success: boolean;
  query: string;
  sqlQuery: string;
  data: any[];
  insights: string;
  chart?: AnalyticsChart;
  chartConfig?: AnalyticsChartConfig;
  rowCount: number;
  processingTime?: number;
  timestamp: string;
  cached?: boolean;
  error?: string;
}
