<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ElDrawer, ElIcon } from "element-plus";
import { CircleCheckFilled } from "@element-plus/icons-vue";
import { listLiveReportAudits,type ReportAudit } from "@/api/liveReport";
const props=defineProps<{modelValue:boolean;reportId:string;title?:string}>();const emit=defineEmits<{"update:modelValue":[boolean]}>();const visible=computed({get:()=>props.modelValue,set:v=>emit("update:modelValue",v)});const rows=ref<ReportAudit[]>([]);const loading=ref(false);
watch(()=>props.modelValue,async v=>{if(!v)return;loading.value=true;try{rows.value=(await listLiveReportAudits(props.reportId)).list;}finally{loading.value=false;}},{immediate:true});
function action(a:ReportAudit){if(a.action==="submit")return "发起申请";if(a.action==="resubmit")return "重新提交";return a.result==="passed"?"审核通过":"审核驳回";}
</script>
<template><ElDrawer v-model="visible" title="审核记录" size="420px"><p class="title">{{title}}</p><div v-loading="loading" class="timeline"><div v-for="(x,i) in rows" :key="x.id" class="item"><div class="rail"><ElIcon><CircleCheckFilled /></ElIcon><i v-if="i<rows.length-1"/></div><div><b>{{action(x)}}</b><p>操作人：{{x.operatorName}}</p><p>操作时间：{{x.createdAt}}</p><p v-if="x.reason" class="reason">{{x.reason}}</p></div></div><el-empty v-if="!loading&&!rows.length" description="暂无审核记录" /></div></ElDrawer></template>
<style scoped>.title{color:#333}.item{display:flex;gap:12px;min-height:88px}.rail{display:flex;flex-direction:column;align-items:center;color:var(--color-primary)}.rail i{height:55px;border-left:1px dashed #ccc;margin-top:5px}.item b{font-size:13px}.item p{margin:6px 0;color:#666;font-size:12px}.reason{padding:8px;background:#fafafa}.timeline{padding-top:8px}</style>
