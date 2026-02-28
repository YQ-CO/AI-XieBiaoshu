<template>
  <div style="max-width:800px;margin:24px auto;padding:16px;">
    <h2>充值与订单</h2>
    <div style="margin-bottom:24px;">
      <input v-model.number="amount" type="number" placeholder="充值金额" style="width:120px;padding:6px;" />
      <button @click="doRecharge">充值</button>
    </div>

    <h3>我的订单</h3>
    <table border="1" cellpadding="6" cellspacing="0" style="width:100%;text-align:left;">
      <thead>
        <tr><th>ID</th><th>金额</th><th>时间</th><th>发票</th><th>操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="o in orders" :key="o.id">
          <td>{{ o.id }}</td>
          <td>{{ o.amount }}</td>
          <td>{{ o.createdAt }}</td>
          <td>{{ o.invoiceRequested ? (o.invoiceStatus||'pending') : '未申请' }}</td>
          <td>
            <button v-if="!o.invoiceRequested" @click="openInvoice(o.id)">申请发票</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="showInvoice" style="margin-top:20px;padding:12px;border:1px solid #ccc;">
      <h4>发票申请</h4>
      <div>
        <label><input type="radio" value="normal" v-model="invoiceType" /> 普通发票</label>
        <label><input type="radio" value="special" v-model="invoiceType" /> 专用发票</label>
      </div>
      <div v-if="invoiceType==='normal'" style="margin-top:8px;">
        公司名称：<input v-model="invoiceInfo.company" style="width:200px;" />
        统一社会信用代码：<input v-model="invoiceInfo.code" style="width:200px;" />
      </div>
      <div v-if="invoiceType==='special'" style="margin-top:8px;">
        <!-- simplified fields -->
        公司名称：<input v-model="invoiceInfo.company" style="width:200px;" /><br />
        统一社会信用代码：<input v-model="invoiceInfo.code" style="width:200px;" /><br />
        手机/邮箱：<input v-model="invoiceInfo.contact" style="width:200px;" /><br />
        <!-- in real app upload and more fields -->
      </div>
      <button @click="submitInvoice">提交</button>
      <button @click="showInvoice=false">取消</button>
    </div>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { recharge, myOrders, requestInvoice } from '../api/orders';

export default defineComponent({
  setup() {
    const token = localStorage.getItem('token') || '';
    const enterpriseId = localStorage.getItem('enterpriseId') || '';
    const amount = ref(0);
    const orders = ref<any[]>([]);
    const debug = ref('');

    const load = async () => {
      try {
        orders.value = await myOrders(token);
      } catch (e: any) {
        debug.value = '加载订单失败：' + (e.response?.data?.error || e.message);
      }
    };
    const doRecharge = async () => {
      try {
        const o = await recharge({ amount: amount.value, enterpriseId }, token);
        debug.value = '充值成功，订单ID:'+o.id;
        await load();
      } catch (e: any) {
        debug.value = '充值失败：' + (e.response?.data?.error || e.message);
      }
    };
    const showInvoice = ref(false);
    const currentOrder = ref('');
    const invoiceType = ref<'normal'|'special'>('normal');
    const invoiceInfo = ref<any>({});
    const openInvoice = (id:string) => {
      currentOrder.value = id;
      showInvoice.value = true;
      invoiceType.value = 'normal';
      invoiceInfo.value = {};
    };
    const submitInvoice = async () => {
      try {
        const resp = await requestInvoice({ orderId: currentOrder.value, type: invoiceType.value, info: invoiceInfo.value }, token);
        debug.value = '发票申请已提交';
        showInvoice.value = false;
        await load();
      } catch (e: any) {
        debug.value = '发票申请失败：' + (e.response?.data?.error || e.message);
      }
    };

    onMounted(load);
    return { amount, orders, debug, doRecharge, showInvoice, invoiceType, invoiceInfo, openInvoice, submitInvoice };
  }
});
</script>
