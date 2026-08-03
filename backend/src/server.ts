import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[backend] Servidor escuchando en http://localhost:${env.PORT}`);
});
