export const WEBNN_DEVICES=Object.freeze(['cpu','gpu','npu']);
export const WEBNN_DEVICE_KEY='nam-webnn-device.v1';
export function webnnContextOptions(deviceType){
 if(!WEBNN_DEVICES.includes(deviceType))throw Error('Choisissez CPU, GPU ou NPU pour WebNN.');
 return {deviceType,accelerated:deviceType!=='cpu'};
}
export function loadWebnnDevice(storage){try{const saved=storage?.getItem(WEBNN_DEVICE_KEY);if(WEBNN_DEVICES.includes(saved))return saved;}catch{}return 'gpu';}
export function saveWebnnDevice(storage,deviceType){webnnContextOptions(deviceType);try{storage?.setItem(WEBNN_DEVICE_KEY,deviceType);}catch{}return deviceType;}
