import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.resolve(__dirname, '../../data/admin_config.json');

export function loadAdminConfig(): any {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export function saveAdminConfig(cfg: any) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}
