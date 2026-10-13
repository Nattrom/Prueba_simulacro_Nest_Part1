export interface EnvironmentVariables {
  port: number;
  nodeEnv: string;
  apiKeys: string[];
  databasePath: string;
}

export const configuration = (): EnvironmentVariables => ({
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiKeys: (process.env.API_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0),
  databasePath: process.env.DATABASE_PATH ?? 'data/solicitudes.sqlite',
});
