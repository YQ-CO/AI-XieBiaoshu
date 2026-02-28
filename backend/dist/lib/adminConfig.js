"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAdminConfig = loadAdminConfig;
exports.saveAdminConfig = saveAdminConfig;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CONFIG_PATH = path_1.default.resolve(__dirname, '../../data/admin_config.json');
function loadAdminConfig() {
    try {
        const raw = fs_1.default.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(raw);
    }
    catch (e) {
        return {};
    }
}
function saveAdminConfig(cfg) {
    const dir = path_1.default.dirname(CONFIG_PATH);
    if (!fs_1.default.existsSync(dir))
        fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}
