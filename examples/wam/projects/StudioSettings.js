// One global preferences dialog; shortcuts select a section instead of opening
// competing dialogs. Existing nodes/IDs and their event handlers are preserved.
export function registerStudioSettings({settings, projectPanel, recordPanel, projectButton, recordButton}) {
  settings.addSection({id:'studio', label:'Studio', icon:'sliders', order:3, element:projectPanel});
  settings.addSection({id:'recording', label:'Recording', icon:'microphone', order:4, element:recordPanel});
  projectButton.onclick=()=>settings.open('studio');
  recordButton.onclick=()=>settings.open('recording');
}
