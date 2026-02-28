<template>
  <div style="max-width:420px;margin:40px auto;padding:20px;border:1px solid #eee;border-radius:6px;">
    <h2>登录</h2>
    <div style="margin-bottom:12px;">
      <label>登录方式：</label>
      <select v-model="type">
        <option value="sms">手机号+验证码</option>
        <option value="password">用户名+密码</option>
      </select>
    </div>

    <div v-if="type === 'sms'">
      <input v-model="mobile" placeholder="手机号" style="width:100%;padding:8px;margin-bottom:8px;" />
      <input v-model="code" placeholder="验证码" style="width:70%;padding:8px;" />
      <button @click="sendCode" style="margin-left:8px;">发送验证码</button>
    </div>

    <div v-else>
      <input v-model="username" placeholder="用户名" style="width:100%;padding:8px;margin-bottom:8px;" />
      <input type="password" v-model="password" placeholder="密码" style="width:100%;padding:8px;margin-bottom:8px;" />
    </div>

    <button @click="login" style="width:100%;padding:10px;margin-top:12px;">登录</button>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import axios from 'axios';

export default defineComponent({
  setup() {
    const type = ref<'sms' | 'password'>('sms');
    const mobile = ref('');
    const code = ref('');
    const username = ref('');
    const password = ref('');
    const debug = ref('');

    const sendCode = async () => {
      // mock: 在真实场景调用短信接口
      debug.value = '已发送假验证码：123456';
      code.value = '123456';
    };

    const login = async () => {
      try {
        const body: any = { type: type.value };
        if (type.value === 'sms') {
          body.mobile = mobile.value;
          body.code = code.value;
        } else {
          body.username = username.value;
          body.password = password.value;
        }
        const resp = await axios.post('/api/auth/login', body);
        const token = resp.data.token;
        localStorage.setItem('token', token);
        debug.value = `登录成功，token=${token}`;
        // 登录后跳转到账户管理页
        window.location.href = '/account';
      } catch (err: any) {
        debug.value = '登录失败: ' + (err.response?.data?.error || err.message);
      }
    };

    return { type, mobile, code, username, password, sendCode, login, debug };
  }
});
</script>
