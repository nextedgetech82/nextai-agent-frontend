export interface QueryRequest {
  query: string;
  insights?: boolean;
  chart?: boolean;
  skipCache?: boolean;
}
