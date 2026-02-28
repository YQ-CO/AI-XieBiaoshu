"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODEL_PROVIDER_TEMPLATES = void 0;
exports.normalizeModelConfig = normalizeModelConfig;
exports.validateModelConfig = validateModelConfig;
exports.MODEL_PROVIDER_TEMPLATES = [
    {
        provider: 'openai',
        mode: 'openai_compatible',
        required: ['apiKey', 'model'],
        optional: ['baseURL', 'systemPrompt', 'temperature', 'maxTokens', 'timeoutMs', 'maxPromptLength'],
        template: {
            mode: 'openai_compatible',
            provider: 'openai',
            baseURL: 'https://api.openai.com/v1',
            model: 'gpt-4o-mini',
            apiKey: '<sk-0ea245c9c2644cdabe268740353b5ccb>',
            systemPrompt: '你是一个专业的中文标书编写助手。',
            temperature: 0.7,
            maxTokens: 800,
            timeoutMs: 30000,
            maxPromptLength: 4000
        }
    },
    {
        provider: 'azure_openai',
        mode: 'azure_openai',
        required: ['apiKey', 'baseURL', 'deployment', 'apiVersion'],
        optional: ['systemPrompt', 'temperature', 'maxTokens', 'timeoutMs', 'maxPromptLength'],
        template: {
            mode: 'azure_openai',
            provider: 'azure_openai',
            baseURL: 'https://<resource-name>.openai.azure.com',
            deployment: '<DEPLOYMENT_NAME>',
            apiVersion: '2024-10-21',
            apiKey: '<YOUR_AZURE_OPENAI_KEY>',
            systemPrompt: '你是一个专业的中文标书编写助手。',
            temperature: 0.7,
            maxTokens: 800,
            timeoutMs: 30000,
            maxPromptLength: 4000
        }
    },
    {
        provider: 'qwen_compatible',
        mode: 'openai_compatible',
        required: ['apiKey', 'model'],
        optional: ['baseURL', 'systemPrompt', 'temperature', 'maxTokens', 'timeoutMs', 'maxPromptLength'],
        template: {
            mode: 'openai_compatible',
            provider: 'qwen_compatible',
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            model: 'qwen-plus',
            apiKey: '<YOUR_DASHSCOPE_API_KEY>',
            systemPrompt: '你是一个专业的中文标书编写助手。',
            temperature: 0.7,
            maxTokens: 800,
            timeoutMs: 30000,
            maxPromptLength: 4000
        }
    },
    {
        provider: 'deepseek_compatible',
        mode: 'openai_compatible',
        required: ['apiKey', 'model'],
        optional: ['baseURL', 'systemPrompt', 'temperature', 'maxTokens', 'timeoutMs', 'maxPromptLength'],
        template: {
            mode: 'openai_compatible',
            provider: 'deepseek_compatible',
            baseURL: 'https://api.deepseek.com/v1',
            model: 'deepseek-chat',
            apiKey: '<YOUR_DEEPSEEK_API_KEY>',
            systemPrompt: '你是一个专业的中文标书编写助手。',
            temperature: 0.7,
            maxTokens: 800,
            timeoutMs: 30000,
            maxPromptLength: 4000
        }
    }
];
function asNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}
function normalizeSelectableModels(list) {
    if (!Array.isArray(list))
        return [];
    const cleaned = [];
    for (const item of list) {
        if (!item || typeof item !== 'object')
            continue;
        const id = String(item.id || '').trim();
        if (!id)
            continue;
        const name = String(item.name || id).trim();
        const mode = String(item.mode || '').trim();
        const provider = String(item.provider || '').trim();
        const model = String(item.model || '').trim();
        const deployment = String(item.deployment || '').trim();
        const apiVersion = String(item.apiVersion || '').trim();
        const baseURL = String(item.baseURL || '').trim();
        const apiName = String(item.apiName || '').trim();
        cleaned.push({
            id,
            name,
            mode,
            provider,
            model,
            deployment,
            apiVersion,
            baseURL,
            apiName
        });
    }
    return cleaned;
}
function normalizeModelConfig(modelCfg = {}) {
    const mode = modelCfg.mode || 'mock';
    const selectableModels = normalizeSelectableModels(modelCfg.selectableModels);
    const defaultModelChoice = String(modelCfg.defaultModelChoice || '').trim();
    return {
        ...modelCfg,
        mode,
        temperature: asNumber(modelCfg.temperature, 0.7),
        maxTokens: asNumber(modelCfg.maxTokens, 800),
        timeoutMs: asNumber(modelCfg.timeoutMs, 30000),
        maxPromptLength: asNumber(modelCfg.maxPromptLength, 4000),
        selectableModels,
        defaultModelChoice
    };
}
function validateModelConfig(input) {
    if (!input || typeof input !== 'object') {
        return { valid: false, message: 'model config must be an object' };
    }
    const normalized = normalizeModelConfig(input);
    const mode = normalized.mode;
    const allowedModes = ['mock', 'disabled', 'openai_compatible', 'azure_openai'];
    if (!allowedModes.includes(mode)) {
        return { valid: false, message: 'invalid model mode' };
    }
    if (normalized.maxPromptLength <= 0 || normalized.maxPromptLength > 20000) {
        return { valid: false, message: 'maxPromptLength out of range' };
    }
    if (normalized.timeoutMs < 1000 || normalized.timeoutMs > 120000) {
        return { valid: false, message: 'timeoutMs out of range' };
    }
    if (normalized.maxTokens <= 0 || normalized.maxTokens > 8000) {
        return { valid: false, message: 'maxTokens out of range' };
    }
    if (normalized.temperature < 0 || normalized.temperature > 2) {
        return { valid: false, message: 'temperature out of range' };
    }
    const selectableModels = Array.isArray(normalized.selectableModels) ? normalized.selectableModels : [];
    if (selectableModels.length > 50) {
        return { valid: false, message: 'selectableModels too many items' };
    }
    const seen = new Set();
    for (const item of selectableModels) {
        const id = String(item?.id || '').trim();
        if (!id)
            return { valid: false, message: 'selectable model id is required' };
        if (seen.has(id))
            return { valid: false, message: `duplicate selectable model id: ${id}` };
        seen.add(id);
    }
    if (normalized.defaultModelChoice && !seen.has(normalized.defaultModelChoice)) {
        return { valid: false, message: 'defaultModelChoice must exist in selectableModels' };
    }
    if (mode === 'openai_compatible') {
        if (!normalized.model || typeof normalized.model !== 'string') {
            return { valid: false, message: 'model is required for openai_compatible' };
        }
    }
    if (mode === 'azure_openai') {
        if (!normalized.baseURL || typeof normalized.baseURL !== 'string') {
            return { valid: false, message: 'baseURL is required for azure_openai' };
        }
        if (!normalized.deployment || typeof normalized.deployment !== 'string') {
            return { valid: false, message: 'deployment is required for azure_openai' };
        }
        if (!normalized.apiVersion || typeof normalized.apiVersion !== 'string') {
            return { valid: false, message: 'apiVersion is required for azure_openai' };
        }
    }
    return { valid: true, normalized };
}
