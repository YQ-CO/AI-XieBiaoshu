"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminConfig_1 = require("../lib/adminConfig");
const modelConfig_1 = require("../lib/modelConfig");
const audit_1 = require("../lib/audit");
const riskControl_1 = require("../lib/riskControl");
const userAuth_1 = require("../lib/userAuth");
const modelMetrics_1 = require("../lib/modelMetrics");
const modelTasks_1 = require("../lib/modelTasks");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const modelGenerateLimiter = (0, riskControl_1.createRateLimiter)({
    keyPrefix: 'model_generate',
    windowMs: 60 * 1000,
    max: 30,
    keyResolver: (req) => String(req?.user?.sub || req.ip || 'unknown'),
    message: 'model requests too frequent, please retry later'
});
function makeModelError(message, code, retryable = false, status) {
    const err = new Error(message);
    err.code = code;
    err.retryable = retryable;
    if (status)
        err.status = status;
    return err;
}
async function withOneRetry(task) {
    try {
        return await task();
    }
    catch (error) {
        const err = error;
        if (!err?.retryable)
            throw err;
        return await task();
    }
}
async function callOpenAICompatible(prompt, modelCfg) {
    const baseURL = modelCfg.baseURL || 'https://api.openai.com/v1';
    const provider = modelCfg.provider || '';
    const apiKey = modelCfg.apiKey
        || (provider === 'deepseek_compatible' ? process.env.DEEPSEEK_API_KEY : '')
        || process.env.MODEL_API_KEY
        || '';
    const model = modelCfg.model || 'gpt-4o-mini';
    const temperature = Number(modelCfg.temperature ?? 0.7);
    const maxTokens = Number(modelCfg.maxTokens ?? 800);
    const systemPrompt = modelCfg.systemPrompt || '你是一个专业的中文标书编写助手。';
    const timeoutMs = Number(modelCfg.timeoutMs ?? 30000);
    if (!apiKey) {
        throw makeModelError('missing apiKey', 'MODEL_CONFIG_ERROR', false, 500);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                temperature,
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ]
            }),
            signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = data?.error?.message || `provider error: ${response.status}`;
            const retryable = response.status >= 500 || response.status === 429;
            throw makeModelError(message, 'MODEL_UPSTREAM_ERROR', retryable, 502);
        }
        const text = data?.choices?.[0]?.message?.content;
        if (!text || typeof text !== 'string') {
            throw makeModelError('empty model response', 'MODEL_EMPTY_RESPONSE', true, 502);
        }
        return text;
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            throw makeModelError('model request timeout', 'MODEL_TIMEOUT', true, 504);
        }
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
async function callAzureOpenAI(prompt, modelCfg) {
    const baseURL = (modelCfg.baseURL || '').replace(/\/$/, '');
    const apiKey = modelCfg.apiKey || process.env.MODEL_API_KEY || '';
    const deployment = modelCfg.deployment || '';
    const apiVersion = modelCfg.apiVersion || '2024-10-21';
    const temperature = Number(modelCfg.temperature ?? 0.7);
    const maxTokens = Number(modelCfg.maxTokens ?? 800);
    const systemPrompt = modelCfg.systemPrompt || '你是一个专业的中文标书编写助手。';
    const timeoutMs = Number(modelCfg.timeoutMs ?? 30000);
    if (!apiKey)
        throw makeModelError('missing apiKey', 'MODEL_CONFIG_ERROR', false, 500);
    if (!baseURL)
        throw makeModelError('missing baseURL', 'MODEL_CONFIG_ERROR', false, 500);
    if (!deployment)
        throw makeModelError('missing deployment', 'MODEL_CONFIG_ERROR', false, 500);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const url = `${baseURL}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                temperature,
                max_tokens: maxTokens,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ]
            }),
            signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const message = data?.error?.message || `provider error: ${response.status}`;
            const retryable = response.status >= 500 || response.status === 429;
            throw makeModelError(message, 'MODEL_UPSTREAM_ERROR', retryable, 502);
        }
        const text = data?.choices?.[0]?.message?.content;
        if (!text || typeof text !== 'string') {
            throw makeModelError('empty model response', 'MODEL_EMPTY_RESPONSE', true, 502);
        }
        return text;
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            throw makeModelError('model request timeout', 'MODEL_TIMEOUT', true, 504);
        }
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ error: 'missing authorization' });
    const parts = authHeader.split(' ');
    if (parts.length !== 2)
        return res.status(401).json({ error: 'invalid authorization header' });
    const token = parts[1];
    try {
        const payload = (0, userAuth_1.verifyActiveUserToken)(token, JWT_SECRET);
        req.user = payload;
        return next();
    }
    catch (err) {
        if (err?.message === 'account disabled') {
            return res.status(403).json({ error: 'account disabled' });
        }
        return res.status(401).json({ error: 'invalid token' });
    }
}
function writeModelAudit(req, payload) {
    (0, audit_1.appendAuditLog)({
        category: 'model',
        action: payload.action,
        success: payload.success,
        actorType: 'user',
        actorId: req?.user?.sub || 'unknown',
        targetId: payload.docId,
        message: payload.message,
        metadata: {
            mode: payload.mode,
            apiName: payload.apiName,
            promptLength: payload.promptLength,
            modelChoice: payload.modelChoice
        },
        ip: req.ip,
        userAgent: String(req.headers['user-agent'] || '')
    });
}
function getSelectableModels(modelCfg) {
    const list = Array.isArray(modelCfg?.selectableModels) ? modelCfg.selectableModels : [];
    return list
        .filter((item) => item && typeof item.id === 'string' && item.id.trim())
        .map((item) => ({
        id: String(item.id).trim(),
        name: String(item.name || item.id).trim(),
        mode: String(item.mode || '').trim(),
        provider: String(item.provider || '').trim(),
        model: String(item.model || '').trim(),
        deployment: String(item.deployment || '').trim(),
        baseURL: String(item.baseURL || '').trim(),
        apiVersion: String(item.apiVersion || '').trim(),
        apiName: String(item.apiName || '').trim()
    }));
}
function buildRuntimeModelConfig(modelCfg, modelChoice) {
    const choices = getSelectableModels(modelCfg);
    if (!choices.length) {
        const pickedId = String(modelChoice || '').trim();
        if (!pickedId || pickedId === 'default')
            return { runtime: modelCfg, chosen: pickedId };
        return { runtime: null, chosen: pickedId };
    }
    const pickedId = String(modelChoice || modelCfg.defaultModelChoice || choices[0].id || '').trim();
    if (!pickedId)
        return { runtime: modelCfg, chosen: '' };
    const hit = choices.find((item) => item.id === pickedId);
    if (!hit)
        return { runtime: null, chosen: pickedId };
    const runtime = {
        ...modelCfg,
        mode: hit.mode || modelCfg.mode,
        provider: hit.provider || modelCfg.provider,
        model: hit.model || modelCfg.model,
        deployment: hit.deployment || modelCfg.deployment,
        apiName: hit.apiName || hit.name || modelCfg.apiName,
        baseURL: hit.baseURL || modelCfg.baseURL,
        apiVersion: hit.apiVersion || modelCfg.apiVersion
    };
    return { runtime, chosen: hit.id };
}
async function executeGenerate(req, input) {
    const startedAt = Date.now();
    const { prompt, docId, modelChoice } = input;
    if (!prompt || typeof prompt !== 'string') {
        throw makeModelError('missing prompt', 'MODEL_BAD_REQUEST', false, 400);
    }
    const cfg = (0, adminConfig_1.loadAdminConfig)();
    const modelCfg = (0, modelConfig_1.normalizeModelConfig)(cfg.model || {});
    const runtimeModel = buildRuntimeModelConfig(modelCfg, String(modelChoice || ''));
    if (!runtimeModel.runtime) {
        writeModelAudit(req, {
            action: 'model.generate',
            success: false,
            message: 'invalid modelChoice',
            docId,
            mode: modelCfg.mode,
            apiName: modelCfg.apiName,
            promptLength: String(prompt).length,
            modelChoice: runtimeModel.chosen
        });
        throw makeModelError('invalid modelChoice', 'MODEL_INVALID_CHOICE', false, 400);
    }
    const modelChoiceId = runtimeModel.chosen;
    const runtimeCfg = (0, modelConfig_1.normalizeModelConfig)(runtimeModel.runtime);
    const mode = runtimeCfg.mode || 'mock';
    const apiName = runtimeCfg.apiName || runtimeCfg.provider || mode;
    const maxPromptLength = Number(runtimeCfg.maxPromptLength || 4000);
    const safePrompt = prompt.slice(0, maxPromptLength);
    if (mode === 'disabled') {
        writeModelAudit(req, {
            action: 'model.generate',
            success: false,
            message: 'model disabled',
            docId,
            mode,
            apiName,
            promptLength: safePrompt.length,
            modelChoice: modelChoiceId
        });
        (0, modelMetrics_1.recordModelMetric)({ durationMs: Date.now() - startedAt, success: false, mode, apiName, errorCode: 'MODEL_DISABLED' });
        throw makeModelError('model disabled', 'MODEL_DISABLED', false, 403);
    }
    if (mode === 'mock') {
        const prefix = runtimeCfg.prefix || '生成文本：根据提示';
        const suffix = runtimeCfg.suffix || '的内容...';
        const text = `${prefix}[${safePrompt}]${suffix}`;
        writeModelAudit(req, {
            action: 'model.generate',
            success: true,
            docId,
            mode,
            apiName,
            promptLength: safePrompt.length,
            modelChoice: modelChoiceId
        });
        (0, modelMetrics_1.recordModelMetric)({ durationMs: Date.now() - startedAt, success: true, mode, apiName });
        return { text, docId, mode, apiName, modelChoice: modelChoiceId };
    }
    try {
        let text = '';
        if (mode === 'openai_compatible') {
            text = await withOneRetry(() => callOpenAICompatible(safePrompt, runtimeCfg));
        }
        else if (mode === 'azure_openai') {
            text = await withOneRetry(() => callAzureOpenAI(safePrompt, runtimeCfg));
        }
        else {
            writeModelAudit(req, {
                action: 'model.generate',
                success: false,
                message: 'unsupported model mode',
                docId,
                mode,
                apiName,
                promptLength: safePrompt.length,
                modelChoice: modelChoiceId
            });
            (0, modelMetrics_1.recordModelMetric)({ durationMs: Date.now() - startedAt, success: false, mode, apiName, errorCode: 'MODEL_UNSUPPORTED_MODE' });
            throw makeModelError('unsupported model mode', 'MODEL_UNSUPPORTED_MODE', false, 400);
        }
        writeModelAudit(req, {
            action: 'model.generate',
            success: true,
            docId,
            mode,
            apiName,
            promptLength: safePrompt.length,
            modelChoice: modelChoiceId
        });
        (0, modelMetrics_1.recordModelMetric)({ durationMs: Date.now() - startedAt, success: true, mode, apiName });
        return { text, docId, mode, apiName, modelChoice: modelChoiceId };
    }
    catch (error) {
        const err = error;
        const errorCode = err?.code || 'MODEL_REQUEST_FAILED';
        const status = err?.status || (errorCode === 'MODEL_TIMEOUT' ? 504 : 502);
        writeModelAudit(req, {
            action: 'model.generate',
            success: false,
            message: err?.message || 'model request failed',
            docId,
            mode,
            apiName,
            promptLength: safePrompt.length,
            modelChoice: modelChoiceId
        });
        (0, modelMetrics_1.recordModelMetric)({ durationMs: Date.now() - startedAt, success: false, mode, apiName, errorCode });
        throw makeModelError(err?.message || 'model request failed', errorCode, false, status);
    }
}
router.get('/options', authMiddleware, (req, res) => {
    const cfg = (0, adminConfig_1.loadAdminConfig)();
    const modelCfg = (0, modelConfig_1.normalizeModelConfig)(cfg.model || {});
    const list = getSelectableModels(modelCfg);
    if (!list.length) {
        const fallbackId = 'default';
        const fallbackName = modelCfg.apiName || modelCfg.provider || modelCfg.mode || 'default';
        return res.json({
            defaultModelChoice: fallbackId,
            options: [{
                    id: fallbackId,
                    name: fallbackName,
                    mode: modelCfg.mode || 'mock',
                    provider: modelCfg.provider || '',
                    model: modelCfg.model || '',
                    deployment: modelCfg.deployment || '',
                    apiName: modelCfg.apiName || ''
                }]
        });
    }
    return res.json({
        defaultModelChoice: modelCfg.defaultModelChoice || list[0].id,
        options: list
    });
});
// generation endpoint
router.post('/generate', authMiddleware, modelGenerateLimiter, async (req, res) => {
    const { prompt, docId, modelChoice } = req.body || {};
    try {
        const data = await executeGenerate(req, { prompt, docId, modelChoice });
        return res.json(data);
    }
    catch (error) {
        const err = error;
        const status = err?.status || 502;
        return res.status(status).json({
            error: err?.message || 'model request failed',
            errorCode: err?.code || 'MODEL_REQUEST_FAILED'
        });
    }
});
router.post('/generate/task', authMiddleware, modelGenerateLimiter, (req, res) => {
    const { prompt, docId, modelChoice } = req.body || {};
    if (!prompt || typeof prompt !== 'string')
        return res.status(400).json({ error: 'missing prompt' });
    const workerReq = {
        user: { sub: String(req.user?.sub || '') },
        ip: req.ip,
        headers: { 'user-agent': String(req.headers['user-agent'] || '') }
    };
    const task = (0, modelTasks_1.createModelTask)({
        userId: String(req.user?.sub || ''),
        docId,
        modelChoice,
        promptLength: prompt.length
    });
    setTimeout(async () => {
        (0, modelTasks_1.updateModelTask)(task.id, { status: 'running', startedAt: new Date().toISOString() });
        try {
            const result = await executeGenerate(workerReq, { prompt, docId, modelChoice });
            (0, modelTasks_1.updateModelTask)(task.id, {
                status: 'success',
                text: result.text,
                apiName: result.apiName,
                mode: result.mode,
                finishedAt: new Date().toISOString()
            });
        }
        catch (error) {
            const err = error;
            (0, modelTasks_1.updateModelTask)(task.id, {
                status: 'failed',
                error: err?.message || 'model request failed',
                errorCode: err?.code || 'MODEL_REQUEST_FAILED',
                statusCode: err?.status || 502,
                finishedAt: new Date().toISOString()
            });
        }
    }, 0);
    return res.json({ id: task.id, status: task.status, createdAt: task.createdAt });
});
router.get('/generate/task/:id', authMiddleware, (req, res) => {
    const id = String(req.params.id || '');
    if (!id)
        return res.status(400).json({ error: 'missing task id' });
    const task = (0, modelTasks_1.getModelTask)(id);
    if (!task)
        return res.status(404).json({ error: 'task not found' });
    if (task.userId !== String(req.user?.sub || ''))
        return res.status(403).json({ error: 'forbidden' });
    return res.json(task);
});
exports.default = router;
