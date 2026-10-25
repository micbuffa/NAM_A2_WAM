// Keep the native file picker in the original user click (no async boundary).
export function chooseAudioFile(menu,input){
 if(input.disabled)return false;
 menu.open=false;
 input.click();
 return true;
}
