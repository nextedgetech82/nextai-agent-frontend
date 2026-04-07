import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import {
  AnalyticsChart,
  AnalyticsChartConfig,
  AnalyticsChartPoint,
  AnalyticsChartType,
} from '../../models/analytics-response';
import { ChatMessage } from '../../services/chatbot';

interface ChartDatum {
  color: string;
  label: string;
  percentage: number;
  value: number;
}

interface ChartSeriesDatum {
  color: string;
  key: string;
  points: ChartDatum[];
}

interface DonutSegment extends ChartDatum {
  dashArray: string;
  dashOffset: string;
}

interface LineSeriesDatum {
  color: string;
  key: string;
  path: string;
  points: { cx: number; cy: number; label: string; value: number }[];
}

interface SummaryMetric {
  label: string;
  value: string;
}

interface ChartTab {
  id: string;
  label: string;
  companyName?: string;
}

interface ResolvedChart {
  labelKey?: string;
  points: AnalyticsChartPoint[];
  series?: { key: string; points: AnalyticsChartPoint[] }[];
  subtitle?: string;
  title?: string;
  type: AnalyticsChartType;
  valueKey?: string;
}

const CHART_COLORS = ['#0d6efd', '#20c997', '#fd7e14', '#6f42c1', '#dc3545', '#198754', '#6610f2', '#ffc107'];
const AGGREGATABLE_METRIC_TOKENS = [
  'qty',
  'quantity',
  'pcs',
  'piece',
  'pieces',
  'meter',
  'meters',
  'mtr',
  'mtrs',
  'amount',
  'amt',
  'discamt',
  'discamt2',
  'discamt3',
  'addamt',
  'addamt2',
  'taxablevalue',
  'taxableamt',
  'sgstamt',
  'cgstamt',
  'igstamt',
  'finalamt',
  'grossamt',
  'netamt',
  'retamt',
  'recamt',
  'djvamt',
  'cjavamt',
  'dramt',
  'cramt',
  'adjamt',
  'sale',
  'sales',
  'purchase',
  'return',
  'discount',
  'tax',
  'value',
  'gross',
  'net',
  'final',
  'receipt',
  'receivable',
];
const NON_AGGREGATABLE_NUMBER_TOKENS = [
  'id',
  'code',
  'orderno',
  'ordernumber',
  'serialno',
  'srno',
  'billno',
  'billnumber',
  'voucherno',
  'voucherno',
  'docno',
  'documentno',
  'challanno',
  'invoiceno',
  'companycode',
];

@Component({
  selector: 'app-chat-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-message.html',
  styleUrls: ['./chat-message.css'],
})
export class ChatMessageComponent implements OnInit, OnChanges {
  @Input() message!: ChatMessage;

  expandedSql = false;
  showDataTable = false;
  formattedContent = '';
  currentPage = 1;
  readonly pageSize = 10;
  sortColumn: string | null = null;
  sortDirection: 'asc' | 'desc' = 'asc';
  expandedCells = new Set<string>();
  columnFilters: Record<string, string> = {};
  chartTabs: ChartTab[] = [];
  activeChartTab = 'merged';
  tableTabs: ChartTab[] = [];
  activeTableTab = 'merged';

  chartType: AnalyticsChartType | null = null;
  chartData: ChartDatum[] = [];
  chartSeries: ChartSeriesDatum[] = [];
  selectedChartSeriesKeys = new Set<string>();
  supportedChartTypes: AnalyticsChartType[] = [];
  selectedChartTypeOverride: AnalyticsChartType | null = null;
  chartLabelKey: string | null = null;
  chartValueKey: string | null = null;
  chartTitle = '';
  chartSubtitle = '';
  linePath = '';
  lineAreaPath = '';
  linePoints: { cx: number; cy: number; label: string; value: number }[] = [];
  lineSeries: LineSeriesDatum[] = [];
  donutSegments: DonutSegment[] = [];
  donutCircumference = 2 * Math.PI * 42;
  donutRadius = 42;
  lineChartWidth = 320;
  lineChartHeight = 180;

  ngOnInit(): void {
    this.initializeMessageState();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.initializeMessageState();
  }

  get hasChart(): boolean {
    return (!!this.chartType && this.chartData.length > 1) || this.chartSeries.length > 0;
  }

  get isBarChart(): boolean {
    return this.chartType === 'bar';
  }

  get hasGroupedBarChart(): boolean {
    return this.chartSeries.length > 0;
  }

  get hasSeriesSelector(): boolean {
    return this.chartSeries.length > 1;
  }

  get hasChartTypeSelector(): boolean {
    return this.supportedChartTypes.length > 1;
  }

  get visibleChartSeries(): ChartSeriesDatum[] {
    if (!this.chartSeries.length) {
      return [];
    }

    const visibleSeries = this.chartSeries.filter((series) =>
      this.selectedChartSeriesKeys.has(series.key),
    );

    return visibleSeries.length ? visibleSeries : [this.chartSeries[0]];
  }

  get visibleLineSeries(): LineSeriesDatum[] {
    if (!this.lineSeries.length) {
      return [];
    }

    const visibleSeries = this.lineSeries.filter((series) =>
      this.selectedChartSeriesKeys.has(series.key),
    );

    return visibleSeries.length ? visibleSeries : [this.lineSeries[0]];
  }

  get hasMultiSeriesLineChart(): boolean {
    return this.isLineChart && this.lineSeries.length > 0;
  }

  get isLineChart(): boolean {
    return this.chartType === 'line';
  }

  get isDonutChart(): boolean {
    return this.chartType === 'donut';
  }

  private initializeMessageState(): void {
    this.currentPage = 1;
    this.expandedCells.clear();
    this.columnFilters = {};
    this.initializeChartTabs();
    this.initializeTableTabs();
    this.formattedContent =
      this.message.type === 'bot' && this.message.insights
        ? this.formatInsights(this.message.insights)
        : '';

    this.buildChartState();
  }

  private initializeChartTabs(): void {
    const companyNames = this.getDistinctCompanyNames();
    this.chartTabs =
      companyNames.length > 1
        ? [
            ...companyNames.map((companyName) => ({
              id: `company:${companyName}`,
              label: companyName,
              companyName,
            })),
            { id: 'merged', label: 'Merge Data' },
          ]
        : [{ id: 'merged', label: 'Merge Data' }];

    if (!this.chartTabs.some((tab) => tab.id === this.activeChartTab)) {
      this.activeChartTab = 'merged';
    }
  }

  private initializeTableTabs(): void {
    const companyNames = this.getDistinctCompanyNames();
    this.tableTabs =
      companyNames.length > 1
        ? [
            ...companyNames.map((companyName) => ({
              id: `company:${companyName}`,
              label: companyName,
              companyName,
            })),
            { id: 'merged', label: 'Merge Data' },
          ]
        : [{ id: 'merged', label: 'Merge Data' }];

    if (!this.tableTabs.some((tab) => tab.id === this.activeTableTab)) {
      this.activeTableTab = 'merged';
    }
  }

  private getDistinctCompanyNames(): string[] {
    const rows = this.message?.data ?? [];
    if (!rows.length) {
      return [];
    }

    const sampleRow = rows.find((row) => row && typeof row === 'object');
    const columns = sampleRow ? Object.keys(sampleRow) : [];
    const companyColumn = columns.find((column) => column.toLowerCase() === 'company_name');
    if (!companyColumn) {
      return [];
    }

    return Array.from(
      new Set(rows.map((row) => this.formatChartLabel(row?.[companyColumn])).filter((value) => value)),
    );
  }

  private getRowsForActiveChartTab(): any[] {
    const rows = this.message?.data ?? [];
    if (this.activeChartTab === 'merged') {
      return rows;
    }

    const activeTab = this.chartTabs.find((tab) => tab.id === this.activeChartTab);
    if (!activeTab?.companyName) {
      return rows;
    }

    return rows.filter((row) => this.formatChartLabel(row?.company_name) === activeTab.companyName);
  }

  private getRowsForActiveTableTab(): any[] {
    const rows = this.message?.data ?? [];
    if (this.activeTableTab === 'merged') {
      return rows;
    }

    const activeTab = this.tableTabs.find((tab) => tab.id === this.activeTableTab);
    if (!activeTab?.companyName) {
      return rows;
    }

    return rows.filter((row) => this.formatChartLabel(row?.company_name) === activeTab.companyName);
  }

  private buildChartState(): void {
    this.resetChartState();

    if (this.message.type !== 'bot') {
      return;
    }

    const chartRows = this.getRowsForActiveChartTab();
    const explicitChart = this.normalizeExplicitChartConfig(this.message.chartConfig, chartRows)
      ?? this.normalizeExplicitChart(this.message.chart);
    const resolvedChart = explicitChart ?? this.deriveChartFromData(chartRows);

    if (!resolvedChart || resolvedChart.points.length < 2) {
      return;
    }

    this.supportedChartTypes = this.getSupportedChartTypes(resolvedChart);
    const chartType =
      this.selectedChartTypeOverride && this.supportedChartTypes.includes(this.selectedChartTypeOverride)
        ? this.selectedChartTypeOverride
        : resolvedChart.type;

    this.applyResolvedChart({
      ...resolvedChart,
      type: chartType,
    });
  }

  private resetChartState(): void {
    this.chartType = null;
    this.chartData = [];
    this.chartSeries = [];
    this.selectedChartSeriesKeys.clear();
    this.supportedChartTypes = [];
    this.chartLabelKey = null;
    this.chartValueKey = null;
    this.chartTitle = '';
    this.chartSubtitle = '';
    this.linePath = '';
    this.lineAreaPath = '';
    this.linePoints = [];
    this.lineSeries = [];
    this.donutSegments = [];
  }

  private applyResolvedChart(resolvedChart: ResolvedChart): void {
    this.chartType = resolvedChart.type;
    this.chartLabelKey = resolvedChart.labelKey ?? null;
    this.chartValueKey = resolvedChart.valueKey ?? null;
    this.chartTitle = resolvedChart.title ?? '';
    this.chartSubtitle = resolvedChart.subtitle ?? '';

    if (resolvedChart.series?.length) {
      if (this.chartType === 'line') {
        this.buildMultiLineChart(resolvedChart.series);
        return;
      }

      this.buildGroupedBarChart(resolvedChart.series);
      return;
    }

    const maxValue = Math.max(...resolvedChart.points.map((point) => point.value));
    if (!Number.isFinite(maxValue) || maxValue <= 0) {
      return;
    }

    this.chartData = resolvedChart.points.map((point, index) => ({
      color: CHART_COLORS[index % CHART_COLORS.length],
      label: point.label,
      value: point.value,
      percentage: Math.max((point.value / maxValue) * 100, 4),
    }));

    if (this.chartType === 'line') {
      this.buildLineChart();
    }

    if (this.chartType === 'donut') {
      this.buildDonutChart();
    }
  }

  setChartTab(tabId: string): void {
    if (this.activeChartTab !== tabId) {
      this.activeChartTab = tabId;
      this.selectedChartTypeOverride = null;
      this.buildChartState();
    }
  }

  setTableTab(tabId: string): void {
    if (this.activeTableTab !== tabId) {
      this.activeTableTab = tabId;
      this.currentPage = 1;
      this.expandedCells.clear();
    }
  }

  toggleChartSeries(seriesKey: string): void {
    if (this.selectedChartSeriesKeys.has(seriesKey)) {
      if (this.selectedChartSeriesKeys.size === 1) {
        return;
      }

      this.selectedChartSeriesKeys.delete(seriesKey);
      return;
    }

    this.selectedChartSeriesKeys.add(seriesKey);
  }

  setChartType(chartType: AnalyticsChartType): void {
    if (!this.supportedChartTypes.includes(chartType)) {
      return;
    }

    this.selectedChartTypeOverride = chartType;
    this.buildChartState();
  }

  getChartTypeLabel(chartType: AnalyticsChartType): string {
    if (chartType === 'donut') {
      return 'Pie';
    }

    return this.titlecase(chartType);
  }

  private normalizeExplicitChart(chart?: AnalyticsChart): ResolvedChart | null {
    if (!chart) {
      return null;
    }

    const points = this.extractChartPoints(chart);
    const type = this.normalizeChartType(chart.type);

    if (!type || points.length < 2) {
      return null;
    }

    return {
      type,
      title: chart.title,
      subtitle: chart.subtitle,
      labelKey: chart.labelKey,
      valueKey: chart.valueKey,
      points,
    };
  }

  private normalizeExplicitChartConfig(
    chartConfig: AnalyticsChartConfig | undefined,
    rows: any[],
  ): ResolvedChart | null {
    if (!chartConfig || !rows.length) {
      return null;
    }

    const type = this.normalizeChartType(chartConfig.chartType);
    const labelKey = this.getPreferredChartLabelKey(
      rows,
      this.findColumnKey(rows, chartConfig.xAxis),
    );
    const valueKey = this.findColumnKey(rows, chartConfig.yAxis);

    if (!type || !labelKey || !valueKey) {
      return null;
    }

    const points = rows
      .map((row) => ({
        label: this.formatChartLabel(row?.[labelKey]),
        value: this.toNumericValue(row?.[valueKey]),
      }))
      .filter((point) => point.label && Number.isFinite(point.value));

    if (points.length < 2) {
      return null;
    }

    return {
      type,
      title: chartConfig.title || `${this.titlecase(valueKey)} by ${this.titlecase(labelKey)}`,
      subtitle: chartConfig.explanation,
      labelKey,
      valueKey,
      points,
    };
  }

  private deriveChartFromData(rows: any[]): ResolvedChart | null {
    if (!rows?.length) {
      return null;
    }

    const sampleRow = rows.find((row) => row && typeof row === 'object');
    if (!sampleRow) {
      return null;
    }

    const columns = Object.keys(sampleRow);
    const numericColumns = columns.filter((column) =>
      rows.some(
        (row) => Number.isFinite(this.toNumericValue(row?.[column])),
      ),
    );
    const aggregatableNumericColumns = this.getAggregatableNumericColumns(columns);
    const chartNumericColumns =
      aggregatableNumericColumns.length > 0
        ? aggregatableNumericColumns
        : numericColumns.filter((column) => !this.isNonAggregatableNumberColumn(column));
    const labelColumns = columns.filter((column) =>
      rows.some((row) => this.isLabelLike(row?.[column])),
    );

    const labelKey =
      this.getPreferredChartLabelKey(
        rows,
        labelColumns.find((column) => !chartNumericColumns.includes(column)) ||
          labelColumns[0] ||
          columns.find((column) => !chartNumericColumns.includes(column)),
      );
    const valueKey = chartNumericColumns[0];

    if (!labelKey || !valueKey) {
      return null;
    }

    if (chartNumericColumns.length > 1) {
      const limitedRows = rows.slice(0, this.isDateLikeColumn(labelKey) ? 12 : 8);
      const series = chartNumericColumns
        .map((column) => ({
          key: column,
          points: limitedRows
            .map((row) => ({
              label: this.formatChartLabel(row?.[labelKey]),
              value: this.toNumericValue(row?.[column]),
            }))
            .filter((point) => point.label && Number.isFinite(point.value)),
        }))
        .filter((entry) => entry.points.length >= 2);

      if (series.length >= 2) {
        return {
          type: 'bar',
          title: chartNumericColumns.map((column) => this.titlecase(column)).join(' vs '),
          subtitle: `Grouped by ${this.titlecase(labelKey)}`,
          labelKey,
          valueKey,
          series,
          points: series[0].points,
        };
      }
    }

    const points = rows
      .map((row) => ({
        label: this.formatChartLabel(row?.[labelKey]),
        value: this.toNumericValue(row?.[valueKey]),
      }))
      .filter((point) => point.label && Number.isFinite(point.value))
      .slice(0, this.isDateLikeColumn(labelKey) ? 12 : 8);

    if (points.length < 2) {
      return null;
    }

    const type = this.pickHeuristicChartType(labelKey, points);

    return {
      type,
      title: `${this.titlecase(valueKey)} by ${this.titlecase(labelKey)}`,
      labelKey,
      valueKey,
      points,
    };
  }

  private aggregatePointsByLabel(labelKey: string, valueKey: string): AnalyticsChartPoint[] {
    const totals = new Map<string, number>();

    for (const row of this.message.data ?? []) {
      const label = this.formatChartLabel(row?.[labelKey]);
      const value = this.toNumericValue(row?.[valueKey]);

      if (!label || !Number.isFinite(value)) {
        continue;
      }

      totals.set(label, (totals.get(label) ?? 0) + value);
    }

    return Array.from(totals.entries()).map(([label, value]) => ({ label, value }));
  }

  private extractChartPoints(chart: AnalyticsChart): AnalyticsChartPoint[] {
    if (chart.points?.length) {
      return chart.points
        .map((point) => ({
          label: this.formatChartLabel(point.label),
          value: this.toNumericValue(point.value),
        }))
        .filter((point) => point.label && Number.isFinite(point.value));
    }

    if (chart.labels?.length && chart.values?.length) {
      return chart.labels
        .map((label, index) => ({
          label: this.formatChartLabel(label),
          value: this.toNumericValue(chart.values?.[index]),
        }))
        .filter((point) => point.label && Number.isFinite(point.value));
    }

    return [];
  }

  private buildLineChart(): void {
    const width = this.lineChartWidth;
    const height = this.lineChartHeight;
    const left = 12;
    const right = 12;
    const top = 14;
    const bottom = 26;
    const maxValue = Math.max(...this.chartData.map((point) => point.value));
    const stepX = this.chartData.length > 1 ? (width - left - right) / (this.chartData.length - 1) : 0;

    this.linePoints = this.chartData.map((point, index) => {
      const cx = left + index * stepX;
      const normalized = maxValue === 0 ? 0 : point.value / maxValue;
      const cy = height - bottom - normalized * (height - top - bottom);

      return { cx, cy, label: point.label, value: point.value };
    });

    this.linePath = this.linePoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.cx} ${point.cy}`)
      .join(' ');

    const firstPoint = this.linePoints[0];
    const lastPoint = this.linePoints[this.linePoints.length - 1];
    this.lineAreaPath = `${this.linePath} L ${lastPoint.cx} ${height - bottom} L ${firstPoint.cx} ${height - bottom} Z`;
  }

  private buildMultiLineChart(series: { key: string; points: AnalyticsChartPoint[] }[]): void {
    const width = this.lineChartWidth;
    const height = this.lineChartHeight;
    const left = 12;
    const right = 12;
    const top = 14;
    const bottom = 26;
    const maxValue = Math.max(...series.flatMap((entry) => entry.points.map((point) => point.value)));

    if (!Number.isFinite(maxValue) || maxValue <= 0) {
      return;
    }

    this.chartSeries = series.map((entry, index) => ({
      key: entry.key,
      color: CHART_COLORS[index % CHART_COLORS.length],
      points: entry.points.map((point) => ({
        label: point.label,
        value: point.value,
        color: CHART_COLORS[index % CHART_COLORS.length],
        percentage: Math.max((point.value / maxValue) * 100, 4),
      })),
    }));

    this.selectedChartSeriesKeys = new Set(this.chartSeries.map((entry) => entry.key));

    const stepX =
      this.chartSeries[0]?.points.length && this.chartSeries[0].points.length > 1
        ? (width - left - right) / (this.chartSeries[0].points.length - 1)
        : 0;

    this.lineSeries = this.chartSeries.map((seriesEntry) => {
      const points = seriesEntry.points.map((point, index) => {
        const cx = left + index * stepX;
        const normalized = maxValue === 0 ? 0 : point.value / maxValue;
        const cy = height - bottom - normalized * (height - top - bottom);

        return { cx, cy, label: point.label, value: point.value };
      });

      const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.cx} ${point.cy}`).join(' ');

      return {
        key: seriesEntry.key,
        color: seriesEntry.color,
        path,
        points,
      };
    });

    this.linePoints = this.lineSeries[0]?.points ?? [];
  }

  private buildGroupedBarChart(series: { key: string; points: AnalyticsChartPoint[] }[]): void {
    const maxValue = Math.max(
      ...series.flatMap((entry) => entry.points.map((point) => point.value)),
    );

    if (!Number.isFinite(maxValue) || maxValue <= 0) {
      return;
    }

    this.chartSeries = series.map((entry, index) => ({
      key: entry.key,
      color: CHART_COLORS[index % CHART_COLORS.length],
      points: entry.points.map((point) => ({
        label: point.label,
        value: point.value,
        color: CHART_COLORS[index % CHART_COLORS.length],
        percentage: Math.max((point.value / maxValue) * 100, 4),
      })),
    }));

    this.selectedChartSeriesKeys = new Set(this.chartSeries.map((entry) => entry.key));
  }

  private buildDonutChart(): void {
    const total = this.chartData.reduce((sum, point) => sum + point.value, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return;
    }

    let cumulative = 0;
    this.donutSegments = this.chartData.map((point) => {
      const fraction = point.value / total;
      const dash = fraction * this.donutCircumference;
      const segment: DonutSegment = {
        ...point,
        dashArray: `${dash.toFixed(2)} ${(this.donutCircumference - dash).toFixed(2)}`,
        dashOffset: `${(-cumulative).toFixed(2)}`,
      };

      cumulative += dash;
      return segment;
    });
  }

  private getSupportedChartTypes(resolvedChart: ResolvedChart): AnalyticsChartType[] {
    const supportedTypes = new Set<AnalyticsChartType>(['bar']);

    if (resolvedChart.series?.length) {
      if (
        resolvedChart.labelKey &&
        (this.isDateLikeColumn(resolvedChart.labelKey) ||
          resolvedChart.points.every((point) => this.isDateLikeLabel(point.label)))
      ) {
        supportedTypes.add('line');
      }
    } else {
      if (
        resolvedChart.labelKey &&
        (this.isDateLikeColumn(resolvedChart.labelKey) ||
          resolvedChart.points.every((point) => this.isDateLikeLabel(point.label)))
      ) {
        supportedTypes.add('line');
      }

      if (resolvedChart.points.length >= 2 && resolvedChart.points.length <= 8) {
        supportedTypes.add('donut');
      }
    }

    supportedTypes.add(resolvedChart.type);

    const orderedTypes: AnalyticsChartType[] = ['bar', 'line', 'donut'];
    return orderedTypes.filter((type) => supportedTypes.has(type));
  }

  private findColumnKey(rows: any[], requestedKey?: string): string | null {
    if (!requestedKey || !rows.length) {
      return null;
    }

    const sampleRow = rows.find((row) => row && typeof row === 'object');
    if (!sampleRow) {
      return null;
    }

    const columns = Object.keys(sampleRow);
    const normalizedRequestedKey = requestedKey.trim().toLowerCase();

    return (
      columns.find((column) => column.toLowerCase() === normalizedRequestedKey) ??
      columns.find((column) => column.replace(/[_\s-]+/g, '').toLowerCase() === normalizedRequestedKey.replace(/[_\s-]+/g, '')) ??
      null
    );
  }

  private getPreferredChartLabelKey(rows: any[], labelKey: string | null | undefined): string | null {
    if (!labelKey) {
      return null;
    }

    const sampleRow = rows.find((row) => row && typeof row === 'object');
    if (!sampleRow) {
      return labelKey;
    }

    const columns = Object.keys(sampleRow);
    const normalizedLabelKey = this.normalizeColumnKey(labelKey);
    const companyNameColumn = columns.find((column) => this.normalizeColumnKey(column) === 'companyname');

    if (normalizedLabelKey === 'companyid' && companyNameColumn) {
      return companyNameColumn;
    }

    if (normalizedLabelKey !== 'companyname' && companyNameColumn && columns.some((column) => this.normalizeColumnKey(column) === 'companyid')) {
      return labelKey;
    }

    return labelKey;
  }

  private pickHeuristicChartType(labelKey: string, points: AnalyticsChartPoint[]): AnalyticsChartType {
    if (this.isDateLikeColumn(labelKey) || points.every((point) => this.isDateLikeLabel(point.label))) {
      return 'line';
    }

    if (points.length <= 6) {
      return 'donut';
    }

    return 'bar';
  }

  private normalizeChartType(type?: string): AnalyticsChartType | null {
    if (type === 'bar' || type === 'line' || type === 'donut') {
      return type;
    }

    if (type === 'pie') {
      return 'donut';
    }

    if (type === 'horizontalBar' || type === 'horizontalbar' || type === 'horizontal-bar') {
      return 'bar';
    }

    return null;
  }

  private isDateLikeColumn(column: string): boolean {
    const normalized = column.toLowerCase();
    return ['date', 'day', 'month', 'year', 'week', 'time'].some((token) => normalized.includes(token));
  }

  private isDateLikeLabel(value: string): boolean {
    const normalized = value.trim().toLowerCase();

    if (!normalized) {
      return false;
    }

    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    if (monthNames.some((month) => normalized.includes(month))) {
      return true;
    }

    return !Number.isNaN(Date.parse(value));
  }

  private isLabelLike(value: unknown): boolean {
    return typeof value === 'string' || value instanceof Date;
  }

  private toNumericValue(value: unknown): number {
    return typeof value === 'number' ? value : Number(value);
  }

  private formatChartLabel(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    const formattedDate = this.formatDateLikeValue(value);
    if (formattedDate) {
      return formattedDate;
    }

    return String(value).trim();
  }

  private formatDateLikeValue(value: unknown): string | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return this.formatDisplayDate(value);
    }

    if (typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue || Number.isNaN(Date.parse(trimmedValue))) {
      return null;
    }

    const looksLikeIsoDate =
      /^\d{4}-\d{2}-\d{2}(?:[tT ].*)?$/.test(trimmedValue) ||
      /^\d{4}\/\d{2}\/\d{2}(?: .*)?$/.test(trimmedValue);

    return looksLikeIsoDate ? this.formatDisplayDate(trimmedValue) : null;
  }

  private formatDisplayDate(value: string | Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    })
      .format(new Date(value))
      .replace(/\s+/g, '-');
  }

  private titlecase(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatChartValue(value: number): string {
    if (!Number.isFinite(value)) {
      return '';
    }

    return new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  formatInsights(insights: string): string {
    if (!insights) return '';
    return insights
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  getColumns(data: any[]): string[] {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]);
  }

  get summaryMetrics(): SummaryMetric[] {
    const rows = this.tableRows;
    if (!rows.length) {
      return [];
    }

    const metrics: SummaryMetric[] = [{ label: 'Rows', value: String(rows.length) }];
    const columns = this.getColumns(rows);
    const numericColumns = this.getAggregatableNumericColumns(columns);

    for (const column of numericColumns.slice(0, 2)) {
      const total = rows.reduce((sum, row) => {
        const numericValue = this.toNumericValue(row?.[column]);
        return Number.isFinite(numericValue) ? sum + numericValue : sum;
      }, 0);

      metrics.push({
        label: `${this.titlecase(column)} Total`,
        value: this.formatTableNumber(total),
      });
    }

    const labelColumn = columns.find((column) => !this.isNumericColumn(column));
    const primaryNumericColumn = numericColumns[0];

    if (labelColumn && primaryNumericColumn) {
      const topRow = [...rows]
        .filter((row) => Number.isFinite(this.toNumericValue(row?.[primaryNumericColumn])))
        .sort(
          (left, right) =>
            this.toNumericValue(right?.[primaryNumericColumn]) -
            this.toNumericValue(left?.[primaryNumericColumn]),
        )[0];

      if (topRow) {
        metrics.push({
          label: `Top ${this.titlecase(labelColumn)}`,
          value: this.formatChartLabel(topRow[labelColumn]),
        });
      }
    }

    return metrics.slice(0, 4);
  }

  get pinnedColumn(): string | null {
    const columns = this.getColumns(this.message?.data ?? []);
    if (!columns.length) {
      return null;
    }

    const preferred = ['month name', 'party name', 'company name'];
    const matched = columns.find((column) => preferred.includes(column.toLowerCase()));
    return matched ?? columns[0];
  }

  get companyColumn(): string | null {
    const columns = this.getColumns(this.message?.data ?? []);
    return columns.find((column) => column.toLowerCase() === 'company_name') ?? null;
  }

  get hasMultiCompanyTable(): boolean {
    return this.tableTabs.length > 1;
  }

  get tableRows(): any[] {
    return this.getRowsForActiveTableTab();
  }

  isNumericColumn(column: string): boolean {
    if (!this.message?.data?.length) {
      return false;
    }

    return this.message.data.some((row) => Number.isFinite(this.toNumericValue(row?.[column])));
  }

  isMetricColumn(column: string): boolean {
    return this.isAggregatableMetricColumn(column);
  }

  isCodeColumn(column: string): boolean {
    const normalized = column.toLowerCase();
    return ['id', 'code', 'uuid', 'ref', 'reference'].some((token) => normalized.includes(token));
  }

  private getAggregatableNumericColumns(columns: string[]): string[] {
    const aggregatableColumns = columns.filter((column) => this.isAggregatableMetricColumn(column));
    if (aggregatableColumns.length) {
      return aggregatableColumns;
    }

    return columns.filter(
      (column) => this.isNumericColumn(column) && !this.isNonAggregatableNumberColumn(column),
    );
  }

  private isAggregatableMetricColumn(column: string): boolean {
    if (!this.isNumericColumn(column)) {
      return false;
    }

    const normalized = this.normalizeColumnKey(column);
    return AGGREGATABLE_METRIC_TOKENS.some((token) => normalized.includes(token));
  }

  private isNonAggregatableNumberColumn(column: string): boolean {
    if (!this.isNumericColumn(column)) {
      return false;
    }

    const normalized = this.normalizeColumnKey(column);
    return NON_AGGREGATABLE_NUMBER_TOKENS.some((token) => normalized.includes(token));
  }

  private normalizeColumnKey(column: string): string {
    return column.replace(/[\s_-]+/g, '').toLowerCase();
  }

  hasNegativeValues(column: string): boolean {
    if (!this.isNumericColumn(column) || !this.message?.data?.length) {
      return false;
    }

    return this.message.data.some((row) => this.toNumericValue(row?.[column]) < 0);
  }

  isNegativeValue(value: unknown, column: string): boolean {
    return this.hasNegativeValues(column) && this.toNumericValue(value) < 0;
  }

  isExpandableColumn(column: string): boolean {
    const normalized = column.toLowerCase();
    return (
      !this.isNumericColumn(column) &&
      ['name', 'description', 'remarks', 'address', 'narration'].some((token) =>
        normalized.includes(token),
      )
    );
  }

  shouldTruncateCell(value: unknown, column: string): boolean {
    return this.isExpandableColumn(column) && String(value ?? '').trim().length > 28;
  }

  toggleCellExpansion(rowIndex: number, column: string): void {
    const cellKey = `${this.currentPage}:${rowIndex}:${column}`;
    if (this.expandedCells.has(cellKey)) {
      this.expandedCells.delete(cellKey);
      return;
    }

    this.expandedCells.add(cellKey);
  }

  isCellExpanded(rowIndex: number, column: string): boolean {
    return this.expandedCells.has(`${this.currentPage}:${rowIndex}:${column}`);
  }

  isPinnedColumn(column: string): boolean {
    return this.pinnedColumn === column;
  }

  getColumnFilterValue(column: string): string {
    return this.columnFilters[column] ?? '';
  }

  updateColumnFilter(column: string, value: string): void {
    this.columnFilters[column] = value;
    this.currentPage = 1;
  }

  formatTableCell(value: unknown, column: string): string {
    if (value === null || value === undefined) {
      return '';
    }

    const formattedDate = this.formatDateLikeValue(value);
    if (formattedDate) {
      return formattedDate;
    }

    if (this.isNumericColumn(column)) {
      const numericValue = this.toNumericValue(value);
      if (Number.isFinite(numericValue)) {
        return this.formatTableNumber(numericValue);
      }
    }

    return String(value);
  }

  private formatTableNumber(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  }

  get totalPages(): number {
    const totalRows = this.sortedRows.length;
    return Math.max(1, Math.ceil(totalRows / this.pageSize));
  }

  get paginatedRows(): any[] {
    if (!this.sortedRows.length) {
      return [];
    }

    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.sortedRows.slice(startIndex, startIndex + this.pageSize);
  }

  get pageStartRow(): number {
    if (!this.sortedRows.length) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEndRow(): number {
    if (!this.sortedRows.length) {
      return 0;
    }

    return Math.min(this.currentPage * this.pageSize, this.sortedRows.length);
  }

  get sortedRows(): any[] {
    const rows = this.filteredRows;
    if (!rows.length || !this.sortColumn) {
      return rows;
    }

    const direction = this.sortDirection === 'asc' ? 1 : -1;
    const column = this.sortColumn;

    return [...rows].sort((left, right) => {
      if (this.isNumericColumn(column)) {
        return (this.toNumericValue(left?.[column]) - this.toNumericValue(right?.[column])) * direction;
      }

      return (
        this.formatChartLabel(left?.[column]).localeCompare(this.formatChartLabel(right?.[column])) *
        direction
      );
    });
  }

  get filteredRows(): any[] {
    const rows = this.tableRows;
    const activeFilters = Object.entries(this.columnFilters).filter(([, value]) => value.trim());

    if (!activeFilters.length) {
      return rows;
    }

    return rows.filter((row) =>
      activeFilters.every(([column, value]) => {
        const filterValue = value.trim().toLowerCase();
        const cellValue = this.formatTableCell(row?.[column], column).toLowerCase();
        return cellValue.includes(filterValue);
      }),
    );
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage -= 1;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage += 1;
    }
  }

  sortBy(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = this.isNumericColumn(column) ? 'desc' : 'asc';
    }

    this.currentPage = 1;
  }

  isSortedBy(column: string): boolean {
    return this.sortColumn === column;
  }

  getSortIcon(column: string): string {
    if (this.sortColumn !== column) {
      return 'bi-arrow-down-up';
    }

    return this.sortDirection === 'asc' ? 'bi-sort-down' : 'bi-sort-up';
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      const tooltip = document.createElement('div');
      tooltip.textContent = 'Copied!';
      tooltip.className =
        'position-fixed top-50 start-50 translate-middle bg-success text-white p-2 rounded shadow';
      document.body.appendChild(tooltip);
      setTimeout(() => tooltip.remove(), 1500);
    });
  }

  downloadAsCSV(): void {
    if (!this.message.data) return;

    const headers = Object.keys(this.message.data[0]);
    const csvRows = [
      headers.join(','),
      ...this.message.data.map((row) =>
        headers
          .map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') return `"${value.replace(/"/g, '""')}"`;
            return value;
          })
          .join(','),
      ),
    ];

    const csv = csvRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleTimeString();
  }
}
