<template>
  <div style="max-width:900px;margin:24px auto;padding:16px;">
    <h2>模型配置管理</h2>

    <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center;">
      <input v-model="adminToken" placeholder="管理员Token (x-admin-token)" style="padding:6px;width:320px;" />
      <button @click="loadAll">加载配置</button>
    </div>

    <div style="margin-bottom:12px;">
      <label>供应商模板：</label>
      <select v-model="selectedProvider" @change="applyTemplate" style="padding:6px;min-width:220px;">
        <option value="">请选择模板</option>
        <option v-for="p in providers" :key="p.provider" :value="p.provider">{{ p.provider }}</option>
      </select>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <label>mode</label>
        <input v-model="form.mode" style="width:100%;padding:6px;" />
      </div>
      <div>
        <label>provider</label>
        <input v-model="form.provider" style="width:100%;padding:6px;" />
      </div>
      <div>
        <label>apiName</label>
        <input v-model="form.apiName" style="width:100%;padding:6px;" />
      </div>
      <div>
        <label>baseURL</label>
        <input v-model="form.baseURL" style="width:100%;padding:6px;" />
      </div>
      <div>
        <label>model</label>
        <input v-model="form.model" style="width:100%;padding:6px;" />
      </div>
      <div>
        <label>apiKey</label>
        <input v-model="form.apiKey" placeholder="可留空，走环境变量" style="width:100%;padding:6px;" />
      </div>
      <div>
        <label>temperature</label>
        <input v-model.number="form.temperature" type="number" step="0.1" style="width:100%;padding:6px;" />
      </div>
      <div>
        <label>maxTokens</label>
        <input v-model.number="form.maxTokens" type="number" style="width:100%;padding:6px;" />
      </div>
    </div>

    <div style="margin-top:12px;">
      <label>systemPrompt</label>
      <textarea v-model="form.systemPrompt" rows="3" style="width:100%;"></textarea>
    </div>

    <div style="margin-top:12px;">
      <label>defaultModelChoice（用户默认选择ID）</label>
      <input v-model="form.defaultModelChoice" style="width:100%;padding:6px;" placeholder="例如：deepseek_chat" />
    </div>

    <div style="margin-top:12px;">
      <label>selectableModels（用户可选模型列表JSON）</label>
      <textarea v-model="selectableModelsText" rows="8" style="width:100%;"></textarea>
      <div style="color:#666;margin-top:4px;">示例项字段：id,name,mode,provider,model,deployment,baseURL,apiVersion,apiName</div>
    </div>

    <div style="margin-top:12px;display:flex;gap:8px;">
      <button @click="saveConfig">保存模型配置</button>
      <button @click="testGenerate">测试生成</button>
      <a href="/account" style="line-height:30px;">返回账户页</a>
    </div>

    <div style="margin-top:12px;">
      <label>测试提示词</label>
      <textarea v-model="testPrompt" rows="4" style="width:100%;"></textarea>
    </div>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px;white-space:pre-wrap;">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { getAdminConfig, getModelProviders, updateAdminConfig } from '../api/admin';
import { generateText } from '../api/model';

export default defineComponent({
  setup() {
    const adminToken = ref(localStorage.getItem('adminToken') || 'admin-secret');
    const selectedProvider = ref('');
    const providers = ref<any[]>([]);
    const debug = ref('');
    const testPrompt = ref('请生成一段测试用标书摘要。');
    const selectableModelsText = ref('[]');
    const form = ref<any>({
      mode: 'mock',
      provider: '',
      apiName: '',
      baseURL: '',
      model: '',
      apiKey: '',
      systemPrompt: '你是一个专业的中文标书编写助手。',
      temperature: 0.7,
      maxTokens: 800,
      timeoutMs: 30000,
      maxPromptLength: 4000,
      defaultModelChoice: ''
    });

    const loadAll = async () => {
      try {
        localStorage.setItem('adminToken', adminToken.value);
        const [cfg, list] = await Promise.all([
          getAdminConfig(adminToken.value),
          getModelProviders(adminToken.value)
        ]);
        providers.value = Array.isArray(list) ? list : [];
        form.value = { ...form.value, ...(cfg.model || {}) };
        selectableModelsText.value = JSON.stringify(cfg.model?.selectableModels || [], null, 2);
        debug.value = '已加载当前配置和模板';
      } catch (e: any) {
        debug.value = '加载失败：' + (e.response?.data?.error || e.message);
      }
    };

    const applyTemplate = () => {
      const hit = providers.value.find((p: any) => p.provider === selectedProvider.value);
      if (!hit) return;
      const template = hit.template || {};
      form.value = { ...form.value, ...template };
      if (!form.value.apiName) form.value.apiName = '写标书';
      debug.value = `已应用模板：${selectedProvider.value}`;
    };

    const saveConfig = async () => {
      try {
        localStorage.setItem('adminToken', adminToken.value);
        const modelPayload: any = { ...form.value };
        try {
          modelPayload.selectableModels = JSON.parse(selectableModelsText.value || '[]');
        } catch (e) {
          debug.value = '保存失败：selectableModels 不是合法JSON';
          return;
        }
        if (!modelPayload.apiKey) delete modelPayload.apiKey;
        const resp = await updateAdminConfig({ model: modelPayload }, adminToken.value);
        form.value = { ...form.value, ...(resp.config?.model || {}) };
        selectableModelsText.value = JSON.stringify(resp.config?.model?.selectableModels || [], null, 2);
        debug.value = '模型配置保存成功';
      } catch (e: any) {
        debug.value = '保存失败：' + (e.response?.data?.error || e.message);
      }
    };

    const testGenerate = async () => {
      try {
        const token = localStorage.getItem('token') || '';
        if (!token) {
          debug.value = '请先登录用户账号再测试生成';
          return;
        }
        const resp = await generateText({ prompt: testPrompt.value, docId: 'admin-test' }, token);
        debug.value = `测试成功(${resp.apiName || resp.mode})：\n${resp.text || ''}`;
      } catch (e: any) {
        const apiName = e.response?.data?.apiName || 'model';
        const err = e.response?.data?.error || e.message;
        debug.value = `测试失败(${apiName})：${err}`;
      }
    };

    loadAll();
    return {
      adminToken,
      selectedProvider,
      providers,
      form,
      selectableModelsText,
      debug,
      testPrompt,
      loadAll,
      applyTemplate,
      saveConfig,
      testGenerate
    };
  }
});
</script>
